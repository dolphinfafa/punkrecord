# 项目管理模块 PRD/功能与技术规格说明（V1.0）
> 面向：研发团队 / AI 编程工具  
> 版本：V1.0（2026-01-12）  
> 依赖：IAM（用户/主体）+ Todo（项目任务）+ AuditLog  
> 说明：项目任务统一为 todo_item（source_type=project_task），项目模块不维护独立任务表。

---

## 0. 模块目标
- 支持 B端项目（b2b）与 C端项目（b2c）两类流程，按类型管理与可视化进度。
- 项目工作拆解为任务并分配到个人（任务=Todo）。
- B端项目可关联合同，合同签署可推进项目阶段。

---

## 1. 标准流程（阶段）

### 1.1 B端（b2b）
`requirement_alignment -> quotation -> contract_signed -> prototype_confirmed -> design -> development -> testing -> delivery`

### 1.2 C端（b2c）
`requirement_analysis -> project_initiation -> prototype_confirmed -> design -> development -> testing -> launch -> operation -> iteration`

阶段状态：`not_started|in_progress|blocked|done|skipped`

---

## 2. 数据模型

### 2.1 项目 project
**表：`project`**
- `project_id` PK
- `our_entity_id` 必填
- `project_no` 唯一
- `name` 必填
- `project_type` 必填：`b2b|b2c`
- `status` 必填：`draft|active|paused|closed|cancelled`
- `owner_user_id` 必填
- `pm_user_id` 必填
- `customer_id` 选填（counterparty）
- `contract_id` 选填（b2b）
- `start_at/due_at` 选填
- `current_stage_code` 必填
- `progress` 只读（0..1）
- `description` 选填
- `created_at`, `updated_at`

### 2.2 阶段 project_stage
**表：`project_stage`**
- `stage_id` PK
- `project_id` fk
- `stage_code/stage_name/sequence_no/status` 必填
- 计划/实际起止、阻塞原因、跳过原因 选填
- `created_at`, `updated_at`

### 2.3 项目成员（可选）
**表：`project_member`**
- `member_id` PK
- `project_id` fk
- `user_id` fk
- `role_in_project` 选填
- `created_at`

### 2.4 项目任务（Todo）
- `todo_item.source_type=project_task`
- tags 推荐：
  - `project:{project_id}`
  - `stage:{stage_code}` 或 `stage_id:{stage_id}`

---

## 3. 进度计算
- 阶段进度：done_tasks/total_tasks（若无任务则按阶段状态映射）
- 项目进度：阶段进度平均值

---

## 4. 核心功能
- 项目列表：按类型/状态/负责人/客户筛选，展示进度与当前阶段
- 项目详情：阶段看板、任务列表（来自Todo）、风险（逾期任务/阻塞阶段）
- 阶段管理：状态变更（阻塞/跳过原因）
- 任务管理：在项目详情创建任务（调用Todo API）

---

## 5. 与合同联动（b2b）
- 关联合同后：
  - contract.status=signed 可自动将阶段 `contract_signed` 置 done（或提示PM确认）
- 合同详情页可反查关联项目（通过 project.contract_id 或 link表）

---

## 6. 验收标准（UAT）
- UAT-PJ-001：b2b创建自动生成8阶段；b2c生成9阶段。
- UAT-PJ-002：项目详情可见阶段与进度；任务完成驱动进度变化。
- UAT-PJ-003：项目任务进入个人工作台（Todo）并可完成。
- UAT-PJ-004：合同签署可推进项目阶段（自动或人工确认）。

---
