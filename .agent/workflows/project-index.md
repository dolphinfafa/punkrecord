---
description: 工程索引 �?PunkRecord 企业管理系统（供 Agent 快速定位代码结构，每次工作后须更新�?
---

> **Agent 注意**：每次开始任务前必须先阅读本文件，完成任务后若有结构性变更须更新对应章节�?

---

## 1. 目录结构�? 层）

```
punkrecord/
├── backend/                  # Python FastAPI 后端
�?  ├── app/
�?  �?  ├── api/              # 路由层：auth, iam, todo, contract, project, finance, ai
�?  �?  ├── core/             # 基础设施：config, database, auth, security, response, exceptions, init_db
�?  �?  ├── models/           # SQLModel ORM 表：base, iam, todo, contract, project, finance, shared, approval
�?  �?  ├── schemas/          # Pydantic DTO：todo, contract, project, finance
�?  �?  ├── services/         # 服务层（当前较薄�?
�?  �?  └── utils/
�?  ├── migrations/           # Alembic 迁移脚本
�?  ├── tests/                # 验证脚本
�?  └── requirements.txt
├── frontend/                 # React + Vite 前端
�?  └── src/
�?      ├── api/              # Axios 请求封装（按模块�?
�?      ├── components/
�?      �?  ├── common/       # Modal 等通用组件
�?      �?  ├── layout/       # Layout, Sidebar
�?      �?  └── todo/         # TodoModal, TodoDetailModal
�?      ├── contexts/         # AuthContext（全局认证状态）
�?      ├── hooks/            # 自定�?Hook
�?      ├── pages/            # 页面：auth, dashboard, finance, iam, contract, project, todo
�?      └── utils/
├── apps/api/                 # NestJS API（新技术栈探索，使�?Prisma�?
├── prd/                      # 产品需求文档（00~80 编号�?
├── milestone/                # 按日期记录的里程�?
└── .agent/workflows/         # Agent 工作�?& 本索引文�?
```

---

## 2. 关键模块职责

| 模块 | 后端路由前缀 | 职责 |
|------|------------|------|
| **auth** | `/api/v1` | 登录(`/login`)、登�?`/logout`)、当前用�?`/me`)；JWT Bearer Token |
| **iam** | `/api/v1` | 用户、部�?OrgUnit)、职�?JobTitle)、法人主�?OurEntity)、角色权限、组织架构图 |
| **todo** | `/api/v1/todo` | 待办全生命周期：创建→开始→提交→审批→完成/拒绝/阻塞/忽略；请假申请创建与查询 |
| **contract** | `/api/v1` | 合同、对手方(Counterparty)、付款计�?PaymentPlan)、合同提交审�?|
| **project** | `/api/v1` | 项目、阶�?Stage)、成员、待办关联、报价单导出Excel、功能清单、AI生成开发任务、合同画布、合同Word导出 |
| **finance** | `/api/v1` | 账户(FinanceAccount)、收支流�?Transaction)、发�?Invoice)、报销(Reimbursement) |
| **ai** | `/api/v1/ai` | AI 对话(`/chat`)、流式对�?`/chat-stream`) |

**前端模块**

| 目录 | 职责 |
|------|------|
| `pages/auth` | 登录�?|
| `pages/dashboard` | 仪表�?|
| `pages/project` | 项目列表/详情页，含多�?Modal 子组�?|
| `pages/finance` | 账户列表、流水列�?|
| `pages/iam` | 用户列表、部门、职位、法人主体、组织架构图 |
| `pages/contract` | 合同列表、对手方列表 |
| `pages/todo` | 待办页（�?TodoModal、TodoDetailModal�?|
| `contexts/AuthContext` | 全局用户状态、token 管理、自动刷�?|

---

## 3. 核心数据模型（简写）

所有表继承 `BaseDBModel`（含 `id: UUID`, `created_at`, `updated_at`）�?

```
# IAM
User: username, hashed_password, real_name, email, phone, status(active/inactive), entity_id→OurEntity
OurEntity: name, type(company/branch/subsidiary), status
OrgUnit (部门): name, parent_id(self-ref), entity_id, manager_id→User
JobTitle: name, entity_id
OrgMembership: user_id, org_unit_id, job_title_id, is_primary

# Todo
TodoItem: title, description, source_type(manual/project_task), action_type, priority(low/medium/high/urgent),
          status(pending/in_progress/submitted/approved/rejected/done/blocked/dismissed),
          assignee_id→User, reporter_id→User, project_id→Project, due_date, started_at, completed_at
LeaveRequest: applicant_user_id→User, leave_type(annual/maternity/marriage/personal/sick),
              status(pending/approved/rejected/cancelled), start_at, end_at, reason
User(假期余额): leave_annual_remaining(5), leave_maternity_remaining(15),
              leave_marriage_remaining(3), leave_personal_remaining(3), leave_sick_remaining(3),
              leave_balance_reset_year(最近重置年份标�?

# Project
Project: name, type(internal/client), status(planning/active/on_hold/completed/cancelled),
         entity_id→OurEntity, contract_id→Contract, budget, attachments(JSON)
ProjectStage: project_id, name, status(pending/active/done), order, description, attachments(JSON)
ProjectMember: project_id, user_id, role

# Contract
Counterparty: name, type(client/supplier/partner/individual), tax_id, contact_*
Contract: title, type(client/supplier/tripartite), status(draft/review/active/completed/terminated),
          our_entity_id, counterparty_id, amount, signed_date, start_date, end_date
ContractPaymentPlan: contract_id, amount, direction(inbound/outbound), due_date, status

# Finance
FinanceAccount: name, category(bank/cash/receivable/payable/equity), balance, currency, entity_id
FinanceTransaction: account_id, direction(credit/debit), amount, description, txn_date, contract_id
FinanceInvoice: transaction_id, kind(vat_special/vat_normal/receipt/other), medium(paper/digital),
                amount, invoice_no, status(ocr_pending/ocr_done/verified)
```

---

## 4. 关键流程

### 认证流程
1. `POST /api/v1/login` �?返回 `access_token`(JWT)
2. 前端存入 `localStorage`，后续请�?Header：`Authorization: Bearer <token>`
3. Token 有效�?1440 分钟（`AuthContext` 自动在过期前刷新�?

### Todo 生命周期
```
pending �?[start] �?in_progress �?[submit] �?submitted
    �?[approve] �?done
    �?[reject]  �?rejected
in_progress / submitted �?[block]   �?blocked
Any �?[dismiss] �?dismissed
```

### 工作台请假流�?
1. L0 员工（无直属上级）不可提交请假，L0 以下员工可提�?
2. 提交请假后：
   - 创建 `LeaveRequest`（状�?`pending`�?
   - 在“待我审批”请假列表中由直属主管处�?
3. 直属主管审批通过后：
   - `LeaveRequest` 变更�?`approved`
   - 按请假类型扣减申请人的假期余�?
4. 驳回后：
   - `LeaveRequest` 变更�?`rejected`

### 项目 �?Todo 关联
`project.py` `POST /projects/{id}/generate-dev-tasks` 调用 AI 生成 `TodoItem`（source_type=project_task），绑定 project_id �?stage 信息�?

### 合同 �?项目关联
`Project.contract_id` FK 指向 `Contract`；`/projects/{id}/contract-context` 聚合合同信息用于 AI 画布�?

---

## 5. 常用命令

```bash
# 后端（在 backend/ 目录�?
source ../punkrecord/bin/activate          # 激�?venv（Python 3.9�?
uvicorn app.main:app --reload --port 8000  # 启动开发服务器
alembic upgrade head                        # 运行迁移
alembic revision --autogenerate -m "desc"  # 生成迁移
python create_admin.py                      # 创建管理员账�?
python init_database.py                     # 初始化基础数据

# 前端（在 frontend/ 目录�?
npm run dev          # 启动开发服务器（端�?5173�?
npm run build        # 构建生产�?
npm run lint         # ESLint 检�?
npm run preview      # 预览生产�?

# 健康检�?
curl http://localhost:8000/health
```

---

## 6. 约定

### 命名
- **后端文件**：snake_case�?*前端文件**：PascalCase（组件）/ camelCase（工具、hooks�?
- **API 路由**：kebab-case，例�?`/payment-plans`, `/our-entities`
- **数据库列**：snake_case�?*前端变量**：camelCase

### API 响应格式
```json
// 成功
{ "data": {...}, "message": "ok" }
// 错误（AtlasException�?
{ "code": 400, "message": "具体错误信息" }
```

### 环境变量（`backend/.env`�?
- `DB_TYPE=sqlite`（开发）/ `mysql`（生产）
- `SQLITE_DB_PATH=./atlas.db`
- `SECRET_KEY=...`（JWT 签名密钥�?
- `BACKEND_CORS_ORIGINS=["http://localhost:5173"]`
- `ACCESS_TOKEN_EXPIRE_MINUTES=1440`

### 数据�?
- **开�?*：SQLite（atlas.db，已加入 .gitignore，不提交�?
- **生产**：MySQL，通过 `DB_TYPE=mysql` 切换
- ORM：SQLModel（SQLAlchemy + Pydantic）；迁移工具：Alembic

### 错误�?
- `400` 参数错误 / 业务逻辑错误
- `401` 未认�?
- `403` 无权�?
- `404` 资源不存�?
- `500` 服务器内部错�?

### 日志格式（main.py 中间件）
```
📥 Incoming request: {METHOD} {path}
📤 Response status: {status_code}
�?Request failed: {ExceptionType}: {message}
```

---

## 7. 增量更新�?026-02-24 ~ 2026-02-25�?

- 新增页面：`frontend/src/pages/project/DevelopmentProgressPage.jsx` + `frontend/src/pages/project/DevelopmentProgressPage.css`
- 新增路由：`/project/:id/dev-progress`（项目开发进度管理页�?
- 项目详情“development”阶段入口文案由“生成开发任务”改为“开发进度�?
- 新增接口：`POST /api/v1/project/projects/{project_id}/todos/{todo_id}/assign`（仅项目经理可改指派�?
- 新增接口：`POST /api/v1/project/projects/{project_id}/todos/{todo_id}/plan`
  - 支持开发任务计划字段更新：`assignee_user_id`、`due_at`、`priority`
- 开发进度页能力增强�?
  - 支持负责人、截止日期、优先级在线修改
  - 支持按类型分组排序与折叠（前�?后端/UI/产品�?
  - 支持表格视图与甘特视图切�?
- 功能清单（FeatureListModal）增强：
  - 支持“下载模板�?
  - 支持“上传导入（Excel/CSV）并自动识别表头导入�?
  - 功能清单导出改为前端本地 `xlsx` 导出
- 开发任务生成规则更新：`generate-dev-tasks` 生成�?Todo 统一使用
  - `source_type=project_task`
  - `source_id={project_id}`（确保可被项目任务列表和进度统计正确检索）
  - `creator_user_id=project.pm_user_id`（统一由项目经理作为审核员�?
- 认证读取顺序更新（`backend/app/core/auth.py`）：
  - 优先使用 `Authorization: Bearer` token
  - �?Bearer 时再回退读取 cookie，避免多账号切换时身份错�?
- 附件管理改为“项目级”入口（位于项目详情页“阶段”模块右上角“附件”按钮）�?
  - 支持上传、下载、删除并查看本项目相关附件（合同、原型确认单等）
  - 新增接口：`GET /api/v1/project/projects/{project_id}/attachments`
  - 新增接口：`POST /api/v1/project/projects/{project_id}/attachments`
  - 新增接口：`GET /api/v1/project/projects/{project_id}/attachments/{attachment_id}/download`
  - 新增接口：`DELETE /api/v1/project/projects/{project_id}/attachments/{attachment_id}`
  - `Project` 新增字段：`attachments`（JSON，存项目附件元数据）
  - SQLite 启动时自动补�?`project.attachments` 列并修复空值（兼容旧库�?
- 工作台新增“请假功能”：
  - 新增工作台请假申请表单、剩余假期展示、最近请假记�?
  - 新增“待我审批”列表（直属主管审批入口�?
  - 规则：L0 员工无需请假；L0 以下由直属主管审�?
  - 新增接口：`POST /api/v1/todo/leaves`
  - 新增接口：`GET /api/v1/todo/leaves/my`
  - 新增接口：`GET /api/v1/todo/leaves/team/pending`
  - 新增接口：`POST /api/v1/todo/leaves/{leave_id}/approve`
  - 新增接口：`POST /api/v1/todo/leaves/{leave_id}/reject`
  - 新增模型：`LeaveRequest`
  - 用户模型新增假期余额字段（L0 可在用户管理中编辑）
  - 取消自动重置；改�?L0 手动重置
  - 员工管理调整：重置入口从“编辑员工弹窗”迁移至“员工管理主页面统一入口”，支持一键重置所有员�?
  - 新增 IAM 接口：`POST /api/v1/iam/users/reset-leave-balances`（L0 触发全员重置�?

---

*最后更新：2026-02-25 | 如有结构性变更请同步更新本文�?

## 8. �������£�2026-02-25 ����׷�ӣ�

- ���������������ϸ�ͬ�������嵥����������
  - �½ӿڣ�`POST /api/v1/project/projects/{project_id}/sync-dev-tasks`
  - ��Ϊ������ո���Ŀ `PROJECT_TASK` �ٰ������嵥�ؽ���ȷ�������б��빦���嵥�ϸ�һ�¡�
  - ͬ������ͳ�ƣ�`created`��`deleted`��`feature_total`��`source_stage`��
- �����������ӳ���޸���
  - ͳһΪ `[���] / [ǰ��] / [UI] / [��Ʒ]` ǰ׺�����ٳ��� `[??]`��
- Ȩ�޲��Ե������������ȹ�������
  - ԭ������Ŀ��������չΪ����Ŀ��������Ŀ�����ˣ�owner������
  - ���ǽӿڣ�`/todos/{todo_id}/assign`��`/todos/{todo_id}/plan`��`/sync-dev-tasks`��
  - ǰ�� `DevelopmentProgressPage` ͬ������ `pm || owner` �ж������� id ��׼���Ƚϣ������������ַ� UUID����
- ��������ҳ���������룺
  - �������½����񡱡��༭���񡱵���������
  - �༭֧���ֶΣ����⡢�����������ˡ����ȼ�����ֹ���ڡ��������͡�
  - ��Ӧ��� `ProjectTaskPlanUpdateRequest` ���ӣ�`title`��`description`��`dev_type`��
- ��Ŀ��Ա��ɫͬ���޸���
  - ������Աʱ��δ�� `role_in_project`���Զ������û���λ����`JobTitle.name`�����޸�λ�����Ŀ��Ա����
  - ��Ա�б��ӿ����Ӷ���չʾ���ս�ɫʱ����λ��/Ĭ��ֵ���أ���

- ���ݿ�ִ�м�¼��atlas.db��2026-02-25����
  - B2B ��Ŀ `test`����ղ��ؽ� `64 -> 64`����Դ�׶Σ�������룩
  - B2C ��Ŀ `��Ϻ��`����ղ��ؽ� `30 -> 30`����Դ�׶Σ���Ŀ���
  - `project_member` �ս�ɫ���`3 -> 0`

---

## 8. 增量更新�?026-02-27�?

- 财务交易明细页面重构�?
  - 先实现“收�?付款/报销”三分区视图与分区数据加载；
  - 后按业务确认改为单入口方案，仅保留“新增交易明细”按钮与统一交易列表�?
- 新增交易明细能力增强�?
  - 创建交易弹窗支持“上传发票”并随交易提交（`attachments`）�?
  - 交易列表新增“发票附件”列，显示附件数量�?
- 报销能力落地（首版）�?
  - 新增 `CreateReimbursementModal`，支持主体来源账户、关联合�?项目、费用明细与附件�?
  - 报销列表展示费用条目数、状态和金额�?
- 接口与数据结构补齐：
  - 前端 `financeApi.listTransactions` 支持透传 `txn_direction/account_id` 查询�?
  - 后端交易创建接口支持接收并存�?`attachments` 字段�?
  - 报销返回结构补充 `expense_lines`�?
- 422 分页参数修复�?
  - 为兼容前�?`page_size=200`，将以下列表接口分页上限�?`100` 提升�?`200`�?
    - `GET /api/v1/finance/transactions`
    - `GET /api/v1/finance/invoices`
    - `GET /api/v1/finance/reimbursements`
    - `GET /api/v1/contract/contracts`
    - `GET /api/v1/project/projects`
- UI 可用性修复：
  - 交易创建弹窗增加专用样式文件，输入框改为浅色高对比，修复黑底可读性问题�?

---

## 9. 增量更新�?026-02-27 追加�?

- 交易明细业务语义升级�?
  - 新增交易类型 `txn_type`：`receipt` / `payment` / `reimbursement`�?
  - 报销类型统一按支出方向处理（`txn_direction=out`）�?
- 交易对象扩展�?
  - 报销场景新增 `employee_user_id`，交易对象改为选择员工（来自用户管�?`GET /api/v1/iam/users`）�?
  - 非报销场景仍使用对手方 `counterparty_id`�?
- 交易状态体系调整：
  - 状态改为三档：`未完�?unreconciled)`、`已完�?completed)`、`已对�?reconciled)`�?
  - 新增接口：`PATCH /api/v1/finance/transactions/{txn_id}`，支持在交易明细列表中直接编辑状态�?
- 账户余额口径更新�?
  - 账户余额仅统计“已完成/已对账”交易；“未完成”交易不入账�?
- SQLite 兼容修复�?
  - 自动补齐 `finance_transaction.txn_type`、`finance_transaction.employee_user_id`�?
  - 启动时自动规范历史枚举值（`txn_type/reconcile_status`）到 ORM 可识别格式，修复交易列表 500�?
- 前端可用性修复：
  - 报销员工下拉使用用户管理员工列表，修复空列表问题�?
  - 交易列表状态选择器改为浅色高对比样式，修复黑色不可读�?
  - 财务�?IAM 用户请求 `page_size` 调整�?100，修�?422�?

---

## 10. �������£�2026-02-28��

- ��Ŀ����������ԭ��ȷ�ϵ���������ԭ��ȷ�Ͻ׶Σ���
  - ����ǰ�������frontend/src/pages/project/components/PrototypeConfirmModal.jsx
  - ��Ŀ������д��ԭ�͵�ַ/��Ƶ�ַ����ɱ��沢���� Word��
  - ģ�����ȷ��˵������Χ�߽硢ǩ������ͳһ�ĵ���ʽ��

- ��Ŀ�������Խ׶�������Bug ��������������������ͨ��
  - ����ǰ�������frontend/src/pages/project/components/BugManagementModal.jsx
  - ��Ŀ���� testing �׶�������ڡ�Bug��������
  - Bug ��Ϊ��Ŀ�������׷�٣�source_type=project_task + tags=bug/testing����
  - �½� Bug ʱͬʱ���񴴽�һ��������Ա custom ���죬ȷ���ڡ��ҵ����񡱿ɼ���
  - �½���������������Ա��������/����ˣ�+ ������Ա����������ˣ�����
  - Լ��������ѡ����Ա���˿ɴ�������֤�������������Ϊ����Ա����

- Bug ������ǿ��
  - �������ύ���պ����ͨ������ť��pending_review -> done������ todoApi.approve����
  - ������ɾ�� Bug����ť��������ȷ�ϣ���

- ���������Ŀ����ɾ���ӿڣ��� Bug ɾ�����ã���
  - DELETE /api/v1/project/projects/{project_id}/todos/{todo_id}
  - Ȩ�ޣ���Ŀ���� / ��Ŀ������ / ���񴴽��ˡ�

- ����ҳ��ɼ�������Ϣ��ǿ��
  - Todo �б������ҳ��������Ϊ page_size=100�����ⳬ�� 422����
  - ���쿨Ƭ���б���������Ŀ����ǩ������ todo.link.project_name�����ס���Ŀ���񡱣���

