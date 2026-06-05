# API 参考

基地址：`http://14.103.229.153:15085/api/v1`

所有请求需携带 `Authorization: Bearer pat_xxx` 头。

## 权限模型

- **读操作（GET 列表/详情）对任意有效 Token 开放**（如项目列表、交易方列表、任务列表等）。
- **写操作（创建/更新/状态流转/删除）需要对应模块的 `*.write` 权限**（如 `project.write`、`contract.write`、`finance.write`、`todo.write`）。无权限时返回 `code:403, Missing permission: xxx`。
- 部分读接口需对应 `*.read` 权限（如合同 `contract.read`、财务 `finance.read`、知识库 `kb.read`）。先调 `GET /auth/me` 查看当前 Token 的 `permissions`。

---

## 认证 (/auth)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /auth/me | 获取当前用户信息和权限 |

## 待办事项 (/todo)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /todo/my | 我的任务列表。参数：`status`(open/in_progress/pending_review/done/blocked/dismissed), `page`, `page_size` |
| GET | /todo/team | 团队任务。参数：`status`, `reviewed_by_user_id`, `page`, `page_size` |
| GET | /todo/{id} | 任务详情（图片元数据在 `link.todo_images[]`，含 `id`） |
| GET | /todo/{id}/images | 列出任务全部图片。返回每张 `{id, file_name, content_type, download_path}` |
| GET | /todo/images | 按任务定位图片。参数二选一：`todo_id` 或 `title`（任务名精确匹配；多条返回候选列表） |
| GET | /todo/{id}/images/{image_id}/download | 下载某张任务图片（返回图片文件本体） |
| POST | /todo | 创建任务。见下方"创建任务"详解 |
| PATCH | /todo/{id} | 更新任务。Body: `{title, description, priority, due_at, assignee_user_id, tags, link}` |
| POST | /todo/{id}/start | 开始任务（open → in_progress） |
| POST | /todo/{id}/submit | 提交完成（→ pending_review 或自动 done） |
| POST | /todo/{id}/approve | 审核通过（→ done）。Body: `{comment}` |
| POST | /todo/{id}/reject | 审核驳回（→ open）。Body: `{comment}` |
| POST | /todo/{id}/block | 阻塞。**Body**: `{"blocked_reason": "原因"}`（必填） |
| POST | /todo/{id}/dismiss | 忽略。**Body**: `{"dismiss_reason": "原因"}`（可选） |
| POST | /todo/{id}/done | 直接完成 |

### 创建任务 `POST /todo`

Body 字段：
- `title`（必填）、`assignee_user_id`（必填，分配给谁）
- `priority`（p0-p3，默认 p2）、`due_at`、`start_at`、`description`
- `source_type`（默认 `custom`）、`action_type`（默认 `do`）
- `tags`：字符串数组，任务标签
- `link`：可选对象，支持关联项目：
  - `link.project_id` 或 `link.project_name`：把任务关联到项目（成为该项目的任务，出现在项目任务列表）。`project_name` 需精确匹配；同名多个时改用 `project_id`。
  - `link.dev_type`：任务类型，取值 `dev_backend`/`dev_frontend`/`dev_ui`/`dev_product`/`other`。设置后会写入 `tags` 与 `link.dev_type`（与项目页任务一致）。
  - `link.reviewer_user_id`：指定审核人。

> 关联项目时无需多轮对话：直接在 `link` 里给出 `project_name`（或 `project_id`）和 `dev_type` 即可一次创建项目任务。

### 请假

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /todo/leaves | 提交请假。Body: `{leave_type(annual/maternity/marriage/personal/sick), start_at, end_at, reason}` |
| GET | /todo/leaves/my | 我的请假记录。参数：`status`, `page`, `page_size` |
| GET | /todo/leaves/team/pending | 待审批请假（管理者） |
| POST | /todo/leaves/{id}/approve | 批准请假 |
| POST | /todo/leaves/{id}/reject | 驳回请假。Body: `{comment}` |

## 项目管理 (/project)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /project/projects | 项目列表。参数：`status`, `page`, `page_size` |
| GET | /project/projects/{id} | 项目详情 |
| GET | /project/projects/{id}/stages | 项目阶段列表 |
| PATCH | /project/projects/{id}/stages/{stage_id} | 更新阶段（需 `project.write`）。Body: `{status, skip_reason, blocked_reason, deliverables, ...}`。**阶段须按序推进**：把某阶段置 `in_progress`/`done` 前，其所有前序阶段必须为 `done` 或 `skipped`，否则被拒。要跳过前序阶段须显式将其置为 `skipped` |
| GET | /project/projects/{id}/members | 项目成员 |
| GET | /project/projects/{id}/todos | 项目任务列表 |
| POST | /project/projects | 创建项目。Body: `{name, project_type(B2B/B2C), pm_user_id, ...}` |
| PATCH | /project/projects/{id} | 更新项目 |

## 合同管理 (/contract)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /contract/contracts | 合同列表（需 `contract.read`） |
| GET | /contract/contracts/{id} | 合同详情（需 `contract.read`） |
| GET | /contract/counterparties | 对手方列表（任意 Token 可读） |
| POST | /contract/contracts | 创建合同（需 `contract.write`）。`contract_no` **可选**，不传时后端自动生成 `CNT-<时间戳>`（与页面规则一致）。其余必填：`name, contract_type(sales/purchase/third_party), party_a_id, party_b_id, amount_total`。注意 `party_a_id`/`party_b_id` 均为**对手方(counterparty) id** |

## 财务管理 (/finance)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /finance/accounts | 账户列表 |
| GET | /finance/transactions | 交易记录。参数：`date_from`, `date_to`, `page`, `page_size` |
| GET | /finance/invoices | 发票列表 |

## 会议记录 (/meeting)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /meeting/records | 会议列表。参数：`search`, `page`, `page_size` |
| GET | /meeting/records/{id} | 会议详情 |
| GET | /meeting/records/{id}/transcript | 转录分段 |

## 知识库 (/kb)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /kb/documents | 文档列表 |
| POST | /kb/search | 语义搜索（需 `kb.read`）。Body: `{query, top_k, tags?}`。响应含 `available` 字段：嵌入服务未配置时返回 `available:false` 与提示，不报错 |
| POST | /kb/chat | RAG 对话（SSE，需 `kb.write`）。Body: `{message, conversation_id?, document_ids?}`（注意字段是 **`message`** 不是 `query`）。SSE 行格式 `data:{"text":"..."}`，结束 `data:[DONE]` |

> 注意：知识库语义检索/RAG 依赖后端嵌入服务。若后端未配置嵌入服务，`/kb/search` 返回空结果与提示、`/kb/chat` 返回 `data:{"error":"..."}`，均不会 500。

## 组织管理 (/iam)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /iam/users | 用户列表 |
| GET | /iam/users/{id} | 用户详情 |
| GET | /iam/departments | 部门树 |
| GET | /iam/job-titles | 职位列表 |
| GET | /iam/org-chart | 组织架构图 |
| GET | /iam/our-entities | 实体列表 |

## 版本日志 (/changelog)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /changelog/entries | 版本更新日志列表 |
