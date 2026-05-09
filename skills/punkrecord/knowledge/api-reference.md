# API 参考

基地址：`http://14.103.229.153:15085/api/v1`

所有请求需携带 `Authorization: Bearer pat_xxx` 头。

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
| GET | /todo/{id} | 任务详情 |
| POST | /todo | 创建任务。Body: `{title, assignee_user_id, priority(p0-p3), due_at, description, source_type(custom), action_type(do)}` |
| PATCH | /todo/{id} | 更新任务。Body: `{title, description, priority, due_at, assignee_user_id}` |
| POST | /todo/{id}/start | 开始任务（open → in_progress） |
| POST | /todo/{id}/submit | 提交完成（→ pending_review 或自动 done） |
| POST | /todo/{id}/approve | 审核通过（→ done）。Body: `{comment}` |
| POST | /todo/{id}/reject | 审核驳回（→ open）。Body: `{comment}` |
| POST | /todo/{id}/block | 阻塞。参数: `blocked_reason` |
| POST | /todo/{id}/dismiss | 忽略。参数: `dismiss_reason` |
| POST | /todo/{id}/done | 直接完成 |

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
| GET | /project/projects/{id}/members | 项目成员 |
| GET | /project/projects/{id}/todos | 项目任务列表 |
| POST | /project/projects | 创建项目。Body: `{name, project_type(B2B/B2C), pm_user_id, ...}` |
| PATCH | /project/projects/{id} | 更新项目 |

## 合同管理 (/contract)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /contract/contracts | 合同列表 |
| GET | /contract/contracts/{id} | 合同详情 |
| GET | /contract/counterparties | 对手方列表 |

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
| POST | /kb/search | 语义搜索。Body: `{query, top_k}` |
| POST | /kb/chat | RAG 对话（SSE）。Body: `{query, conversation_id}` |

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
