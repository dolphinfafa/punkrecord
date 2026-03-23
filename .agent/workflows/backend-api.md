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
| `finance.py` | `/api/v1/finance` | 财务管理（账户、交易、发票、报销） |
| `ai.py` | `/api/v1/ai` | AI 能力（对话、流式响应） |
| `kb.py` | `/api/v1/kb` | 企业大脑（文档管理、RAG 对话、语义搜索） |
| `meeting.py` | `/api/v1/meeting` | 会议记录（音频上传、ASR 转写、AI 总结、归档） |

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
| POST | `/api/v1/todo` | 创建任务 |
| GET | `/api/v1/todo/my` | 我的任务列表 |
| GET | `/api/v1/todo/team` | 团队任务列表 |
| GET/PATCH | `/api/v1/todo/{todo_id}` | 任务详情/更新 |
| POST | `/api/v1/todo/{todo_id}/status` | 任务状态变更 |
| POST | `/api/v1/todo/{todo_id}/images` | 上传任务图片 |
| GET | `/api/v1/todo/{todo_id}/images/{image_id}/download` | 下载任务图片 |
| DELETE | `/api/v1/todo/{todo_id}/images/{image_id}` | 删除任务图片 |

**AI Agent 工作流**：状态接口支持 `ai_fixing` 和 `ai_fixed` 状态，用于 AI 驱动的 Bug 修复流程。

**团队任务访问规则**：显示当前用户创建但分配给他人的任务，或当前用户是审核员的任务。自指派任务（creator==assignee 且无审核员）不在团队列表展示。

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
| POST/GET | `/api/v1/contract/contracts` | 合同创建/列表 |
| GET/PATCH | `/api/v1/contract/contracts/{id}` | 合同详情/更新 |
| POST | `/api/v1/contract/contracts/{id}/submit` | 提交合同 |
| GET | `/api/v1/contract/contracts/{id}/payment-plans` | 付款计划 |

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST/GET | `/api/v1/project/projects` | 项目创建/列表 |
| GET/PATCH/DELETE | `/api/v1/project/projects/{id}` | 项目详情/更新/删除 |
| GET/PATCH | `/api/v1/project/projects/{id}/stages` | 阶段列表/更新 |
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
| POST/GET/PATCH | `/api/v1/finance/transactions` | 交易记录 CRUD |
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
| POST | `/api/v1/kb/chat` | kb.write | RAG 对话（SSE 流式） |
| POST | `/api/v1/kb/search` | kb.read | 语义搜索 |

### 会议记录（Meeting）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/v1/meeting/records` | meeting.write | 上传音频创建会议（支持 `meeting_date` 参数，默认今天） |
| GET | `/api/v1/meeting/records` | meeting.read | 会议列表（支持 `search` 参数搜索标题和参会人） |
| GET | `/api/v1/meeting/records/{id}` | meeting.read | 会议详情 |
| DELETE | `/api/v1/meeting/records/{id}` | meeting.write | 删除会议 |
| GET | `/api/v1/meeting/records/{id}/status` | meeting.read | 轮询 ASR 状态 |
| GET | `/api/v1/meeting/records/{id}/transcript` | meeting.read | 获取转写分段 |
| PATCH | `/api/v1/meeting/records/{id}/transcript` | meeting.write | 批量更新分段文本和说话人（支持 `speaker_id`） |
| PUT | `/api/v1/meeting/records/{id}/speakers` | meeting.write | 更新说话人映射 |
| POST | `/api/v1/meeting/records/{id}/summarize` | meeting.write | AI 生成纪要（SSE，JSON body 支持 `prompt`/`previous_meeting_id`，总结后自动提取参会人） |
| POST | `/api/v1/meeting/records/{id}/archive` | meeting.write | 归档到企业大脑 |
| GET | `/api/v1/meeting/records/{id}/audio` | meeting.read | 下载/播放音频 |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/` | 根路径 |

---

*最后更新：2026-03-23*
