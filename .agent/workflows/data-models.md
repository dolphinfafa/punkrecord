# 数据模型

> 本文档描述后端数据库的模型定义和分组。属于 `project-index.md` 的子文档。
> 详细的数据库设计（字段、类型、关系图）请参阅 `project-overview.md` 第 5 章。
>
> **数据库**：MySQL 8.0（`pymysql` 驱动），User 表名为 `users`（避免 MySQL 保留字冲突）。

---

## 1. 模型文件

模型文件位于 `backend/app/models/` 目录：

| 文件 | 内容 |
|------|------|
| `base.py` | 共享基础模型字段（`id`, `created_at`, `updated_at`） |
| `iam.py` | 用户（含个人档案）、部门/组织单元、职位、职位权限、实体、成员关系、学历枚举 |
| `todo.py` | 任务项、请假申请 |
| `project.py` | 项目、阶段、成员、项目相关结构 |
| `contract.py` | 合同、对手方、付款计划 |
| `finance.py` | 财务账户、交易记录、发票、报销 |
| `approval.py` | 审批相关模型 |
| `shared.py` | 共享/通用模型 |
| `kb.py` | 企业大脑（知识库文档、文档切片、对话、消息） |
| `meeting.py` | 会议记录（会议主表、转写分段） |

## 2. 模型分组

### 组织管理（IAM）

| 模型 | 说明 |
|------|------|
| `User` | 用户（含个人档案、请假额度、Beli 积分、首次登录状态） |
| `OrgUnit` | 部门（树形自引用） |
| `JobTitle` | 职位 |
| `JobTitlePermission` | 职位-权限关联表 |
| `OurEntity` | 我方实体（公司/分支/工作室） |
| `OrgMembership` | 组织成员关系 |
| `Role` | 角色 |
| `Permission` | 权限 |
| `UserRole` | 用户-角色关联 |
| `RolePermission` | 角色-权限关联 |

### 任务管理（Todo）

| 模型 | 说明 |
|------|------|
| `TodoItem` | 任务项（含状态机、图片附件） |
| `LeaveRequest` | 请假申请 |

### 项目管理

| 模型 | 说明 |
|------|------|
| `Project` | 项目（our_entity_id 可选） |
| `ProjectStage` | 项目阶段 |
| `ProjectMember` | 项目成员 |

### 合同管理

| 模型 | 说明 |
|------|------|
| `Contract` | 合同 |
| `Counterparty` | 对手方 |
| `ContractPaymentPlan` | 付款计划 |

### 财务管理

| 模型 | 说明 |
|------|------|
| `FinanceAccount` | 财务账户 |
| `FinanceTransaction` | 交易记录 |
| `FinanceInvoice` | 发票 |
| `Reimbursement` | 报销 |

### 企业大脑（Knowledge Base）

| 模型 | 说明 |
|------|------|
| `KBDocument` | 知识库文档（标题、文件、状态、标签、AI摘要、切片数） |
| `KBDocumentChunk` | 文档切片（文本内容、token数、ChromaDB ID） |
| `KBConversation` | RAG 对话会话 |
| `KBMessage` | 对话消息（用户/助手、引用信息） |

### 会议记录（Meeting）

| 模型 | 说明 |
|------|------|
| `MeetingRecord` | 会议主表（音频文件、ASR状态、说话人映射、AI纪要、归档文档ID、会议日期、参会人员） |
| `MeetingTranscriptSegment` | 转写分段（说话人、时间范围、文本内容） |

---

*最后更新：2026-03-20*
