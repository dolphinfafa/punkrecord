# 财务模块 PRD/功能与技术规格说明（V1.0）
> 面向：研发团队 / AI 编程工具  
> 版本：V1.0（2026-01-12）  
> 依赖：IAM（用户/主体/审批）+ File Service + AuditLog +（可选）Todo（OCR复核事项）  
> 说明：财务模块不生成开票/付款提醒；提醒由合同模块根据分期/验收生成 Todo。

---

## 0. 目标（V1）
1) 入账管理：公账/私账（股东个人账户）多账户与流水录入。  
2) 发票管理：支持上传PDF/图片自动OCR识别、人工确认入台账。  
3) 开票流程：开票申请 -> 审批 -> 开票 -> 归档。  
4) 报销流程：提交 -> 审批 -> 付款生成流水 -> 归档。  
5) 与合同打通：流水关联合同分期回写 paid_amount/status；发票/开票申请关联合同/分期。

---

## 1. 权限要求（关键约束）
- `finance` 与 `shareholder` 可查看**全部账务明细**（含公账与私账）。
- 私账账户必须绑定股东用户（IAM.user.is_shareholder=true）。

---

## 2. 数据模型

### 2.1 账户 finance_account
**表：`finance_account`**
- `account_id` PK
- `our_entity_id` 必填
- `account_category` 必填：`public|private`
- `account_name` 必填
- `bank_name/bank_branch` 选填
- `account_no_encrypted/account_no_masked` 选填
- `currency` 必填
- `status` 必填：`active|inactive`
- `is_default` 默认 false
- 私账：`shareholder_user_id` 必填

### 2.2 流水 finance_transaction
**表：`finance_transaction`**
- `txn_id` PK
- `our_entity_id` 必填
- `account_id` 必填
- `txn_direction` 必填：`in|out`
- `amount/currency/txn_date` 必填
- `counterparty_id` 选填
- `purpose/channel/reference_no` 选填
- `attachments` 选填
- `reconcile_status` 必填：`unreconciled|reconciled`
- `related_object_type/related_object_id` 选填
- `created_by_user_id` 必填
- `created_at`, `updated_at`

### 2.3 发票 finance_invoice（含OCR）
**表：`finance_invoice`**
- `invoice_id` PK
- `our_entity_id` 必填
- `invoice_kind` 必填：`output|input`
- `invoice_medium` 必填：`paper|electronic`
- `invoice_no/issue_date/amount_with_tax` 等字段
- `files` 必填
- `ocr_status`：`pending|processing|succeeded|failed|needs_review`
- `ocr_confidence/ocr_raw_result/ocr_extracted_fields` 选填
- `related_contract_id/related_payment_plan_id` 选填
- `created_at`, `updated_at`

### 2.4 开票申请 invoice_request（审批对象）
**表：`invoice_request`**
- `request_id` PK
- `our_entity_id` 必填
- `contract_id/payment_plan_id` 选填
- `requester_user_id` 必填
- `amount_with_tax` 必填
- `status`：`draft|in_approval|approved|issued|rejected|cancelled`
- `issued_invoice_id` 选填
- `created_at`, `updated_at`

### 2.5 报销 reimbursement（审批对象）
**表：`reimbursement`**
- `reim_id` PK
- `our_entity_id` 必填
- `requester_user_id` 必填
- `project_id/contract_id` 选填
- `total_amount` 必填
- `expense_lines` 必填（含附件）
- `status`：`draft|in_approval|approved|paid|rejected|cancelled`
- `paid_txn_id` 选填
- `created_at`, `updated_at`

---

## 3. OCR规则（必须）
- 置信度阈值默认0.85；低于阈值或字段缺失 -> needs_review
- 人工确认与修正必须写审计
- 可选生成 review 类 todo（不属于提醒，只是处理入口）

---

## 4. 核心流程（必须）

### 4.1 流水与分期回写（与合同打通）
- 流水关联 `contract_payment_plan.plan_id`：
  - 校验方向一致（receivable->in, payable->out）
  - 回写 paid_amount/paid_at/status
  - 触发合同资金进度重算

### 4.2 开票流程
- 发起开票申请 -> 审批（Approval Engine + Todo） -> 财务开票 -> 发票归档（OCR） -> 申请置 issued

### 4.3 报销流程
- 提交 -> 审批（Approval Engine + Todo） -> 出纳付款生成 out 流水并关联 -> 报销置 paid

---

## 5. 验收标准（UAT）
- UAT-FIN-001：公账/私账多账户可用；私账绑定股东用户。
- UAT-FIN-002：finance与shareholder可查看全部财务明细。
- UAT-FIN-003：流水关联合同分期回写正确，合同资金进度联动更新。
- UAT-FIN-004：发票上传OCR识别可用；needs_review可人工确认入台账并审计。
- UAT-FIN-005：开票申请/报销审批与Todo联动跑通。
- UAT-FIN-006：财务模块不生成付款/开票提醒待办。

---
