# IAM（人员与权限）模块 PRD/技术规格（V1.0）
> 面向：研发团队 / AI编程工具  
> 版本：V1.0（2026-01-12）  
> 目标：提供全系统统一的身份、组织、角色、权限与多主体（our_entity）能力；提供通用审批引擎数据结构；为所有模块提供鉴权依据。

---

## 0. 目标与范围

### 0.1 目标（V1）
- 用户管理：创建/停用用户、基础信息、登录标识（邮箱/手机号/用户名）占位。
- 组织与团队（轻量）：部门/团队结构，用于默认审批人与统计。
- 多主体 our_entity：支持我方多公司主体及主体级配置（财务、印章、默认审批人）。
- RBAC 权限：角色、权限点、用户-角色绑定；支持按主体范围授权。
- 通用审批引擎：用于合同审批、开票申请审批、报销审批等。

### 0.2 非目标（V1不做）
- 不做复杂SSO/OIDC实现细节（提供接口与字段占位）。
- 不做ABAC/策略引擎（V1用RBAC + 主体范围）。
- 不做组织架构同步（企业微信/飞书），预留接口。

---

## 1. 核心概念

### 1.1 用户 user
- 系统中的自然人账号；可拥有多个角色。
- 可被分配Todo、可作为审批人/负责人/经办人。

### 1.2 我方主体 our_entity
- 公司主体（可能多个）：合同签署主体、收付款主体、开票主体等。
- 权限可按主体范围授予（V1最小实现）。

### 1.3 角色 role 与权限 permission
- permission = 原子权限点（如 `contract.contract.create`、`finance.transaction.read`）
- role = 权限集合（如 `finance`、`pm`）

### 1.4 授权 scope
V1 scope：
- `global`：全局（跨主体）
- `our_entity:<built-in function id>`：指定主体
- `all_entities`：所有主体

---

## 2. 数据模型（V1完整字段）

### 2.1 我方主体 our_entity
**表：`our_entity`**
- `our_entity_id` (uuid) PK
- `name` (string) 必填
- `type` (enum) 选填：`company|branch|studio|other`
- `legal_name` (string) 选填
- `uscc` (string) 选填
- `address` (string) 选填
- `default_currency` (string) 必填（默认 CNY）
- `status` (enum) 必填：`active|inactive`

主体级绑定（默认人员）：
- `default_finance_user_id` (uuid) 选填
- `default_cashier_user_id` (uuid) 选填
- `default_seal_admin_user_id` (uuid) 选填
- `default_legal_user_id` (uuid) 选填
- `created_at`, `updated_at`

规则：
- R-ENT-001：合同/财务/项目记录必须绑定 `our_entity_id`。
- R-ENT-002：主体停用不影响历史数据查询，但禁止新建业务记录绑定该主体。

---

### 2.2 用户 user
**表：`user`**
- `user_id` (uuid) PK
- `display_name` (string) 必填
- `email` (string) 选填（可作为登录标识）
- `phone` (string) 选填
- `username` (string) 选填
- `status` (enum) 必填：`active|inactive`
- `is_shareholder` (bool) 默认 false
- `created_at`, `updated_at`

规则：
- R-USER-001：用户停用后不可被分配新任务/新审批，但历史记录保留。
- R-USER-002：股东用户 `is_shareholder=true` 可被私账账户绑定（finance_account.shareholder_user_id）。

---

### 2.3 组织结构（轻量）
**表：`org_unit`**
- `org_unit_id` (uuid) PK
- `name` (string) 必填
- `parent_org_unit_id` (uuid) 选填
- `created_at`, `updated_at`

**表：`org_membership`**
- `org_membership_id` PK
- `user_id` fk
- `org_unit_id` fk
- `title` (string) 选填
- `is_manager` (bool) 默认 false
- `created_at`, `updated_at`

---

### 2.4 权限 permission
**表：`permission`**
- `permission_id` PK
- `code` (string) 唯一必填（如 `contract.contract.read`）
- `name` (string) 必填
- `module` (string) 必填：`iam|todo|contract|project|finance`
- `created_at`, `updated_at`

### 2.5 角色 role
**表：`role`**
- `role_id` PK
- `code` (string) 唯一必填（如 `finance`）
- `name` (string) 必填
- `created_at`, `updated_at`

**表：`role_permission`**
- `role_permission_id` PK
- `role_id` fk
- `permission_id` fk

### 2.6 用户角色绑定 user_role（含scope）
**表：`user_role`**
- `user_role_id` PK
- `user_id` fk
- `role_id` fk
- `scope_type` (enum) 必填：`global|our_entity|all_entities`
- `our_entity_id` (uuid) 选填（当 scope_type=our_entity 必填）
- `created_at`, `updated_at`

---

## 3. 预置角色与权限点（V1建议）

### 3.1 预置角色（可由管理员维护）
- `admin`：系统管理员
- `finance`：财务
- `cashier`：出纳
- `shareholder`：股东（全账务查看）
- `pm`：项目经理
- `owner`：业务负责人/销售经办
- `employee`：普通员工
- `approver`：审批人（可叠加）
- `legal`：法务
- `seal_admin`：印章管理员

### 3.2 关键权限要求（强约束）
- `finance` 与 `shareholder` 必须拥有：`finance.*.read`（账户/流水/发票/报销/开票申请）
- 写权限默认仅 `finance/cashier/admin`，业务人员仅可发起申请（开票/报销）。

---

## 4. 通用审批引擎（Approval Engine）

### 4.1 数据模型
**表：`approval_instance`**
- `approval_id` (uuid) PK
- `object_type` (enum) 必填：`contract|invoice_request|reimbursement|custom`
- `object_id` (uuid) 必填
- `flow_code` (string) 必填（如 `contract_v1`）
- `status` (enum) 必填：`pending|approved|rejected|cancelled`
- `current_step_no` (int) 必填
- `created_by_user_id` (uuid) 必填
- `created_at`, `updated_at`

**表：`approval_step`**
- `step_id` (uuid) PK
- `approval_id` fk
- `step_no` (int) 必填
- `step_name` (string) 必填
- `approver_user_id` (uuid) 必填（V1单人审批）
- `status` (enum) 必填：`pending|approved|rejected|skipped`
- `acted_at` (datetime) 选填
- `comment` (string) 选填（驳回必填）
- `created_at`, `updated_at`

### 4.2 流程配置（Admin）
**表：`approval_flow`**
- `flow_id` PK
- `flow_code` (string) 唯一必填
- `name` (string) 必填
- `object_type` (enum) 必填
- `steps` (array<json>) 必填
  - `step_no`, `step_name`, `approver_resolver`（固定人/按主体默认/按组织负责人）
- `is_active` (bool) 默认 true
- `created_at`, `updated_at`

### 4.3 与Todo联动（必须）
- 为每个 pending 的 approval_step 创建 todo_item（source_type=approval_step, action_type=approve）。
- step 通过/驳回后自动关闭对应 todo_item（done/dismissed）。

---

## 5. 页面与API（V1最小）
页面：
- 用户管理、角色权限、主体管理、审批流配置

API建议：
- `GET/POST /iam/users`
- `GET/POST /iam/roles`
- `GET/POST /iam/permissions`
- `POST /iam/user-roles`
- `GET/POST /iam/our-entities`
- `GET/POST /iam/approval-flows`

---

## 6. 验收标准（UAT）
- UAT-IAM-001：用户创建/停用生效；停用用户不可被分配新Todo。
- UAT-IAM-002：角色/权限/用户角色绑定可用且鉴权生效。
- UAT-IAM-003：多主体可配置且业务记录必须绑定主体。
- UAT-IAM-004：审批流可配置并驱动审批实例；审批待办生成与关闭正确。

---
