# Todo（个人待办/工作台）模块 PRD/技术规格（V1.0）
> 面向：研发团队 / AI编程工具  
> 版本：V1.0（2026-01-12）  
> 目标：提供全系统统一“待办”入口，将项目任务、审批事项、合同提醒等汇聚到每个人的 Todo List；支持状态流转、到期、通知与追溯。

---

## 0. 目标与边界

### 0.1 目标（V1）
- 统一待办数据模型 `todo_item`，支持多来源（project/contract/approval/finance/custom）。
- 提供“我的待办”工作台：按状态/截止日期/来源筛选，支持一键完成/驳回跳转。
- 与审批引擎联动：审批步骤自动生成待办并在审批完成后自动关闭。
- 与合同联动：合同尾款到期前1个月生成销售待办（合同模块产生）。
- 与项目联动：项目任务=Todo（直接落库到 todo_item），项目详情按任务聚合。
- 待办必须可追溯：来源对象、操作审计、关闭原因。

### 0.2 非目标（V1不做）
- 不做复杂提醒策略编排（如工作日/节假日/多次提醒）。
- 不做跨渠道深度集成（企业微信/飞书），预留 webhook/回调接口。

---

## 1. 待办分类与来源（source）

### 1.1 source_type（枚举）
- `project_task`：项目任务
- `approval_step`：审批步骤待办
- `contract_reminder`：合同提醒（尾款/续签/验收等）
- `finance_action`：财务处理事项（可选）
- `custom`：手工/其他

### 1.2 action_type（枚举）
- `do`：执行型（完成即可，如项目任务）
- `approve`：审批型（approve/reject）
- `review`：复核型（确认OCR/确认信息完整性）
- `ack`：知会型（确认已阅）

---

## 2. 数据模型（V1完整字段）

### 2.1 待办 todo_item
**表：`todo_item`**
- `todo_id` (uuid) PK
- `our_entity_id` (uuid) 必填
- `assignee_user_id` (uuid) 必填
- `creator_user_id` (uuid) 必填
- `title` (string) 必填
- `description` (text) 选填
- `source_type` (enum) 必填
- `source_id` (uuid/string) 必填
- `action_type` (enum) 必填
- `priority` (enum) 选填：`p0|p1|p2|p3`（默认 p2）
- `status` (enum) 必填：`open|in_progress|blocked|done|dismissed`
- `due_at` (datetime) 选填
- `start_at` (datetime) 选填
- `tags` (array<string>) 选填
- `link` (json) 选填：`object_type`, `object_id`, `url`
- `blocked_reason` (string) 选填
- `done_at` (datetime) 选填
- `done_by_user_id` (uuid) 选填
- `dismiss_reason` (string) 选填
- `created_at`, `updated_at`

规则：
- R-TODO-001：所有“需要某个人行动”的事项必须落为 todo_item。
- R-TODO-002：建议对 `source_type+source_id` 设唯一约束，避免重复生成。
- R-TODO-003：审批型待办（action_type=approve）不允许用户直接 done，必须通过审批接口关闭。
- R-TODO-004：用户手动关闭（done/dismissed）必须写 audit_log，记录原因与操作者。

### 2.2 通知记录（可选）
**表：`notification_log`**
- `notification_id` PK
- `todo_id` fk
- `channel` (enum) 必填：`in_app|email|webhook`
- `status` (enum) 必填：`pending|sent|failed`
- `sent_at` 选填
- `error_message` 选填
- `created_at`, `updated_at`

---

## 3. 与各模块的集成点（必须实现）

### 3.1 项目模块 -> Todo
- 创建项目任务：创建 `todo_item(source_type=project_task, action_type=do)`
- 推荐 tags：
  - `project:{project_id}`
  - `stage:{stage_code}` 或 `stage_id:{stage_id}`

### 3.2 审批引擎 -> Todo
- 每个 `approval_step(status=pending)` 生成一个 todo_item：
  - source_type=approval_step, action_type=approve
  - assignee=approver_user_id
  - link 指向审批详情页
- 审批通过/驳回：自动关闭待办

### 3.3 合同模块 -> Todo（尾款提醒）
- 在尾款到期前30天创建 todo_item：
  - source_type=contract_reminder
  - source_id=payment_plan.plan_id（确保唯一）
  - assignee=合同经办 owner_user_id
  - title：`【尾款提醒】{contract_name} 尾款将于 {due_date} 到期`
  - due_at：到期日（建议 due_at=due_date；创建时间提前）

### 3.4 财务模块 -> Todo（可选）
- `ocr_status=needs_review` 可生成 review 类 todo（assignee=finance），作为处理入口（可配置开关）。

---

## 4. 页面与交互（V1最小）

### 4.1 工作台：我的待办
- 默认视图：open + in_progress + blocked
- 筛选：状态、截止（今天/本周/逾期）、来源、主体
- 列展示：标题、来源、优先级、截止时间、关联对象、状态
- 操作：
  - do类：一键完成
  - blocked：填写阻塞原因
  - approve类：跳转审批页操作

### 4.2 待办详情
- 展示字段 + 最近审计日志
- 跳转关联对象

---

## 5. API建议
- `GET /todo/my`
- `POST /todo`
- `PATCH /todo/{todo_id}`
- `POST /todo/{todo_id}/done`
- `POST /todo/{todo_id}/block`
- `GET /todo/{todo_id}`

---

## 6. 验收标准（UAT）
- UAT-TODO-001：项目任务创建后，负责人在“我的待办”可见；完成后置done。
- UAT-TODO-002：审批提交后生成审批待办；审批完成后待办自动关闭。
- UAT-TODO-003：合同尾款到期前30天生成待办；分期变更时待办不重复生成且可更新。
- UAT-TODO-004：待办状态变更可追溯（audit_log）。

---
