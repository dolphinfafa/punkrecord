# 合同管理模块 PRD/功能与技术规格说明（V1.0）
> 面向：研发团队 / AI 编程工具  
> 目标：阅读后可直接拆分任务并开始实现  
> 版本：V1.0（2026-01-12）  
> 依赖：IAM（用户/角色/主体/审批流）+ Todo（待办）+ File Service + AuditLog  
> 说明：本PRD已与项目/财务/待办模块对齐口径（字段命名、审批、待办、联动关系）

---

## 0. 背景与目标

### 0.1 目标（V1）
- 支持合同三类型：销售合同、采购合同、第三方合同。
- 支持合同创建、审批、签署、履约、验收、归档的全流程。
- 支持分期收/付款、合同资金进度展示，并与财务流水打通回写。
- 支持多我方主体（our_entity），按主体进行审批/印章/统计。
- 支持 AI 合同生成与 AI 初步审核（完整性/矛盾/不利条款提示）。
- 支持尾款待办：到期前30天生成销售经办待办（Todo）。

### 0.2 非目标（V1不做）
- 不做 OCR（扫描版PDF强依赖）；V1仅支持可复制文本PDF/DOCX，OCR作为V1.1。
- 不做电子签深度集成（预留接口）。

---

## 1. 状态机与类型

### 1.1 合同类型 contract_type
- `sales|purchase|third_party`

### 1.2 合同状态 contract_status
- `draft|in_approval|approved|signed|in_delivery|accepted|archived|cancelled`

---

## 2. 数据模型（核心）

### 2.1 合同 contract
**表：`contract`**
- `contract_id` (uuid) PK
- `our_entity_id` (uuid) 必填
- `contract_no` (string) 唯一
- `name` (string) 必填
- `contract_type` (enum) 必填
- `status` (enum) 必填
- `owner_user_id` (uuid) 必填
- `pm_user_id` (uuid) 选填
- `counterparty_id` (uuid) 必填
- `amount_total` (decimal) 必填
- `currency` (string) 必填
- `sign_date` (date) 选填
- `effective_date` (date) 选填
- `expire_date` (date) 选填
- `summary` (text) 选填
- `content_doc` (text) 选填（Markdown）
- `attachments` (array<json>) 选填
- `created_at`, `updated_at`

### 2.2 对方主体 counterparty
**表：`counterparty`**
- `counterparty_id` (uuid) PK
- `name` 必填
- `type` 必填：`customer|supplier|partner|other`
- `identifier/address/contacts` 选填
- `created_at`, `updated_at`

### 2.3 分期 contract_payment_plan
**表：`contract_payment_plan`**
- `plan_id` PK
- `contract_id` fk
- `sequence_no` 必填
- `direction` 必填：`receivable|payable`
- `name` 必填
- `amount` 必填
- `due_at` 选填
- `is_final` 默认 false
- `paid_amount` 默认 0
- `paid_at` 选填
- `status` 必填：`pending|due|overdue|completed`
- `created_at`, `updated_at`

### 2.4 合同-项目关联
**表：`project_contract_link`**（或使用项目表 contract_id）
- `link_id` PK
- `project_id` fk
- `contract_id` fk
- `created_at`

---

## 3. 核心流程（必须实现）

### 3.1 合同创建（手工/AI）
- 手工创建 draft
- AI生成：
  - 输入：主体/甲乙方映射/对方主体/金额/描述
  - 输出：content_doc + 分期建议（结构化）

### 3.2 合同审批（复用Approval Engine + Todo）
- submit -> status=in_approval
- 生成 approval_instance/steps
- 步骤产生审批Todo
- 通过 -> status=approved；驳回 -> status=draft（保留意见）

### 3.3 签署与归档
- approved 后上传签署版/盖章版 -> signed
- seal_admin 归档 -> archived

### 3.4 尾款Todo（必须）
- 条件：存在 plan.is_final=true 且 due_at
- 规则：在 due_at - 30天 创建 todo_item（source_type=contract_reminder, source_id=plan_id, assignee=owner_user_id, due_at=due_date）
- due_at 变更时更新，不重复生成；分期完成时关闭待办。

---

## 4. AI初步审核（对方出具合同）
- 输入：可复制文本PDF/DOCX 或文本粘贴
- 输出：
  - 信息完整性检查（主体/金额/期限/付款/验收/违约/争议解决等）
  - 前后矛盾检查
  - 不利条款提示（仅提示，不下法律结论）
- 结果：结构化 JSON + Markdown 报告，可人工确认并写入审计。

---

## 5. 合同进度展示
- 资金进度：sum(paid_amount)/amount_total
- 履约进度：按状态映射（V1粗粒度）

---

## 6. 与财务/项目/待办联动
- 财务：流水关联合同分期回写 paid_amount/status；发票/开票申请可关联合同/分期
- 项目：B端项目可绑定合同；合同签署可推进项目“签合同”阶段
- 待办：尾款提醒、审批待办均统一进入Todo

---

## 7. 页面（V1最小）
- 合同列表（筛选+资金进度）
- 合同详情（基本信息/正文/附件/分期/审批/关联项目/关联发票与流水）
- 合同创建/编辑（含AI生成入口）
- AI审核报告页

---

## 8. 验收标准（UAT）
- UAT-CT-001：三类合同创建/编辑可用，多主体必选。
- UAT-CT-002：审批流与审批Todo跑通。
- UAT-CT-003：分期与财务回写跑通，资金进度自动计算。
- UAT-CT-004：尾款待办按规则生成与更新。
- UAT-CT-005：合同与项目可互相反查。

---
