---
description: Complete project index for PunkRecord. Read first before coding tasks.
---

# Project Index

Purpose: give agents a fast and reliable map of this repository so they can locate code with minimal scanning.

Usage rule:
- Read this file before starting any task.
- Update only impacted sections after structural changes.
- Keep this file focused on "where" and "what", not implementation details.

## 1. Repository Structure

```text
punkrecord/
|- backend/
|  |- app/
|  |  |- api/                 # FastAPI routers
|  |  |- core/                # config, db, auth, response, exception handling
|  |  |- models/              # SQLModel ORM models
|  |  |- schemas/             # Pydantic request/response schemas
|  |  |- services/            # business services (exports, AI-related logic)
|  |  `- utils/
|  |- db_migrations/          # Alembic migrations
|  |- tests/
|  |- create_admin.py
|  |- init_database.py
|  |- requirements.txt
|  `- app/main.py             # FastAPI app bootstrap
|- frontend/
|  `- src/
|     |- api/                 # API wrappers
|     |- components/
|     |  |- common/
|     |  |- layout/
|     |  `- todo/
|     |- contexts/            # Auth context and session state
|     |- hooks/
|     |- pages/               # route pages by business domain
|     `- utils/
|- apps/api/                  # experimental NestJS API area
|- prd/                       # product requirement docs
|- milestone/                 # dated milestone records
`- .agent/workflows/          # workflow docs and this project index
```

## 2. Backend Architecture

Entry point:
- `backend/app/main.py`
- Registers routers with prefix `/api/v1`.
- Adds CORS middleware.
- Defines request logging middleware.
- Handles `AtlasException` and generic exceptions.
- Initializes database on startup (`create_db_and_tables`).

Router modules in `backend/app/api`:
- `auth.py` -> `/api/v1/auth`
- `iam.py` -> `/api/v1/iam`
- `todo.py` -> `/api/v1/todo`
- `contract.py` -> `/api/v1/contract`
- `project.py` -> `/api/v1/project`
- `finance.py` -> `/api/v1/finance`
- `ai.py` -> `/api/v1/ai`

## 3. API Surface (Key Endpoints)

Auth:
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

IAM:
- Job titles: `GET/POST/PATCH/DELETE /api/v1/iam/job-titles`
- Departments: `GET/POST/PATCH/DELETE /api/v1/iam/departments`
- Users: `POST /api/v1/iam/users`, `GET /api/v1/iam/users`, `GET/PATCH /api/v1/iam/users/{user_id}`
- Leave reset: `POST /api/v1/iam/users/{user_id}/reset-leave-balances`, `POST /api/v1/iam/users/reset-leave-balances`
- Entities/org: `GET /api/v1/iam/entities`, `GET /api/v1/iam/org-chart`, `GET/POST /api/v1/iam/our-entities`
- BELI rules: `GET/POST/PATCH/DELETE /api/v1/iam/beli-rules`

Todo:
- Todo CRUD/lifecycle: create, my/team list, detail/update, `start/submit/approve/reject/done/block/dismiss/status`
- Leave flow: `POST /api/v1/todo/leaves`, `GET /api/v1/todo/leaves/my`, `GET /api/v1/todo/leaves/team/pending`, approve/reject endpoints

Contract:
- Counterparties: `POST/GET /api/v1/contract/counterparties`
- Contracts: create/list/detail/update/submit
- Payment plans: `GET /api/v1/contract/contracts/{contract_id}/payment-plans`

Project:
- Projects: create/list/detail/update/delete
- Stages: list/update + stage attachment upload/download/delete
- Project attachments: list/upload/download/delete
- Members: add/remove/list
- Project todos: list, assign, plan, delete, sync
- Exports and context:
  - `POST /api/v1/project/export_quote_excel`
  - `POST /api/v1/project/export-contract-docx`
  - `GET /api/v1/project/projects/{project_id}/acceptance-report/download`
  - `GET /api/v1/project/projects/{project_id}/contract-context`
  - `POST /api/v1/project/projects/{project_id}/generate-dev-tasks`

Finance:
- Accounts: create/list/update
- Transactions: create/list/detail/update
- Invoices: create/list
- Reimbursements: create/list

AI:
- `POST /api/v1/ai/chat`
- `POST /api/v1/ai/chat-stream`

Health/basic:
- `GET /health`
- `GET /`

## 4. Core Data Models

Model files (`backend/app/models`):
- `base.py`: shared base model fields
- `iam.py`: users, departments/org units, job titles, entities, memberships
- `todo.py`: todo items, leave requests
- `project.py`: project, stages, members, project-related structures
- `contract.py`: contracts, counterparties, payment plans
- `finance.py`: finance accounts, transactions, invoices, reimbursements
- `approval.py`, `shared.py`: shared/approval-related models

Common model groups:
- IAM: `User`, `OrgUnit`, `JobTitle`, `OurEntity`, `OrgMembership`
- Todo: `TodoItem`, `LeaveRequest`
- Project: `Project`, `ProjectStage`, `ProjectMember`
- Contract: `Contract`, `Counterparty`, `ContractPaymentPlan`
- Finance: `FinanceAccount`, `FinanceTransaction`, `FinanceInvoice`, `Reimbursement`

## 5. Frontend Architecture

App entry:
- `frontend/src/App.jsx`
- Uses `BrowserRouter` + nested routes.
- Wraps protected routes with `ProtectedRoute` and `AuthProvider`.

Main routes:
- `/login` -> `pages/auth/LoginPage`
- `/` -> dashboard
- `/todo` -> todo page
- `/iam/*` -> users, entities, departments, job titles, BELI rules, org chart
- `/contract/*` -> contract list, counterparties
- `/project` -> project list
- `/project/:id` -> project detail
- `/project/:id/dev-progress` -> development progress
- `/finance/accounts` and `/finance/transactions`

Layout and state:
- Shared layout: `components/layout/*`
- Auth state: `contexts/AuthContext`
- Domain pages: `src/pages/{auth,dashboard,iam,contract,project,finance,todo}`

## 6. Key Workflows to Understand

1. Authentication flow
- Login returns token.
- Frontend stores session via auth context and sends bearer token.

2. Todo lifecycle
- Typical progression: `pending -> in_progress -> submitted -> done`.
- Also supports blocked/rejected/dismissed transitions.

3. Leave approval
- Employee submits leave request.
- Manager approves/rejects in pending team list.
- Leave balance fields are updated after approval.

4. Project execution
- Project -> stages -> todos.
- Dev tasks can be generated/synced and then assigned/planned.
- Attachments and export endpoints support delivery artifacts.

5. Finance operations
- Accounts and transactions are tracked through finance endpoints.
- Reimbursements and invoices are separate but linked workflows.

## 7. Runbook and Commands

Backend (from `backend/`):
```bash
uvicorn app.main:app --reload --port 8000
alembic upgrade head
python create_admin.py
python init_database.py
```

Frontend (from `frontend/`):
```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Quick checks:
```bash
curl http://localhost:8000/health
```

Python environment policy:
- macOS: `pyenv` environment `punkrecord`.
- Windows: `conda` environment `punkrecord`.
- Activate environment before any Python command.

## 8. Conventions and Contracts

Naming:
- Backend files: `snake_case`
- Frontend components: `PascalCase`
- JS variables/functions: `camelCase`
- API paths: kebab-case style where applicable

Response shape convention:
- Success: `{ "data": ..., "message": "ok" }`
- Error: `{ "code": <int>, "message": <string> }`

Encoding and line endings:
- Workflow files must be UTF-8 (no BOM) and LF.

## 9. Related Workflow Docs

- `.agent/workflows/use-project-index.md`
- `.agent/workflows/python-environment.md`
- Other workflow guides in `.agent/workflows/*.md`

## 10. Maintenance Rules for This Index

When changed, update only impacted sections:
- New/removed directories -> Section 1
- Module responsibility changes -> Sections 2-3
- Data model changes -> Section 4
- Route or page changes -> Sections 3 and 5
- Command/runtime changes -> Section 7
- Conventions changes -> Section 8

Do not add deep implementation details. Keep this as a navigation and orientation document.

---
Last updated: 2026-03-02
