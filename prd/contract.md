# 合同管理模块 PRD/功能与技术规格说明（V1.0）
> 面向：研发团队 / AI 编程工具  
> 目标：阅读后可直接拆分任务并开始实现  
> 语言：中文（字段名/枚举提供英文 code 便于编码）  
> 版本：V1.0（2026-01-08）

---

## 0. 背景与目标

### 0.1 背景
企业需要将合同全生命周期在线化、可视化、流程化，并且不增加员工负担，提升交付与收付效率。

### 0.2 目标（V1）
- 支持合同三类型：销售合同、采购合同、第三方合同。
- 支持分期收/付款、合同进度展示（资金进度 + 履约进度）。
- 支持多“我方主体”（多法务/多收付款/多印章/多开票抬头）。
- 在项目验收后自动生成尾款提醒：尾款到期前 30 天通知销售（或经办人）。
- 提供 AI 助手：
  1) 我方出具合同时 AI 生成合同草稿（无模板条件下可落地）
  2) 对方出具合同时 AI 初审（信息完整性/前后矛盾/明显不利条款）

### 0.3 非目标（V1 不做）
- 不做复杂法务条款库运营（仅提供“骨架 + 默认条款块”，后续迭代）。
- 不做 OCR（扫描版 PDF）强依赖（V1 先支持 DOCX/可复制文本 PDF；OCR 作为 V1.1）。
- 不做外部电子签平台深度集成（可留接口，V1 先做附件归档与签署状态）。
- 不做高级里程碑权重/工时核算（履约进度先用简单法）。

---

## 1. 设计原则（必须遵守）
- P1：不增加员工负担（默认值、自动带出、一次录入多处复用）
- P2：流程在后台，体验在前台（用户只看到“待办/下一步”）
- P3：强审计留痕（合同、审批、提醒、AI 输出均可追溯）
- P4：可配置但不复杂（V1 以管理员配置少量关键参数为主）

---

## 2. 术语与角色

### 2.1 合同类型（contract_type）
- `sales`：销售合同（我方收款）
- `purchase`：采购合同（我方付款）
- `third_party`：第三方合同（合作/外包/代理等）

### 2.2 角色（RBAC）
- `employee`：普通员工（经办）
- `sales_owner`：销售负责人（销售合同默认负责人）
- `purchase_owner`：采购负责人（采购合同默认负责人）
- `pm`：项目经理/交付负责人（负责验收流程操作或协同）
- `finance`：财务（付款/回款、发票、收付款账户）
- `legal`：法务（可选，V1 可不强制参与审批，但需预留）
- `seal_admin`：印章管理员（按我方主体绑定）
- `approver`：审批人（配置产生，可为负责人/财务/法务等）
- `admin`：系统管理员（配置主体、权限、参数、流程）

---

## 3. 数据模型（核心对象）

### 3.1 我方主体 OurEntity（多实体）
**表：`our_entity`**
- `our_entity_id` (string/uuid) PK
- `name` (string) 必填
- `uscc` (string) 必填
- `registered_address` (string) 选填
- `contact_address` (string) 选填
- `legal_representative` (string) 选填
- `invoice_profile` (json) 选填
- `bank_accounts` (array<json>) 选填
- `seals` (array<json>) 选填（绑定 seal_admin_user_id）
- `default_approval_flow_id` (string) 选填（V1可先不用）
- `status` (enum) 必填：`active|inactive`
- `created_at`, `updated_at`

规则：
- R-OUR-001：合同创建必须选择 `our_entity_id`（无跨主体权限者默认带出且不可改）。
- R-OUR-002：审批、印章、统计均按 `our_entity_id` 隔离。

---

### 3.2 对方主体 Counterparty
**表：`counterparty`**
- `counterparty_id` PK
- `name` 必填
- `type` (enum) 必填：`customer|supplier|partner|other`
- `identifier` 选填
- `address` 选填
- `contacts` (array<json>) 选填
- `created_at`, `updated_at`

---

### 3.3 合同 Contract（主表）
**表：`contract`**
- `contract_id` PK
- `contract_no` 唯一（规则见 R-CON-010）
- `title` 必填
- `contract_type` 必填：`sales|purchase|third_party`
- `our_entity_id` 必填
- `counterparty_id` 必填
- `owner_user_id` 必填（经办/负责人）
- `project_id` 选填但建议强关联
- `total_amount` 必填
- `currency` 必填
- `tax_included` 必填
- `signed_at/effective_at/expire_at` 选填
- `delivery_start_at/delivery_end_at` 选填
- `acceptance_at` 选填
- `has_maintenance` 必填
- `maintenance_start_at/maintenance_end_at` 选填
- `status` 必填（见 3.6）
- `payment_progress/delivery_progress/overall_progress` 只读
- `attachments` 选填（draft/signed/appendix/acceptance等）
- `created_at`, `updated_at`

规则（节选）：
- R-CON-003：默认负责人：
  - sales：默认销售负责人（配置/映射）
  - purchase：默认采购负责人（配置/映射）
  - third_party：默认创建人
- R-CON-004：分期合计必须=总金额（默认误差阈值 0.01）
- R-CON-010：编号：`CT-{our_entity_short}-{YYYYMM}-{seq}`

---

### 3.4 分期计划 ContractPaymentPlan
**表：`contract_payment_plan`**
- `plan_id` PK
- `contract_id` fk
- `sequence_no` int 必填
- `name` string 必填
- `amount` decimal 必填
- `ratio` decimal 选填
- `due_at` date 选填（强建议）
- `trigger` enum 选填：`after_sign|after_delivery|after_acceptance|custom`
- `is_final` bool 必填（尾款）
- `direction` enum 必填：`receivable|payable`
- `paid_amount` 默认0
- `paid_at` 选填
- `status` enum 必填：`pending|due|completed|overdue`
- `created_at`, `updated_at`

---

### 3.5 里程碑/验收 ContractMilestone
**表：`contract_milestone`**
- `milestone_id` PK
- `contract_id` fk
- `name` 必填
- `planned_at` 选填
- `completed_at` 选填
- `type` enum 必填：`delivery|acceptance|custom`
- `result` enum 选填：`pass|fail|pending`
- `attachments` 选填
- `created_at`, `updated_at`

---

### 3.6 合同状态机（contract.status）
枚举：`draft|in_approval|approved|rejected|signed|in_delivery|pending_acceptance|accepted|closed|terminated`

> 注：为支持“审批通过但尚未签署”，V1 增加 `approved` 状态；驳回可用 `rejected` 或直接回到 `draft`，见流程章节。

---

### 3.7 审批实例 ApprovalInstance（V1 必须新增）
> 说明：为“合同审批流程”提供可编码对象。流程可以先做“固定链路”，但实例化数据必须存在，便于审计与待办。

**表：`approval_instance`**
- `approval_id` PK
- `object_type` enum 必填：`contract`
- `object_id` 必填：contract_id
- `flow_code` string 必填：如 `contract_sales_v1`
- `status` enum 必填：`pending|approved|rejected|cancelled`
- `current_step_no` int 必填
- `created_by_user_id` 必填
- `created_at`, `updated_at`

**表：`approval_step`**
- `step_id` PK
- `approval_id` fk
- `step_no` int 必填（1..N）
- `step_name` string 必填（负责人审批/财务审批/法务审批）
- `approver_user_id` 必填（V1：单人审批；V1.1 再做多人/并行）
- `status` enum 必填：`pending|approved|rejected|skipped`
- `acted_at` datetime 选填
- `comment` string 选填

规则：
- R-APP-001：合同提交审批会创建 approval_instance + steps，并将 contract.status 置为 `in_approval`
- R-APP-002：审批通过后 contract.status=`approved`（或直接 `signed`，取决于是否需要签署确认；V1建议保留 approved）
- R-APP-003：审批驳回：contract.status=`draft`，approval_instance.status=`rejected`，记录驳回原因
- R-APP-004：审批过程产生待办任务（可复用 task 表：type=`custom`/`risk_review`）

---

### 3.8 提醒任务 Task（尾款提醒/待办）
**表：`task`**
- `task_id` PK
- `type` (enum) 必填：`final_payment_reminder|data_completion|risk_review|custom`
- `title` 必填
- `owner_user_id` 必填（默认销售负责人/经办人）
- `related_object_type` (enum) 必填：`contract|payment_plan|milestone`
- `related_object_id` 必填
- `due_at` (datetime) 必填；提醒触发时间
- `status` (enum) 必填：`open|done|dismissed`
- `created_by` (enum) 必填：`system|user|ai`
- `created_at`, `updated_at`


### 3.9 审计日志 AuditLog
**表：`audit_log`**
- `log_id` PK
- `actor_user_id` 选填（系统可空）
- `action` 必填（如 CONTRACT_CREATE/PLAN_UPDATE/AI_REVIEW_RUN）
- `object_type`, `object_id`
- `before` (json) 选填
- `after` (json) 选填
- `created_at`

---

## 4. 合同创建流程（必须实现：页面+后端流程）
> 本节补齐你指出的“缺少合同创建流程”。

### 4.1 创建入口
- 入口 A：合同列表页 -> 【新建合同】
- 入口 B：合同列表页 -> 【AI 生成合同】（见 AI 模块）

### 4.2 创建方式
- 手动创建（表单）
- AI 生成（生成草稿后落库）

### 4.3 手动创建-页面流程（UX）
**Step 1：选择基础信息**
- 合同类型（sales/purchase/third_party）
- 我方主体（our_entity_id，默认带出；无跨主体权限不可改）
- 对方主体（下拉搜索已有 + “新增”）
- 合同名称（title，默认可由“对方 + 标的 + 日期”自动生成）

**Step 2：填写关键条款要素（结构化）**
- 金额（total_amount/currency/tax_included）
- 期限（delivery_start_at/delivery_end_at）
- 是否含运维（has_maintenance；若是则维护 maintenance_start_at/end_at）
- 验收方式（简述字段 acceptance_method：V1 可放在 contract.ext JSON 或单独字段）

**Step 3：分期计划**
- 快速模板按钮（例如：30/60/10、50/40/10；可配置）
- 或自定义期次（期次名/金额/到期日/触发条件/是否尾款）
- 校验：合计=总金额；尾款唯一

**Step 4：附件与保存**
- 上传草稿附件（可选）
- 保存为 draft
- 可选：保存并提交审批

### 4.4 创建规则（后端校验）
- R-CRT-001：必填字段缺失时不可保存（最低：type、our_entity、counterparty、title、金额、至少1期分期）
- R-CRT-002：分期合计校验（见 R-CON-004）
- R-CRT-003：若 has_maintenance=true 且无运维起止：允许保存 draft，但标记为 “缺失字段”，禁止提交审批（可配置）
- R-CRT-004：创建后 contract.status=`draft`

---

## 5. 合同审批流程（必须实现：页面+后端流程）
> 本节补齐你指出的“缺少合同审批流程”。  
> V1采用“固定审批链 + 可配置审批人”的最简实现，后续再升级为通用流程引擎。

### 5.1 审批链路（V1 默认）
按合同类型区分（可配置开关与人员）：

- Sales（销售合同）：
  1) 负责人审批（leader）
  2) 财务审批（finance）【可选开关】
  3) 法务审批（legal）【可选开关，默认关闭】
- Purchase（采购合同）：
  1) 负责人审批（leader）
  2) 财务审批（finance）【建议开启】
  3) 法务审批（legal）【可选】
- Third-party（第三方）：
  1) 负责人审批（leader）
  2) （可选）法务审批

> 审批人产生规则（V1）：
- leader：合同 owner 的直属负责人（若无组织架构，则由管理员配置“负责人审批人”）
- finance/legal：按 `our_entity_id` 绑定默认审批人（管理员配置）

### 5.2 审批触发
- 在合同详情页点击【提交审批】
- 系统创建 approval_instance 与 approval_steps，生成审批待办（task 或专用审批待办列表）
- contract.status：`draft -> in_approval`

### 5.3 审批页面（审批人视角）
审批人看到：
- 合同关键摘要（主体、金额、分期、运维、验收、附件）
- 风险提示（缺失字段、逾期风险、AI 审核红黄项若存在）
- 操作按钮：
  - 【通过】（可填写意见）
  - 【驳回】（必须填写原因）
  - 【转交】（V1可不做，留 V1.1）

### 5.4 状态流转
- 提交：`draft -> in_approval`
- 中间步骤通过：仍为 `in_approval`，推进 current_step_no
- 最后一步通过：
  - approval_instance.status=`approved`
  - contract.status=`approved`
- 驳回：
  - approval_instance.status=`rejected`
  - contract.status=`draft`
  - 记录驳回原因（approval_step.comment）并通知经办人
- 取消审批（可选）：
  - 仅创建者在 `in_approval` 且未被处理时可取消
  - approval_instance.status=`cancelled`
  - contract.status 回 `draft`

### 5.5 签署确认（审批后）
> 为避免把“审批通过”与“签署完成”混为一谈，V1建议保留签署确认动作。

- 在 contract.status=`approved` 时，提供操作：【确认已签署】+ 上传 signed 附件
- 确认后：
  - contract.status=`signed`
  - signed_at 写入（若未填）
- 后续进入履约：可由项目启动或手动置为 in_delivery（权限限制）

### 5.6 审批与权限约束
- 只有 owner（或同部门授权）可提交审批
- in_approval 状态下：
  - owner 不可修改关键字段（金额、主体、分期）；
  - 如需修改，必须先撤回/驳回到 draft
- 审批通过后（approved/signed）：
  - 合同关键字段锁定，只允许追加附件、登记收付、更新里程碑/验收

### 5.7 审批数据一致性与审计
- 所有审批动作写 audit_log
- approval_step 必须记录 acted_at、comment
- 审批待办必须可追踪（谁未处理、已处理、处理时间）

---

## 6. 进度计算与展示（必须实现）
### 6.1 资金进度 payment_progress
- 公式：`sum(min(paid_amount, amount)) / contract.total_amount`
- 展示：百分比 + 明细（期次表）

### 6.2 履约进度 delivery_progress（V1 简化）
- 若存在里程碑：`completed_milestones / total_milestones`
- 否则按状态映射：
  - draft/in_approval：0
  - signed：0.1
  - in_delivery：0.5
  - pending_acceptance：0.8
  - accepted/closed：1.0

### 6.3 总进度 overall_progress（V1 默认权重）
- `overall = 0.5 * payment_progress + 0.5 * delivery_progress`
- 权重作为系统配置项（V1可固定，V1.1再可配）

---

## 7. 自动化：尾款提醒（必须实现）
### 7.1 触发条件与规则
**事件**：合同验收通过（contract.status=accepted 或 acceptance milestone pass）

**触发前提**
- 存在 `payment_plan.is_final=true`
- 且该期次未 completed
- 且该期次存在 `due_at`（若缺失：创建“数据补齐任务”，不创建提醒）

**系统动作**
- 创建 `task.type=final_payment_reminder`
- `task.owner_user_id`：默认合同 owner（销售负责人/经办人）
- `task.due_at`：`payment_plan.due_at - 30 days`（30为配置项，默认30）
- 通知：在 `task.due_at` 触发消息（系统站内消息/企业IM/邮件由实现选择）

**可配置项（V1 允许管理员配置）**
- C-REM-001：提前提醒天数（默认 30）
- C-REM-002：是否仅对 `has_maintenance=true` 生效（默认：对所有合同生效；可开关）
- C-REM-003：抄送角色（默认无；可选抄送 finance/pm）

### 7.2 异常处理
- E-REM-001：验收通过但无尾款期次：创建 `task.type=data_completion` 提醒经办补齐分期/尾款。
- E-REM-002：尾款期次无 due_at：创建 `data_completion` 任务，阻断生成尾款提醒。
- E-REM-003：尾款已完成：不创建提醒任务。

---

## 8. AI 合同助手（V1：无模板可落地）
### 8.1 功能 A：AI 生成合同（我方出具）
**入口**：合同模块 -> “AI 生成合同”  
**目标**：生成结构完整、字段一致的“合同草稿文档”，并自动落库结构化字段与分期计划。

#### 8.1.1 输入（最小必填）
- contract_type
- our_entity（默认带出，可选）
- counterparty（可选已有主体或手动新增）
- 合同内容描述（free_text）
- total_amount/currency/tax_included
- 分期计划（至少 1 期；可选快速方案：例如 30/60/10）

#### 8.1.2 生成策略（V1）
- 不依赖外部模板库；采用“合同骨架 + 默认条款块（系统内置）”
- 将用户输入进行结构化抽取（范围/期限/验收/运维/分期）
- 输出：
  - 合同草稿（DOCX + 可预览 HTML）
  - contract/payment_plan/milestone（可选自动生成基础里程碑：交付、验收）

#### 8.1.3 输出约束
- 生成后的合同状态固定为 `draft`
- 必须展示“待补齐字段清单”（例如：对方税号缺失、验收标准缺失）
- 未补齐关键字段时禁止提交审批（关键字段清单由配置：默认金额、主体、分期合计、验收方式）

#### 8.1.4 审计与留痕
- 记录 AI 生成任务：输入摘要、生成版本、操作者、时间
- AI 输出可被人工编辑，但需记录变更审计（建议保存版本号）

---

### 8.2 功能 B：AI 初审对方合同（对方出具）
**入口**：合同模块 -> “AI 审核对方合同”  
**目标**：仅做“初审”，输出三类结论：信息是否完整 / 是否矛盾 / 是否明显不利于我方。

#### 8.2.1 输入
- 上传文件：DOCX 或可复制文本 PDF（V1）
- 指定我方主体（可选，用于对比“我方角色定位”与提醒）

#### 8.2.2 输出（结构化报告）
1) Completeness（完整性）
- 抽取字段：双方主体、标的范围、金额、分期/付款、期限、验收、违约、争议解决、终止、附件引用
- 输出缺失项清单（缺失->红）

2) Consistency（矛盾性）
- 检测并列出矛盾点（带原文定位：章节/段落/短引用<=25词）
  - 金额：总额 vs 分期合计/大小写
  - 日期：生效/签署/交付/验收顺序
  - 定义：术语前后不一致
  - 条款冲突：变更机制/验收触发/付款条件互相矛盾
  - 附件冲突：正文与附件范围/规格不一致（若可识别）

3) Unfavorable（明显不利条款）
- 输出红/黄分级 + 原文定位 + 不利原因 + 建议谈判要点（不要求提供替换条款）
- 红线示例（必须覆盖）：
  - 责任无限或无上限
  - 违约金/赔偿明显过高或无上限
  - 对方单方终止且我方承担成本
  - 验收机制导致对方可无限拖延但不付款
  - 对方单方解释/变更/扣款权
  - 知识产权无偿全面转让且缺乏合理边界
  - 付款条件“对方满意付款”但无客观标准

#### 8.2.3 联动（可选但建议做）
- 审核完成后可“一键生成合同记录（draft）”：
  - 自动填充已抽取字段
  - 对未抽取/缺失字段生成 `task.type=data_completion`

#### 8.2.4 阻断规则（V1 可选开关）
- 若存在红色不利条款：阻断进入“签署/用章/状态变更为 signed”，直到负责人/管理员放行。
- 默认：开启阻断（保守策略）；可配置关闭。

---

## 9. 页面与交互（V1 最小）【更新版：补齐创建/审批页面】

### 9.1 合同列表页
- 筛选：contract_type/status/our_entity/counterparty/owner/date_range
- 列展示：contract_no/title/type/our_entity/counterparty/total_amount/payment_progress/delivery_progress/overall_progress/status/final_due_at/overdue_flag
- 操作：
  - 【新建合同】
  - 【AI 生成合同】
  - 【AI 审核对方合同】
  - 点击进入详情

### 9.2 合同创建页（手动创建）
- 分步表单（见 4.3）：
  - 基础信息
  - 关键要素
  - 分期计划
  - 附件
- 底部按钮：
  - 【保存草稿】
  - 【保存并提交审批】

### 9.3 合同详情页（经办/管理视角）
区块：
- 基本信息（主体、金额、状态、关键日期）
- 进度条（资金/履约/总）
- 分期计划表（登记收付款）
- 里程碑/验收（验收通过触发提醒）
- 附件（草稿/签署/验收等）
- 审批区块：
  - 当前审批状态（in_approval/approved）
  - 审批记录（步骤、审批人、时间、意见）
  - 操作（提交审批/撤回/确认签署）
- 风险提示区块（缺失字段、AI审核红黄项、逾期等）

### 9.4 审批待办页（审批人视角）
- 列表：我待审批的合同
- 点击进入“审批详情页”
- 快捷按钮：通过/驳回

### 9.5 审批详情页（审批动作页）
- 合同摘要 + 分期 + 关键附件
- 风险提示
- 输入框：审批意见
- 按钮：通过 / 驳回（驳回必填原因）

### 9.6 AI 生成页
- 结构化表单 + 自由描述输入
- 分期快速模板按钮 + 自定义编辑
- 生成后：预览 + 编辑 + 保存草稿

### 9.7 AI 审核页
- 上传文件
- 输出：三段报告（完整性/矛盾/不利条款）+ 风险概览
- 导出报告（PDF/HTML）可选

---

## 10. 系统配置项（Admin）【补齐审批配置】
- C-SYS-001：尾款提醒提前天数（默认 30）
- C-SYS-002：尾款提醒是否仅对含运维合同生效（默认 false）
- C-SYS-003：金额校验误差阈值（默认 0.01）
- C-SYS-004：分期快速模板（如 30/60/10）
- C-SYS-005：跨主体权限名单
- C-SYS-006：通知通道配置
- C-APP-001：按合同类型的审批链开关（是否启用财务/法务步骤）
- C-APP-002：按我方主体绑定 finance/legal 默认审批人
- C-APP-003：负责人审批人获取方式（组织架构/管理员固定指派）

---

## 11. API/Service 接口建议（供研发拆分）【补齐审批接口】

- ContractService
  - createContract / updateContract / getContract / listContracts
  - confirmSigned(contract_id, signed_at, signed_attachment)
  - updateStatus (受限：signed->in_delivery 等)
- PaymentPlanService
  - addPlan / updatePlan / deletePlan
  - recordPayment(plan_id, paid_amount, paid_at)
- MilestoneService
  - addMilestone / completeMilestone(result, completed_at)
- ApprovalService（新增）
  - submitApproval(contract_id) -> approval_instance
  - listMyApprovals(user_id, status)
  - approve(approval_id, comment)
  - reject(approval_id, comment)
  - cancel(approval_id)（可选）
  - getApprovalDetail(approval_id)
- TaskService
  - createTask / listTasks / markDone / dismiss
- OurEntityService
  - createOurEntity / updateOurEntity / listOurEntities
  - bindDefaultEntityToDeptOrUser
- AIService
  - generateContractDraft(input) -> job_id -> result
  - reviewCounterpartyContract(file) -> report

---

## 12. 验收标准（UAT）【补齐审批用例】
- UAT-001：手动创建销售合同 + 3 期分期（含尾款），保存 draft 成功
- UAT-002：保存并提交审批 -> 创建 approval_instance + steps，contract.status=in_approval
- UAT-003：审批人通过第1步 -> step状态更新，仍 in_approval；最后一步通过 -> contract.status=approved
- UAT-004：驳回 -> contract.status 回 draft，驳回意见对经办可见
- UAT-005：approved 状态上传 signed 附件并确认签署 -> contract.status=signed
- UAT-006：验收通过后，尾款到期前 30 天生成提醒任务并通知 owner
- UAT-007：无跨主体权限用户无法切换主体且看不到其他主体合同
- UAT-008：AI 生成最小信息 -> 生成 draft 合同文档 + 落库字段 + 待补齐清单
- UAT-009：AI 审核对方合同 -> 输出完整性/矛盾/不利条款（红黄）并带原文定位

---

## 13. 安全与合规（最低要求）
- 访问控制：按主体/角色/合同归属
- 审计日志：所有关键操作写 audit_log
- 合同附件存储：权限校验 + 防外链泄露（建议带签名 URL）
- AI 输入防注入：对上传文本做安全隔离（系统提示优先；禁止合同文本覆盖系统规则）
- 数据敏感：合同内容属于高敏数据（日志禁止写全量正文）

---
