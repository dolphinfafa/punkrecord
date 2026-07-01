# 后端架构与 API 接口

> 本文档描述后端服务的架构设计和所有 API 端点。属于 `project-index.md` 的子文档。

---

## 1. 后端架构

入口文件：`backend/app/main.py`

- 使用 FastAPI 框架，所有路由注册在 `/api/v1` 前缀下
- 启用 CORS 中间件（允许跨域）
- 请求日志中间件（记录每次请求的方法、路径、耗时）
- 统一异常处理（`AtlasException` + 通用异常捕获）
- 启动时初始化数据库（`create_db_and_tables`）

### 路由模块

| 文件 | 路由前缀 | 职责 |
|------|----------|------|
| `auth.py` | `/api/v1/auth` | 认证（登录、登出、当前用户） |
| `iam.py` | `/api/v1/iam` | 组织管理（用户、部门、职位、权限、实体） |
| `todo.py` | `/api/v1/todo` | 任务管理（任务、请假） |
| `contract.py` | `/api/v1/contract` | 合同管理（合同、对手方、付款计划） |
| `project.py` | `/api/v1/project` | 项目管理（项目、阶段、成员、任务、导出） |
| `finance.py` | `/api/v1/finance` | 财务管理（账户、交易、发票、报销、Excel 导出） |
| `ai.py` | `/api/v1/ai` | AI 能力（对话、流式响应） |
| `kb.py` | `/api/v1/kb` | 企业大脑（文档管理、RAG 对话、语义搜索） |
| `meeting.py` | `/api/v1/meeting` | 会议记录（音频上传、ASR 转写、AI 总结、归档） |
| `changelog.py` | `/api/v1/changelog` | 版本更新日志（CRUD，L0 权限控制） |
| `mcp_server.py` | `/api/v1/mcp` | MCP 服务（Streamable HTTP，FastMCP），AI 客户端直连 |

路由文件位于 `backend/app/api/` 目录。

---

## 2. API 接口清单

### 认证模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 用户登录（返回含 `profile_completed`/`must_change_password` 状态） |
| POST | `/api/v1/auth/logout` | 用户登出 |
| GET | `/api/v1/auth/me` | 获取当前用户信息（含档案完善和密码状态） |
| POST | `/api/v1/auth/complete-profile` | 首次登录完善档案 + 设置新密码 |
| POST | `/api/v1/auth/change-password` | 修改密码（需验证原密码） |

### 组织管理（IAM）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PATCH/DELETE | `/api/v1/iam/job-titles` | 职位 CRUD |
| GET/PUT | `/api/v1/iam/job-titles/{id}/permissions` | 职位权限查询/设置 |
| GET | `/api/v1/iam/permissions` | 获取所有权限列表 |
| GET/POST/PATCH/DELETE | `/api/v1/iam/departments` | 部门 CRUD |
| POST | `/api/v1/iam/users` | 创建用户 |
| GET | `/api/v1/iam/users` | 用户列表 |
| GET/PATCH | `/api/v1/iam/users/{user_id}` | 用户详情/更新（含档案字段） |
| POST | `/api/v1/iam/users/{user_id}/reset-password` | 管理员重置用户密码（默认 `punkrecord123`） |
| POST | `/api/v1/iam/users/{user_id}/reset-leave-balances` | 重置用户假期余额 |
| POST | `/api/v1/iam/users/reset-leave-balances` | 重置所有用户假期余额 |
| POST | `/api/v1/iam/users/{user_id}/id-card-image` | 上传身份证图片（JPG/PNG/WebP） |
| POST | `/api/v1/iam/users/{user_id}/resume` | 上传简历（PDF） |
| GET | `/api/v1/iam/users/{user_id}/files/{filename}` | 下载用户文件（需认证，前端须用 axios+blob） |
| GET | `/api/v1/iam/entities` | 实体列表 |
| GET/POST | `/api/v1/iam/our-entities` | 我方实体 |
| GET | `/api/v1/iam/org-chart` | 组织架构图 |
| GET/POST/PATCH/DELETE | `/api/v1/iam/beli-rules` | Beli 积分规则 CRUD |

### 任务管理（Todo）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/todo` | 创建任务（支持 `link` 关联项目 + `dev_type`，见下方扩展说明） |
| GET | `/api/v1/todo/my` | 我的任务列表 |
| GET | `/api/v1/todo/team` | 团队任务列表（支持 `reviewed_by_user_id` 过滤） |
| GET | `/api/v1/todo/badge-counts` | 侧边栏角标计数：`{my_active(我的 open+in_progress), team_pending_review(待我审核的 pending_review)}` |
| GET/PATCH | `/api/v1/todo/{todo_id}` | 任务详情/更新 |
| POST | `/api/v1/todo/{todo_id}/status` | 任务状态变更 |
| POST | `/api/v1/todo/{todo_id}/block` | 阻塞任务。`blocked_reason` 走**请求体**（兼容 query），必填 |
| POST | `/api/v1/todo/{todo_id}/dismiss` | 忽略任务。`dismiss_reason` 走**请求体**（兼容 query），可选 |
| POST | `/api/v1/todo/{todo_id}/images` | 上传任务图片 |
| GET | `/api/v1/todo/{todo_id}/images` | 列出任务全部图片（含 `download_path`） |
| GET | `/api/v1/todo/images` | 按 `todo_id` 或 `title`（任务名精确匹配）定位图片；同名多个返回候选列表 |
| GET | `/api/v1/todo/{todo_id}/images/{image_id}/download` | 下载任务图片 |
| DELETE | `/api/v1/todo/{todo_id}/images/{image_id}` | 删除任务图片 |

> **路由顺序**：字面量 `/todo/images` 必须声明在 `/todo/{todo_id}` 之前，否则会被 UUID 路径参数捕获。

**任务字段（v2.0.2 增补，2026-06-24）**：
- `description`（描述）：列类型 **`TEXT`**，上限 **1 万字符**（原 `varchar(255)`）；`TodoCreate`/`TodoUpdate` 加 `max_length=10000` 校验。
- `notes`（备注）：**新增**独立字段，列类型 `TEXT`，上限 2000 字符；create/update/response 全支持。与 Bug 专用的 `link.notes` 无关。
- ⚠️ 生产部署需手动 ALTER（`AUTO_CREATE` 只建新表不改列）：`ALTER TABLE todo_item MODIFY COLUMN description TEXT NULL;` 与 `ALTER TABLE todo_item ADD COLUMN notes TEXT NULL;`（迁移文件 `20260624_0001_todo_desc_text_and_notes.py`）。

**AI Agent 工作流**：AI 修复状态存储在 `TodoItem.link.agent_status` 字段（值为 `ai_fixing` / `ai_fixed`），与 `todo.status` 完全解耦。AI 只需关注 `agent_status`，不改变任务本身的状态。

**PATCH `/api/v1/todo/{todo_id}` 扩展字段**：
- `link`（dict）：合并更新任务的 link JSON 字段（如 `{"agent_status": "ai_fixed"}`），不会覆盖已有键
- `assignee_user_id`（int）：更新任务的执行人

**POST `/api/v1/todo` 项目关联扩展**（便于 AI Agent 一次创建项目任务）：
- `link.project_id` 或 `link.project_name`：解析项目后将任务设为 `source_type=PROJECT_TASK`、`source_id=project_id`，出现在该项目任务列表；`project_name` 需精确匹配，同名多个时报错要求改用 `project_id`；关联后调用 `sync_project_progress` 同步项目进度
- `link.dev_type`：任务类型（`dev_backend`/`dev_frontend`/`dev_ui`/`dev_product`/`other`），校验后写入 `tags` 与 `link.dev_type`，与项目页任务一致

**团队任务访问规则**：显示所有负责人不是当前用户的任务（`assignee_user_id != current_user`）。支持 `reviewed_by_user_id` 查询参数按审核人过滤，前端默认传当前用户 ID。

**通知安全规则**：所有状态变更端点（submit/approve/reject/block/reopen/updateStatus）中的通知调用（`_notify_user`/`_notify_manager`）均用 try/except 包裹，通知失败时 rollback 但不影响主操作响应。删除任务时的通知记录清理（`_delete_todo_and_notifications`）同样受 try/except 保护。

**编辑权限规则**：`_can_access_todo()` 检查 `assignee_user_id`、`creator_user_id`、`reviewed_by_user_id`、直属上级四个维度，前端 `canEditTodo()` 同步一致。

### Agent Token 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/agent-tokens` | 生成 Agent Token（名称、有效期）。Token 仅创建时返回明文 |
| GET | `/api/v1/auth/agent-tokens` | 列出当前用户的所有 Agent Token（token 仅显示 preview） |
| DELETE | `/api/v1/auth/agent-tokens/{token_id}` | 删除 Agent Token |

**Agent Token 认证**：请求头 `Authorization: Bearer pat_xxx`，后端识别 `pat_` 前缀后查表验证，映射到对应用户，权限与该用户一致。Token 过期或删除后立即失效。

#### 请假相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/todo/leaves` | 提交请假 |
| GET | `/api/v1/todo/leaves/my` | 我的请假记录 |
| GET | `/api/v1/todo/leaves/team/pending` | 待审批请假 |
| POST | `/api/v1/todo/leaves/{id}/approve` | 批准请假（同步 TodoItem 状态为 done） |
| POST | `/api/v1/todo/leaves/{id}/reject` | 驳回请假（同步 TodoItem 状态为 dismissed） |

### 合同管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST/GET/PATCH | `/api/v1/contract/counterparties` | 对手方 CRUD（含编辑） |
| POST/GET | `/api/v1/contract/contracts` | 合同创建/列表。`contract_no` 可选，缺省时后端自动生成 `CNT-<毫秒时间戳>-<随机>`（与前端页面 `CNT-<Date.now()>` 规则一致） |
| GET/PATCH | `/api/v1/contract/contracts/{id}` | 合同详情/更新 |
| POST | `/api/v1/contract/contracts/{id}/submit` | 提交合同 |
| GET | `/api/v1/contract/contracts/{id}/payment-plans` | 付款计划 |

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST/GET | `/api/v1/project/projects` | 项目创建/列表 |
| GET/PATCH/DELETE | `/api/v1/project/projects/{id}` | 项目详情/更新/删除 |
| GET/PATCH | `/api/v1/project/projects/{id}/stages` | 阶段列表/更新。**阶段须按序推进**：将某阶段置 `in_progress`/`done` 前，其所有 `sequence_no` 更小的前序阶段必须为 `done` 或 `skipped`，否则 400 拒绝；跳过须显式置 `skipped` |
| POST/GET/DELETE | `/api/v1/project/projects/{id}/attachments` | 项目附件 |
| POST/GET/DELETE | `/api/v1/project/projects/{id}/members` | 项目成员 |
| GET | `/api/v1/project/projects/{id}/todos` | 项目任务列表 |
| POST | `/api/v1/project/projects/{id}/todos/{todo_id}/assign` | 分配任务 |
| POST | `/api/v1/project/projects/{id}/todos/{todo_id}/plan` | 计划任务 |
| POST | `/api/v1/project/projects/{id}/todos/batch-assign` | 批量分配 |
| DELETE | `/api/v1/project/projects/{id}/todos/{todo_id}` | 删除项目任务 |
| DELETE | `/api/v1/project/projects/{id}/todos` | 清空项目任务 |
| POST | `/api/v1/project/projects/{id}/sync-dev-tasks` | 同步开发任务 |
| POST | `/api/v1/project/projects/{id}/generate-dev-tasks` | AI 生成开发任务 |
| GET | `/api/v1/project/projects/{id}/contract-context` | 合同上下文 |
| GET | `/api/v1/project/projects/{id}/acceptance-report/download` | 下载验收报告 |
| POST | `/api/v1/project/export_quote_excel` | 导出报价单 |
| GET | `/api/v1/project/feature-list-template` | 下载功能清单模板（带样式 Excel） |
| POST | `/api/v1/project/export-feature-list-excel` | 导出功能清单 Excel（带样式） |
| POST | `/api/v1/project/export-contract-docx` | 导出合同文档 |

### 财务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST/GET/PATCH | `/api/v1/finance/accounts` | 账户 CRUD |
| POST/GET/PATCH | `/api/v1/finance/transactions` | 交易记录 CRUD（支持全字段编辑，编辑后自动重算关联合同 pending_amount） |
| POST | `/api/v1/finance/transactions/{id}/void` | 作废交易（`voided=true`，仍展示但不计入账户余额，同步回退关联合同 pending_amount） |
| POST | `/api/v1/finance/transactions/{id}/unvoid` | 恢复已作废交易 |
| DELETE | `/api/v1/finance/transactions/{id}` | 删除已作废交易（仅 `voided=true` 可删除，正常交易需先作废） |
| GET | `/api/v1/finance/transactions` | 交易列表（支持 `date_from`/`date_to` 日期筛选 + `status` 状态筛选：unreconciled/completed/reconciled/voided，voided 独立、其余排除作废） |
| GET | `/api/v1/finance/transactions/export` | 导出交易记录 Excel（支持日期和状态筛选；Content-Disposition 使用 ASCII fallback + UTF-8 URL 编码文件名，避免中文文件名响应头报错） |
| POST/GET | `/api/v1/finance/invoices` | 发票 |
| POST/GET | `/api/v1/finance/reimbursements` | 报销 |

### AI 能力

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/ai/chat` | AI 对话（功能清单生成等） |
| POST | `/api/v1/ai/chat-stream` | AI 流式对话（合同起草等） |

### 企业大脑（Knowledge Base）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/v1/kb/documents/upload` | kb.write | 上传文档（multipart） |
| GET | `/api/v1/kb/documents` | kb.read | 文档列表（分页+筛选） |
| GET | `/api/v1/kb/documents/{id}` | kb.read | 文档详情 |
| PATCH | `/api/v1/kb/documents/{id}` | kb.write | 更新元数据 |
| DELETE | `/api/v1/kb/documents/{id}` | kb.write | 删除文档 |
| GET | `/api/v1/kb/documents/{id}/download` | kb.read | 下载原始文件 |
| POST | `/api/v1/kb/documents/{id}/reprocess` | kb.write | 重新解析 |
| GET | `/api/v1/kb/tags` | kb.read | 获取所有标签 |
| POST | `/api/v1/kb/conversations` | kb.write | 创建对话 |
| GET | `/api/v1/kb/conversations` | kb.read | 对话列表 |
| GET | `/api/v1/kb/conversations/{id}/messages` | kb.read | 对话消息 |
| DELETE | `/api/v1/kb/conversations/{id}` | kb.write | 删除对话 |
| POST | `/api/v1/kb/chat` | kb.write | RAG 对话（SSE 流式）。Body 字段为 **`message`**（非 `query`） |
| POST | `/api/v1/kb/search` | kb.read | 语义搜索。Body `{query, top_k, tags?}` |

> **嵌入服务降级**：`/kb/search`、`/kb/chat` 依赖嵌入服务（`embedding_service`，需 `GEMINI_API_KEY`）。未配置时 search 返回 `{results:[], available:false, message:...}`、chat 返回 `data:{"error":...}`，均不抛 500。（向量库重建/接入 LiteLLM 为后续事项。）

### 会议记录（Meeting）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/v1/meeting/records` | meeting.write | 创建会议（音频可选，支持 `meeting_date` 参数，无音频时状态直接 transcribed） |
| POST | `/api/v1/meeting/records/{id}/upload-audio` | meeting.write | 为无音频会议上传音频并触发 ASR；大文件/长音频会统一转为 16k 单声道 mp3 后按大小或 25 分钟时长切片，切片间保留 5 秒重叠并在合并转录段时去重，避免边界漏字与时间轴错位 |
| PATCH | `/api/v1/meeting/records/{id}/attendees` | meeting.write | 更新参会人员列表 |
| GET | `/api/v1/meeting/records` | meeting.read | 会议列表（支持 `search` 参数搜索标题和参会人） |
| GET | `/api/v1/meeting/records/{id}` | meeting.read | 会议详情 |
| DELETE | `/api/v1/meeting/records/{id}` | meeting.write | 删除会议 |
| GET | `/api/v1/meeting/records/{id}/status` | meeting.read | 轮询 ASR 状态 |
| GET | `/api/v1/meeting/records/{id}/transcript` | meeting.read | 获取转写分段 |
| PATCH | `/api/v1/meeting/records/{id}/transcript` | meeting.write | 批量更新分段文本和说话人（支持 `speaker_id`） |
| PUT | `/api/v1/meeting/records/{id}/speakers` | meeting.write | 更新说话人映射 |
| POST | `/api/v1/meeting/records/{id}/summarize` | meeting.write | AI 生成纪要（SSE，JSON body 支持 `prompt`/`previous_meeting_id`，无转录时可用自定义提示词作为会议内容生成纪要）。**仅当 LLM 实际产出内容才落库并置 SUMMARIZED；为空/失败时不改状态、不存空总结，SSE 返回 error**（避免"已总结但空"） |
| POST | `/api/v1/meeting/records/{id}/archive` | meeting.write | 归档到企业大脑 |
| GET | `/api/v1/meeting/records/{id}/audio` | meeting.read | 下载/播放音频 |

### 版本更新日志（Changelog）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/v1/changelog/entries` | 登录用户 | 版本日志列表（分页，按发布时间倒序） |
| POST | `/api/v1/changelog/entries` | L0 | 创建版本日志 |
| PATCH | `/api/v1/changelog/entries/{entry_id}` | L0 | 更新版本日志 |
| DELETE | `/api/v1/changelog/entries/{entry_id}` | L0 | 删除版本日志 |

**权限说明**：L0 指 `manager_user_id` 为空的顶级员工（最高管理层），仅 L0 可创建/编辑/删除日志条目。

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/` | 根路径 |
| GET | `/api/v1/mcp-info` | MCP 端点 URL + 工具列表（供前端 MCP 页面） |

---

## MCP 服务（`/api/v1/mcp`）

`backend/app/api/mcp_server.py` 用官方 **mcp SDK（FastMCP，Streamable HTTP）** 暴露精选工具，AI 客户端（Claude Desktop/Code、Cursor、Cherry Studio…）直连。

- **挂载**：`main.py` 用 `lifespan` 启动 `mcp.session_manager`，`app.mount("/api/v1/mcp", mcp.streamable_http_app())`（`streamable_http_path="/"`）。复用 nginx `/api/` 代理，生产无需改 nginx。
- **认证**：客户端发 `Authorization: Bearer pat_xxx`（复用 Agent Token）。工具从请求头取 token，用 `httpx` 携带该 token **转发本机 REST**（`settings.INTERNAL_API_BASE_URL`）——零逻辑重复，权限/通知/项目联动与页面一致。
- **依赖**：需 Python **3.10+**（生产原为 3.9，需升级）。`requirements.txt` 已 pin 协调集（fastapi 0.135.1 / starlette 0.52.1 / pydantic 2.12.5 / mcp 1.27.2）。
- **配置**：`INTERNAL_API_BASE_URL`（dev 15085 / prod 9086）、`MCP_PUBLIC_URL`（展示用）。
- **工具（28）**：读 `get_me`/`list_my_todos`/`get_todo`/`list_todo_images`/`list_my_leaves`/`list_projects`/`get_project`/`list_project_todos`/`list_contracts`/`list_counterparties`/`list_transactions`/`list_accounts`/`search_kb`/`list_meetings`；写 `create_todo`/`create_bug`（打 tags=bug+link.type=bug，进项目任务与 Bug 管理）/`create_transactions`/`void_transaction`/`unvoid_transaction`/`delete_voided_transaction`/`start_todo`/`submit_todo`/`block_todo`/`dismiss_todo`/`create_leave`；审核 `list_tasks_to_review`/`approve_todo`/`reject_todo`。
- **财务写入（v2.0.2 增补，2026-06-24）**：`list_accounts`（转发 `GET /finance/accounts`，取 `account_id`）+ `create_transactions(transactions: list[dict])` **批量写入交易明细**（逐条转发 `POST /finance/transactions`，字段白名单 `_TXN_ALLOWED_FIELDS`，`txn_direction` 按 `txn_type` 兜底推断，单条失败不中断整批，返回 `{total, created, failed, results[{index, success, id|error}]}`）。需 `finance.write` 权限。
- **财务交易作废工具（v2.0.3，2026-07-01）**：`list_transactions` 支持 `account_id`/`txn_direction`/`status`/日期/分页筛选，`status=voided` 可查看作废交易；`void_transaction`/`unvoid_transaction`/`delete_voided_transaction` 分别转发财务交易作废、恢复和删除已作废交易。写操作需 `finance.write` 权限。
- **mcp-info 元端点（v2.0.2 增补，2026-06-24）**：`GET /api/v1/mcp-info` 每个工具新增 **`doc`** 字段（完整 docstring），供前端工具详情页 `/mcp/tools/:name` 渲染；`description` 仍为首行用于列表。
- **运行环境**：dev 后端由 **PM2** 托管（`punkrecord-backend`，conda env `punkrecord`，`uvicorn --reload`），非 `dev.sh`（其指向的 `punk` env 为旧脚本）。

---

*最后更新：2026-07-01*
