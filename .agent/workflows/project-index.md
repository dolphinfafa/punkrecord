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
|- miniprogram/
|  |- pages/                  # WeChat Mini Program pages (mobile-first)
|  |- custom-tab-bar/         # custom bottom tab bar component
|  |- services/               # API service wrappers for mini program
|  |- utils/                  # request/session helpers
|  |- app.{js,json,wxss}
|  |- project.config.json
|  `- project.private.config.json
|- apps/api/                  # experimental NestJS API area
|- .github/workflows/         # CI workflows
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
- Team task access rule: direct manager can view and edit subordinate todos (in addition to assignee/creator).
- Todo image attachments:
  - `POST /api/v1/todo/{todo_id}/images` (single image upload; repeat for multiple)
  - `GET /api/v1/todo/{todo_id}/images/{image_id}/download`
  - `DELETE /api/v1/todo/{todo_id}/images/{image_id}`
- Todo create modal supports:
  - optional project binding (`source_type=project_task`, `source_id=project_id`)
  - multi-image upload on create (uploaded after todo creation)

Contract:
- Counterparties: `POST/GET /api/v1/contract/counterparties`
- Contracts: create/list/detail/update/submit
- Payment plans: `GET /api/v1/contract/contracts/{contract_id}/payment-plans`

Project:
- Projects: create/list/detail/update/delete
- Stages: list/update + stage attachment upload/download/delete
- Project attachments: list/upload/download/delete
- Members: add/remove/list
- Project todos:
  - `GET /api/v1/project/projects/{project_id}/todos`
  - `POST /api/v1/project/projects/{project_id}/todos/{todo_id}/assign`
  - `POST /api/v1/project/projects/{project_id}/todos/{todo_id}/plan`
  - `POST /api/v1/project/projects/{project_id}/todos/batch-assign`
  - `DELETE /api/v1/project/projects/{project_id}/todos/{todo_id}`
  - `DELETE /api/v1/project/projects/{project_id}/todos` (clear all)
  - `POST /api/v1/project/projects/{project_id}/sync-dev-tasks`
- Project todo list response now carries richer fields used by Bug detail:
  - `link`, `start_at`, `done_at`, `blocked_reason`, `review_comment`, `dismiss_reason`, `created_at`, `updated_at`
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
- Shared image preview for bug screenshots: `components/common/BugImagePreview.jsx` (thumbnail + zoom viewer)
- Reusable Bug detail modal: `components/common/BugDetailModal.jsx` (full-field detail rendering + image gallery)
- Shared todo image preview: `components/common/TodoImagePreview.jsx` (todo attachments preview + zoom viewer)
- Auth state: `contexts/AuthContext`
- Domain pages: `src/pages/{auth,dashboard,iam,contract,project,finance,todo}`

Mini program client (`miniprogram/`):
- Native WeChat mini program structure (`app.js`, `app.json`, `app.wxss`).
- Uses custom tab bar component at `custom-tab-bar/*` for icon + larger-label navigation.
- Mobile-first pages:
  - `pages/login`
  - `pages/home`
  - `pages/todo`
  - `pages/project`
  - `pages/project/detail`
  - `pages/finance`
  - `pages/mine`
  - `pages/contract`
  - `pages/iam`
- UI direction:
  - Prefer the same visual language as the web app (`frontend/src/pages/*`), especially card hierarchy, status badges, and primary action styling.
  - Current mini program theme is aligned to a light `slate + indigo` style for consistency with core web business pages.
- Todo page now contains both personal/team todo views and leave request/review panels.
- Project pages now include:
  - list page with status stats/search and detail entry (`pages/project`)
  - detail page tabs (overview/stages/members/todos) with stage action labels aligned to web naming (`pages/project/detail`)
  - a unified stage attachments entry in stage tab (aggregated across all stages)
- Shared request/session utilities:
  - `utils/request.js`
  - `utils/storage.js`
- API service mapping mirrors web domains:
  - `services/{auth,todo,project,finance,contract,iam}.js`

## 6. Key Workflows to Understand

1. Authentication flow
- Login returns token.
- Frontend stores session via auth context and sends bearer token.
- Mini program login should persist token before requesting `/auth/me`; Mine page can backfill profile via `/auth/me` when local user cache is empty.

2. Todo lifecycle
- Typical progression: `pending -> in_progress -> submitted -> done`.
- Also supports blocked/rejected/dismissed transitions.
- Mini program supports both "My Todos" and "Team Todos" with corresponding action buttons.

3. Leave approval
- Employee submits leave request.
- Manager approves/rejects in pending team list.
- Leave balance fields are updated after approval.
- Mini program `pages/todo` includes leave submit, my leave history, and manager review actions.

4. Project execution
- Project -> stages -> todos.
- Dev tasks in "开发进度" are synced from feature list only when user manually triggers sync.
- Dev task module supports: manual create/edit/delete, batch assign assignee, one-click clear.
- Project todo delete/clear now cascades linked mirrored todos (for example bug tracking + linked fix todo).
- Bug management now supports opening per-bug detail view and uploading multiple bug images.
- Bug creation now writes one bug todo record (no extra mirrored duplicate todo).
- Bug management list view intentionally does not render attachment thumbnails; images are shown in detail modal only.
- Attachments and export endpoints support delivery artifacts.
- Mini program project detail currently supports:
  - stage operation entry labels consistent with web (`功能清单/报价单/AI生成合同/原型确认单/开发进度/Bug管理/验收报告`)
  - stage attachment aggregation + file download
  - project member add/remove for PM/owner users

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
pytest -q tests/test_health.py
pytest -q tests/test_project_workflow.py
```

Frontend (from `frontend/`):
```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Mini program (from `miniprogram/`):
```bash
# Import this directory into WeChat DevTools:
# Project path: <repo>/miniprogram
# Use appid from your WeChat mini program settings
```

Mini program compile note:
- If DevTools reports missing base library (for example `2.31.0` not found),
  update `miniprogram/project.private.config.json` -> `libVersion` to an available version
  (current project baseline: `3.6.3`), then clear DevTools cache and recompile.

Quick checks:
```bash
curl http://localhost:8000/health
```

Python environment policy:
- Requirements:
  - macOS: `pyenv`, environment name `punkrecord`
  - Windows: `conda`, environment name `punkrecord`
- Command rules:
  1. Detect OS first.
  2. Activate environment before any Python command.
  3. Run Python command only after activation.
- Activation:
```bash
# macOS
pyenv activate punkrecord

# Windows
conda activate punkrecord
```
- Notes:
  - Never run project Python commands outside the `punkrecord` environment.
  - If shell activation is unavailable, use an equivalent isolated execution method.

Backend runtime safety defaults:
- Startup no longer auto-applies schema changes by default.
- Use env flags only when explicitly needed:
  - `AUTO_CREATE_TABLES_ON_STARTUP`
  - `AUTO_RUN_MIGRATIONS_ON_STARTUP`
- RBAC enforcement supports phased rollout with:
  - `ENFORCE_RBAC` (default off for compatibility)

## 8. Conventions and Contracts

Naming:
- Backend files: `snake_case`
- Frontend components: `PascalCase`
- JS variables/functions: `camelCase`
- API paths: kebab-case style where applicable
- Mini program pages follow `pages/<module>/index.*` convention
- Mini program styles use `rpx` for responsive mobile layout
- Mini program user-facing labels should be Chinese by default; keep backend enum/raw values in JS logic and map them to Chinese only for display.

Response shape convention:
- Success: `{ "data": ..., "message": "ok" }`
- Error: `{ "code": <int>, "message": <string> }`

Authorization convention:
- API handlers should use `require_permission("<module>.<read|write>")` where applicable.
- Current permission modules in use include: `iam`, `todo`, `contract`, `project`, `finance`.
- Project Bug assignee update rule:
  - PM/owner can edit full planning fields.
  - Any project member can change bug assignee, but cannot edit other planning fields.

Encoding and line endings:
- Workflow files must be UTF-8 (no BOM) and LF.

## 9. Related Workflow Docs

- `.agent/workflows/use-project-index.md`
- Other workflow guides in `.agent/workflows/*.md`

CI:
- GitHub Actions workflow: `.github/workflows/ci.yml`
- Current CI scope:
  - Backend smoke test (`pytest -q tests/test_health.py`)
  - Frontend smoke build (`npm run test:smoke`)

## 10. Maintenance Rules for This Index

When changed, update only impacted sections:
- New/removed directories -> Section 1
- Module responsibility changes -> Sections 2-3
- Data model changes -> Section 4
- Route or page changes -> Sections 3 and 5
- Command/runtime changes -> Section 7
- Conventions changes -> Section 8

Do not add deep implementation details. Keep this as a navigation and orientation document.

## 11. Change Safety and Regression Guardrails

Purpose:
- Prevent "change in A breaks B" across UI, business logic, API contracts, data flow, and runtime behavior.

### 11.1 Scope and Boundary Rules
- Keep module boundaries explicit: business module A must not directly couple to module B internals.
- Shared logic must live in common/service layers; avoid cross-module copy-paste and hidden dependencies.
- For frontend styles, avoid broad global selectors in business pages; prefer page-scoped naming and shared components.

### 11.2 Contract and Compatibility Rules
- Backend API request/response schemas are contracts; contract changes must be backward-compatible by default.
- Breaking contract changes require explicit versioning or coordinated frontend/backend release.
- For high-risk fields/enums, add compatibility handling during transition windows.

### 11.3 Risk Classification (Required in each change)
- `low`: local UI/content updates with no shared dependency impact.
- `medium`: shared component/style/util changes, non-breaking API behavior updates.
- `high`: cross-module behavior changes, auth/permission logic, data model/schema changes, workflow/state-machine changes.
- `high` changes require stricter review, wider regression scope, and staged rollout.

### 11.4 Testing and Regression Requirements
- Unit tests: core business rules, validators, state transitions.
- Integration tests: cross-module API/service interactions and persistence behavior.
- End-to-end tests: critical user journeys (auth, todo lifecycle, project create/edit/detail flow, finance core flows).
- Any change in A must run A tests plus dependent-path tests for affected B workflows.
- UI changes must include interaction checks: scroll, modal open/close, submit/cancel, responsive behavior.

### 11.5 PR/Review Gate Requirements
- Every PR must state: impacted modules, risk level, contract/data changes, and regression checklist.
- Changes touching shared components/styles/contracts require at least one owner review from affected domain.
- Changes involving overflow/position/layout/modal behavior should include before/after screenshots or short recordings.

### 11.6 Data and Migration Safety
- Use non-breaking migration sequence where applicable: expand -> migrate -> contract.
- Avoid destructive schema/data changes without rollback or fallback strategy.
- Validate migration scripts and data compatibility before full rollout.

### 11.7 Release and Rollback Strategy
- Prefer feature flags for high-impact behavior changes.
- Roll out in stages (small scope first), then expand after checks pass.
- Ensure quick rollback path exists (flag off, compatible fallback, or safe revert plan).

### 11.8 Observability and Post-change Verification
- Monitor key metrics by module after release: error rate, latency, critical business success rate.
- Add targeted logs/traces for changed critical paths to speed regression diagnosis.
- If regression occurs, run root-cause review and convert lessons into tests/checklists/gates.

---
Last updated: 2026-03-04
