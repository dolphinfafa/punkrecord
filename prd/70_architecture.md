# 系统架构设计文档（V1.0）
> 面向：研发团队 / AI 编程工具  
> 版本：V1.0（2026-01-20）  
> 目标：定义企业管理系统（Atlas）整体架构、技术栈、部署方案与跨模块集成策略。

---

## 1. 系统架构总览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├─────────────────────────┬───────────────────────────────────┤
│   Web Frontend          │   WeChat Mini Program             │
│   (React + Vite)        │   (WXML/WXSS/JS)                  │
│   - Admin Dashboard     │   - Mobile Workbench              │
│   - Complex Forms       │   - Todo Management               │
│   - Data Visualization  │   - Approval Actions              │
└───────────┬─────────────┴──────────────┬────────────────────┘
            │                            │
            │  HTTPS/REST API (JWT Auth) │
            ↓                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Layer                         │
│                    (FastAPI + Python)                        │
├─────────────────────────────────────────────────────────────┤
│  Module APIs:                                                │
│  ┌──────┐ ┌──────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │ IAM  │ │ Todo │ │Contract │ │ Project │ │ Finance │    │
│  └──────┘ └──────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                              │
│  Shared Services:                                            │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐                │
│  │ File Svc   │ │ Audit Log│ │ Approval   │                │
│  └────────────┘ └──────────┘ └────────────┘                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ ORM (SQLModel)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (SQLite)                       │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                     │
│  - IAM: user, role, permission, our_entity, approval_*       │
│  - Todo: todo_item, notification_log                         │
│  - Contract: contract, counterparty, payment_plan            │
│  - Project: project, project_stage, project_member           │
│  - Finance: account, transaction, invoice, reimbursement     │
│  - Mini Program: wechat_user_binding, message_template       │
│  - Shared: audit_log, file_metadata                          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 架构特点

#### 1.2.1 前后端分离
- **Web端**：React SPA，负责复杂表单、数据可视化、管理后台
- **小程序端**：微信小程序，负责移动场景核心功能（待办/审批/查看）
- **后端**：FastAPI统一API，支持多客户端（JWT认证）

#### 1.2.2 模块化设计
- 业务模块独立（IAM/Todo/Contract/Project/Finance/MiniProgram）
- 共享服务复用（File/Audit/Approval）
- 模块间通过API/服务调用集成，避免直接数据库耦合

#### 1.2.3 统一数据层
- SQLite作为V1数据库（简化部署）
- 支持后续迁移到PostgreSQL/MySQL（通过SQLModel ORM抽象）
- 统一数据规范（UUID主键、时间戳、审计字段）

---

## 2. 技术栈选型

### 2.1 前端技术栈

#### 2.1.1 Web Frontend
- **框架**：React 18+ (Vite构建)
- **路由**：React Router v6
- **状态管理**：Zustand / React Query（服务端状态）
- **UI组件**：Ant Design / Material-UI
- **样式**：Vanilla CSS / CSS Modules
- **HTTP客户端**：Axios / Fetch API
- **构建工具**：Vite

#### 2.1.2 WeChat Mini Program
- **主方案**：微信小程序原生开发（WXML/WXSS/JavaScript）
- **备选方案**：uni-app（跨平台，可同时支持支付宝小程序等）
- **状态管理**：MobX / 原生 globalData
- **UI组件**：Vant Weapp / WeUI

### 2.2 后端技术栈

- **框架**：FastAPI 0.100+
- **ORM**：SQLModel (基于SQLAlchemy + Pydantic)
- **数据库**：SQLite (V1) → PostgreSQL/MySQL (V2)
- **认证**：JWT (python-jose) + bcrypt密码哈希
- **文件存储**：本地文件系统 (V1) → OSS/S3 (V2)
- **任务队列**：Celery + Redis (V1.1，用于异步通知、OCR)
- **API文档**：FastAPI自动生成 (Swagger/ReDoc)

### 2.3 开发与部署

- **开发环境**：
  - Python 3.11+ (虚拟环境: punkrecord)
  - Node.js 18+ / pnpm
- **版本控制**：Git
- **部署方案（V1）**：
  - 单机部署：Nginx + Uvicorn (后端) + 静态文件托管 (前端)
  - 小程序：微信开发者工具 → 微信小程序后台审核发布
- **部署方案（V2）**：
  - Docker容器化部署
  - Kubernetes集群（可选）

---

## 3. 核心模块集成策略

### 3.1 IAM与权限集成

#### 3.1.1 认证流程
- **Web端**：
  1. 用户登录 → 后端验证 → 返回JWT Token
  2. 前端存储Token（localStorage/sessionStorage）
  3. 每次请求携带Token（Authorization Header）
  
- **小程序端**：
  1. 微信登录 → 获取code
  2. 后端调用微信API换取openid/unionid
  3. 绑定user_id → 返回JWT Token
  4. 小程序存储Token（wx.setStorageSync）

#### 3.1.2 鉴权策略
- 后端API使用依赖注入（Dependency Injection）进行鉴权
- 每个API端点声明所需权限（permission code）
- 中间件自动验证用户角色与权限

### 3.2 Todo与业务模块集成

#### 3.2.1 待办生成规则
| 来源模块 | 触发条件 | source_type | action_type |
|---------|---------|-------------|-------------|
| Project | 创建任务 | project_task | do |
| Contract | 尾款到期前30天 | contract_reminder | do |
| Approval | 审批步骤pending | approval_step | approve |
| Finance | OCR需要复核 | finance_action | review |

#### 3.2.2 集成方式
- **服务调用**：业务模块调用Todo Service创建待办
- **事件驱动**（V1.1）：通过事件总线异步生成待办

### 3.3 Approval引擎集成

#### 3.3.1 审批对象
- 合同审批（contract）
- 开票申请审批（invoice_request）
- 报销审批（reimbursement）

#### 3.3.2 审批流程
1. 业务模块提交审批对象 → 调用Approval Service
2. Approval Service创建approval_instance + steps
3. 为每个pending step创建Todo（给审批人）
4. 审批人操作 → 更新step状态 → 关闭Todo → 触发下一步或完成

### 3.4 数据联动

#### 3.4.1 合同-项目联动
- B2B项目可关联合同（project.contract_id）
- 合同签署 → 可自动推进项目阶段（contract_signed → done）

#### 3.4.2 合同-财务联动
- 流水关联分期 → 回写paid_amount/status
- 发票关联合同/分期 → 资金进度更新

---

## 4. 数据库设计规范

### 4.1 命名规范

- **表名**：snake_case，模块前缀（如 `finance_transaction`）
- **字段名**：snake_case
- **主键**：统一使用UUID，字段名 `*_id`
- **外键**：字段名 `*_id`，对应目标表主键

### 4.2 通用字段

所有业务表必须包含：
```python
created_at: datetime  # 创建时间
updated_at: datetime  # 更新时间
```

核心业务表（合同/项目/财务）必须包含：
```python
our_entity_id: UUID  # 我方主体ID
```

### 4.3 软删除策略

- 核心数据（用户/合同/项目）使用软删除
- 增加字段：`deleted_at` / `is_deleted`
- 查询时默认过滤已删除数据

### 4.4 审计日志

所有关键操作必须记录到 `audit_log` 表：
- 对象创建/修改/删除
- 状态流转（审批/付款/阶段推进）
- 权限变更

---

## 5. API设计规范

### 5.1 RESTful API规范

- **资源路径**：`/api/v1/{module}/{resource}`
  - 例：`/api/v1/contract/contracts`
- **HTTP方法**：
  - GET：查询
  - POST：创建
  - PUT/PATCH：更新
  - DELETE：删除
- **状态码**：
  - 200：成功
  - 201：创建成功
  - 400：请求错误
  - 401：未认证
  - 403：无权限
  - 404：资源不存在
  - 500：服务器错误

### 5.2 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

错误响应：
```json
{
  "code": 400,
  "message": "Validation error",
  "errors": [
    {"field": "name", "message": "This field is required"}
  ]
}
```

### 5.3 分页规范

```
GET /api/v1/contract/contracts?page=1&page_size=20
```

响应：
```json
{
  "code": 0,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "pages": 5
  }
}
```

---

## 6. 文件存储策略

### 6.1 存储方案（V1）

- **本地文件系统**：
  - 路径：`/data/files/{module}/{year}/{month}/{uuid}.{ext}`
  - 例：`/data/files/contract/2026/01/uuid-xxx.pdf`

### 6.2 附件元数据

统一存储到 `file_metadata` 表：
```python
file_id: UUID
filename: str
content_type: str
size: int
storage_path: str
uploaded_by: UUID
uploaded_at: datetime
related_object_type: str  # contract/project/invoice
related_object_id: UUID
```

### 6.3 访问控制

- 文件访问通过后端API中转
- API验证用户权限后返回文件流或预签名URL

---

## 7. 通知与消息策略

### 7.1 通知渠道（V1）

| 渠道 | 场景 | 优先级 |
|-----|------|-------|
| 站内通知 | 所有待办/审批 | P0 |
| 小程序订阅消息 | 待办到期/审批通知 | P1 |
| 邮件（可选） | 重要审批/合同提醒 | P2 |

### 7.2 订阅消息模板（小程序）

| 模板编码 | 场景 | 字段 |
|---------|------|------|
| `todo_due_reminder` | 待办到期提醒 | 任务标题、截止时间、优先级 |
| `approval_pending` | 审批通知 | 审批类型、提交人、申请时间 |
| `contract_payment_reminder` | 合同尾款提醒 | 合同名称、金额、到期日期 |

---

## 8. 部署架构（V1）

### 8.1 单机部署方案

```
┌─────────────────────────────────────┐
│         Server (Linux/Docker)       │
├─────────────────────────────────────┤
│  Nginx                              │
│  ├─ /api → Uvicorn (FastAPI)       │
│  ├─ /     → Static Files (React)   │
│  └─ /files → File Storage           │
├─────────────────────────────────────┤
│  SQLite Database                    │
│  /data/db/atlas.db                  │
├─────────────────────────────────────┤
│  File Storage                       │
│  /data/files/                       │
└─────────────────────────────────────┘
```

### 8.2 小程序部署

- 微信开发者工具上传代码
- 微信小程序后台提审
- 审核通过后发布上线

---

## 9. Todo List（系统架构实施）

### 9.1 基础设施
- [ ] 初始化项目结构（backend/frontend/miniprogram）
- [ ] 配置SQLite数据库与ORM（SQLModel）
- [ ] 实现统一响应格式与异常处理
- [ ] 配置CORS与安全中间件

### 9.2 认证与鉴权
- [ ] 实现JWT认证中间件
- [ ] 实现RBAC权限验证装饰器
- [ ] Web端登录API
- [ ] 小程序微信登录API

### 9.3 共享服务
- [ ] File Service（上传/下载/元数据）
- [ ] Audit Log Service（记录/查询）
- [ ] Approval Engine（流程/实例/步骤）

### 9.4 业务模块
- [ ] IAM模块API（用户/角色/权限/主体）
- [ ] Todo模块API（待办CRUD/状态流转）
- [ ] Contract模块API（合同/分期/审批）
- [ ] Project模块API（项目/阶段/任务）
- [ ] Finance模块API（账户/流水/发票/报销）

### 9.5 前端实现
- [ ] Web端：路由与布局
- [ ] Web端：IAM/Todo/Contract/Project/Finance页面
- [ ] 小程序：登录与工作台
- [ ] 小程序：待办/审批/合同/项目/财务页面

### 9.6 集成与测试
- [ ] 跨模块集成测试（B2B闭环/报销闭环）
- [ ] 小程序与后端API联调
- [ ] UAT测试（按各模块验收标准）

---

## 10. 技术风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| SQLite性能瓶颈 | 高并发场景性能下降 | V1限定用户规模；V2迁移PostgreSQL |
| 微信API限制 | 订阅消息受限（频次/模板） | 优先级排序、合并通知 |
| 文件存储容量 | 本地磁盘空间不足 | 定期清理、V2迁移OSS |
| 审批流程复杂化 | V1固定流程不满足需求 | 预留流程配置接口、V1.1支持动态流程 |

---
