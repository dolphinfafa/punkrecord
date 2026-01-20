# Atlas Enterprise Management System - Backend API

Backend service for the Atlas Enterprise Management System, providing RESTful APIs for all business modules.

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/yangzhe/workspace/punkrecord
source punkrecord/bin/activate
cd backend
pip install -r requirements.txt
```

### 2. Initialize Database

```bash
python -m app.core.init_db
```

This will create the SQLite database and load seed data:
- Default admin user: `admin` / `admin123`
- Default company entity
- Default roles and permissions

### 3. Start Server

```bash
# From project root
./scripts/start_backend.sh

# Or manually
cd backend
uvicorn app.main:app --reload --port 8000
```

The API will be available at: `http://localhost:8000`

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login

### IAM (Identity & Access Management)
- `POST /api/v1/iam/users` - Create user
- `GET /api/v1/iam/users` - List users
- `GET /api/v1/iam/users/{id}` - Get user
- `PATCH /api/v1/iam/users/{id}` - Update user
- `POST /api/v1/iam/our-entities` - Create entity
- `GET /api/v1/iam/our-entities` - List entities

### Todo
- `POST /api/v1/todo` - Create todo
- `GET /api/v1/todo/my` - Get my todos
- `GET /api/v1/todo/{id}` - Get todo
- `PATCH /api/v1/todo/{id}` - Update todo
- `POST /api/v1/todo/{id}/done` - Mark as done
- `POST /api/v1/todo/{id}/block` - Block todo
- `POST /api/v1/todo/{id}/dismiss` - Dismiss todo

### Contract
- `POST /api/v1/contract/counterparties` - Create counterparty
- `GET /api/v1/contract/counterparties` - List counterparties
- `POST /api/v1/contract/contracts` - Create contract
- `GET /api/v1/contract/contracts` - List contracts
- `GET /api/v1/contract/contracts/{id}` - Get contract
- `PATCH /api/v1/contract/contracts/{id}` - Update contract
- `GET /api/v1/contract/contracts/{id}/payment-plans` - Get payment plans
- `POST /api/v1/contract/contracts/{id}/submit` - Submit for approval

### Project
- `POST /api/v1/project/projects` - Create project
- `GET /api/v1/project/projects` - List projects
- `GET /api/v1/project/projects/{id}` - Get project
- `PATCH /api/v1/project/projects/{id}` - Update project
- `GET /api/v1/project/projects/{id}/stages` - Get project stages
- `PATCH /api/v1/project/stages/{id}` - Update stage status

### Finance
- `POST /api/v1/finance/accounts` - Create account
- `GET /api/v1/finance/accounts` - List accounts
- `POST /api/v1/finance/transactions` - Create transaction
- `GET /api/v1/finance/transactions` - List transactions
- `GET /api/v1/finance/transactions/{id}` - Get transaction
- `POST /api/v1/finance/invoices` - Create invoice
- `GET /api/v1/finance/invoices` - List invoices
- `POST /api/v1/finance/reimbursements` - Create reimbursement
- `GET /api/v1/finance/reimbursements` - List reimbursements

## Example Usage

### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Response:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "eyJ...",
    "token_type": "bearer",
    "user_id": "...",
    "display_name": "Administrator"
  }
}
```

### Create Todo (Authenticated)
```bash
curl -X POST http://localhost:8000/api/v1/todo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "our_entity_id": "...",
    "assignee_user_id": "...",
    "title": "Test Todo",
    "source_type": "custom",
    "source_id": "test-1",
    "action_type": "do"
  }'
```

## Database Schema

The system uses SQLite with the following main tables:

**IAM Module**:
- `user` - User accounts
- `role` - User roles
- `permission` - Permissions
- `user_role` - User-role assignments
- `our_entity` - Company entities

**Todo Module**:
- `todo_item` - Task items
- `notification_log` - Notifications

**Contract Module**:
- `contract` - Contracts
- `counterparty` - Customers/suppliers
- `contract_payment_plan` - Payment installments

**Project Module**:
- `project` - Projects
- `project_stage` - Project stages
- `project_member` - Team members

**Finance Module**:
- `finance_account` - Bank accounts
- `finance_transaction` - Transactions
- `finance_invoice` - Invoices
- `reimbursement` - Reimbursements

**Shared**:
- `audit_log` - Audit trail
- `file_metadata` - File storage
- `approval_flow` - Approval workflows
- `approval_instance` - Approval instances
- `approval_step` - Approval steps

## Development

### Project Structure
```
backend/
├── app/
│   ├── api/          # API endpoints
│   ├── core/         # Core utilities (config, db, auth)
│   ├── models/       # Database models
│   ├── schemas/      # Pydantic schemas
│   ├── services/     # Business logic
│   └── utils/        # Helper functions
├── requirements.txt
└── atlas.db         # SQLite database
```

### Adding New Endpoints

1. Create schema in `app/schemas/`
2. Create API router in `app/api/`
3. Import and include router in `app/main.py`
4. Test with Swagger UI

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Application
APP_NAME=Atlas Enterprise Management System
DEBUG=True

# Database
DATABASE_URL=sqlite:///./atlas.db

# Security
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
```

## Technology Stack

- **Framework**: FastAPI 0.109.0
- **ORM**: SQLModel 0.0.14
- **Database**: SQLite
- **Auth**: JWT (python-jose)
- **Password**: bcrypt (passlib)
- **Validation**: Pydantic 2.5.3
