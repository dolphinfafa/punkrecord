---
description: 工程索引 — PunkRecord 企业管理系统（供 Agent 快速定位代码结构，每次工作后须更新）
---

> **Agent 注意**：每次开始任务前必须先阅读本文件，完成任务后若有结构性变更须更新对应章节。

---

## 1. 目录结构（3 层）

```
punkrecord/
├── backend/                  # Python FastAPI 后端
│   ├── app/
│   │   ├── api/              # 路由层：auth, iam, todo, contract, project, finance, ai
│   │   ├── core/             # 基础设施：config, database, auth, security, response, exceptions, init_db
│   │   ├── models/           # SQLModel ORM 表：base, iam, todo, contract, project, finance, shared, approval
│   │   ├── schemas/          # Pydantic DTO：todo, contract, project, finance
│   │   ├── services/         # 服务层（当前较薄）
│   │   └── utils/
│   ├── migrations/           # Alembic 迁移脚本
│   ├── tests/                # 验证脚本
│   └── requirements.txt
├── frontend/                 # React + Vite 前端
│   └── src/
│       ├── api/              # Axios 请求封装（按模块）
│       ├── components/
│       │   ├── common/       # Modal 等通用组件
│       │   ├── layout/       # Layout, Sidebar
│       │   └── todo/         # TodoModal, TodoDetailModal
│       ├── contexts/         # AuthContext（全局认证状态）
│       ├── hooks/            # 自定义 Hook
│       ├── pages/            # 页面：auth, dashboard, finance, iam, contract, project, todo
│       └── utils/
├── apps/api/                 # NestJS API（新技术栈探索，使用 Prisma）
├── prd/                      # 产品需求文档（00~80 编号）
├── milestone/                # 按日期记录的里程碑
└── .agent/workflows/         # Agent 工作流 & 本索引文件
```

---

## 2. 关键模块职责

| 模块 | 后端路由前缀 | 职责 |
|------|------------|------|
| **auth** | `/api/v1` | 登录(`/login`)、登出(`/logout`)、当前用户(`/me`)；JWT Bearer Token |
| **iam** | `/api/v1` | 用户、部门(OrgUnit)、职位(JobTitle)、法人主体(OurEntity)、角色权限、组织架构图 |
| **todo** | `/api/v1/todos` | 待办全生命周期：创建→开始→提交→审批→完成/拒绝/阻塞/忽略 |
| **contract** | `/api/v1` | 合同、对手方(Counterparty)、付款计划(PaymentPlan)、合同提交审批 |
| **project** | `/api/v1` | 项目、阶段(Stage)、成员、待办关联、报价单导出Excel、功能清单、AI生成开发任务、合同画布、合同Word导出 |
| **finance** | `/api/v1` | 账户(FinanceAccount)、收支流水(Transaction)、发票(Invoice)、报销(Reimbursement) |
| **ai** | `/api/v1/ai` | AI 对话(`/chat`)、流式对话(`/chat-stream`) |

**前端模块**

| 目录 | 职责 |
|------|------|
| `pages/auth` | 登录页 |
| `pages/dashboard` | 仪表盘 |
| `pages/project` | 项目列表/详情页，含多个 Modal 子组件 |
| `pages/finance` | 账户列表、流水列表 |
| `pages/iam` | 用户列表、部门、职位、法人主体、组织架构图 |
| `pages/contract` | 合同列表、对手方列表 |
| `pages/todo` | 待办页（含 TodoModal、TodoDetailModal） |
| `contexts/AuthContext` | 全局用户状态、token 管理、自动刷新 |

---

## 3. 核心数据模型（简写）

所有表继承 `BaseDBModel`（含 `id: UUID`, `created_at`, `updated_at`）。

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

# Project
Project: name, type(internal/client), status(planning/active/on_hold/completed/cancelled),
         entity_id→OurEntity, contract_id→Contract, budget
ProjectStage: project_id, name, status(pending/active/done), order, description
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
1. `POST /api/v1/login` → 返回 `access_token`(JWT)
2. 前端存入 `localStorage`，后续请求 Header：`Authorization: Bearer <token>`
3. Token 有效期 1440 分钟（`AuthContext` 自动在过期前刷新）

### Todo 生命周期
```
pending → [start] → in_progress → [submit] → submitted
    → [approve] → done
    → [reject]  → rejected
in_progress / submitted → [block]   → blocked
Any → [dismiss] → dismissed
```

### 项目 → Todo 关联
`project.py` `POST /projects/{id}/generate-dev-tasks` 调用 AI 生成 `TodoItem`（source_type=project_task），绑定 project_id 和 stage 信息。

### 合同 → 项目关联
`Project.contract_id` FK 指向 `Contract`；`/projects/{id}/contract-context` 聚合合同信息用于 AI 画布。

---

## 5. 常用命令

```bash
# 后端（在 backend/ 目录）
source ../punkrecord/bin/activate          # 激活 venv（Python 3.9）
uvicorn app.main:app --reload --port 8000  # 启动开发服务器
alembic upgrade head                        # 运行迁移
alembic revision --autogenerate -m "desc"  # 生成迁移
python create_admin.py                      # 创建管理员账号
python init_database.py                     # 初始化基础数据

# 前端（在 frontend/ 目录）
npm run dev          # 启动开发服务器（端口 5173）
npm run build        # 构建生产包
npm run lint         # ESLint 检查
npm run preview      # 预览生产包

# 健康检查
curl http://localhost:8000/health
```

---

## 6. 约定

### 命名
- **后端文件**：snake_case；**前端文件**：PascalCase（组件）/ camelCase（工具、hooks）
- **API 路由**：kebab-case，例如 `/payment-plans`, `/our-entities`
- **数据库列**：snake_case；**前端变量**：camelCase

### API 响应格式
```json
// 成功
{ "data": {...}, "message": "ok" }
// 错误（AtlasException）
{ "code": 400, "message": "具体错误信息" }
```

### 环境变量（`backend/.env`）
- `DB_TYPE=sqlite`（开发）/ `mysql`（生产）
- `SQLITE_DB_PATH=./atlas.db`
- `SECRET_KEY=...`（JWT 签名密钥）
- `BACKEND_CORS_ORIGINS=["http://localhost:5173"]`
- `ACCESS_TOKEN_EXPIRE_MINUTES=1440`

### 数据库
- **开发**：SQLite（atlas.db，已加入 .gitignore，不提交）
- **生产**：MySQL，通过 `DB_TYPE=mysql` 切换
- ORM：SQLModel（SQLAlchemy + Pydantic）；迁移工具：Alembic

### 错误码
- `400` 参数错误 / 业务逻辑错误
- `401` 未认证
- `403` 无权限
- `404` 资源不存在
- `500` 服务器内部错误

### 日志格式（main.py 中间件）
```
📥 Incoming request: {METHOD} {path}
📤 Response status: {status_code}
❌ Request failed: {ExceptionType}: {message}
```

---

*最后更新：2026-02-24 | 如有结构性变更请同步更新本文件*