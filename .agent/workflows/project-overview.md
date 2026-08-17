---
description: PunkRecord 项目技术全景文档。帮助开发者快速理解项目架构、技术选型与数据结构。
encoding: UTF-8
line-ending: LF
---

# PunkRecord 项目技术全景

> 本文档旨在帮助新成员或协作 Agent 快速理解 PunkRecord 的整体技术架构。
> 如需查找具体文件路径和模块定位，请参阅 `project-index.md`。

---

## 目录

- [1. 项目简介](#1-项目简介)
- [2. 技术选型与理由](#2-技术选型与理由)
- [3. 系统架构总览](#3-系统架构总览)
- [4. 后端 API 架构](#4-后端-api-架构)
- [5. 数据库设计](#5-数据库设计)
- [6. 前端架构](#6-前端架构)
- [7. 微信小程序架构](#7-微信小程序架构)
- [8. 认证与权限体系](#8-认证与权限体系)
- [9. AI 能力集成](#9-ai-能力集成)
- [10. 文档维护约定](#10-文档维护约定)

---

## 1. 项目简介

PunkRecord 是一套面向中小型团队的**企业级项目管理平台**，覆盖以下核心业务域：

| 业务域 | 能力概述 |
|--------|---------|
| IAM | 用户、部门（树形）、职位、组织架构、实体管理、RBAC 权限 |
| Todo | 任务全生命周期、看板拖拽、团队协作、图片附件粘贴/预览 |
| Leave | 请假申请与审批、额度自动扣减、年度重置 |
| Project | B2B/B2C 项目管理、阶段流转、开发进度、Bug 管理、验收报告 |
| Contract | 三方合同管理、PDF/图片附件、AI 智能生成、Word 导出 |
| Finance | 账户、交易、发票、报销、实时余额 |
| Beli | 积分激励体系、规则引擎、自动结算 |
| KB (企业大脑) | 知识库文档管理、AI 自动分类标签、RAG 语义检索对话 |
| Meeting (会议记录) | 音频上传、ASR 转写（豆包）、重新转写、Word/PDF 文稿导入、转写稿编辑、插入/删除分段、新增讲话人、说话人标注/切换、会议日期、参会人自动同步、预设/自定义提示词、引用历史会议、AI 会议纪要、搜索、归档到企业大脑 |

平台提供三个客户端：Web 管理后台、微信小程序（移动端）、RESTful API。

---

## 2. 技术选型与理由

### 2.1 后端

| 技术 | 版本 | 选型理由 |
|------|------|---------|
| **Python** | 3.10+（Dev/Deploy 均需 3.10+，MCP 服务依赖） | 团队熟悉度高，生态丰富，AI 集成天然优势。代码仍优先使用 `Optional[X]` 以保持风格一致。 |
| **FastAPI** | 0.109.0 | 异步高性能，自动生成 OpenAPI 文档，类型安全，开发效率高 |
| **SQLModel** | 0.0.14 | 融合 SQLAlchemy ORM 与 Pydantic 校验，一套模型同时用于数据库和 API |
| **Alembic** | 1.13.1 | SQLAlchemy 生态的标准迁移工具，支持版本化和回滚 |
| **PyMySQL** | 1.1.0 | 纯 Python MySQL 驱动，无需编译 C 扩展，部署简单 |
| **python-jose** | 3.3.0 | JWT 标准实现，搭配 HS256 算法，轻量安全 |
| **passlib + bcrypt** | 1.7.4 | 业界标准密码哈希方案，抗暴力破解 |
| **python-docx** | 1.1.0+ | 服务端生成 Word 文档（合同、验收报告），无需依赖 Office |
| **openpyxl + pandas** | 3.1.0+ / 2.0.0+ | Excel 导出（报价单、功能清单），数据处理能力强 |
| **ChromaDB** | 1.5.5 | 嵌入式向量数据库，企业大脑 RAG 语义检索 |
| **PyPDF2** | 3.0.1 | PDF 文本提取，知识库文档解析 |
| **Uvicorn** | 0.27.0 | ASGI 服务器，支持热重载，适配 FastAPI 的异步特性 |

### 2.2 前端

| 技术 | 版本 | 选型理由 |
|------|------|---------|
| **React** | 19.2.0 | 组件化开发范式成熟，社区生态最大，团队经验丰富 |
| **Vite** | 7.2.4 | 极速冷启动与 HMR，原生 ESM 支持，替代 Webpack 的现代方案 |
| **React Router** | 7.12.0 | React 生态标准路由库，支持嵌套路由与懒加载 |
| **Axios** | 1.13.2 | 功能完善的 HTTP 客户端，拦截器机制适合统一鉴权处理 |
| **Lucide React** | 0.562.0 | 轻量、风格统一的图标库，Tree-shakable |
| **date-fns** | 4.1.0 | 模块化日期处理，按需引入体积小，替代 Moment.js |
| **xlsx** | 0.18.5 | 前端直接读写 Excel，支持功能清单导入 |
| **react-markdown** | 10.1.0 | Markdown 渲染（AI 生成合同预览） |
| **Tailwind CSS** | (内联风格) | 原子化 CSS，快速构建一致的企业级 UI |

### 2.3 微信小程序

| 技术 | 说明 |
|------|------|
| **原生微信小程序框架** | 无额外框架依赖，编译快、体积小、兼容性最佳 |
| **wx.request** | 封装为 Promise 风格，统一鉴权与错误处理 |
| **自定义 TabBar** | 原生组件定制，支持大字号标签与图标导航 |

选择原生框架而非 Taro/uni-app 的原因：项目功能明确、页面数量可控，原生方案避免了跨框架的兼容性开销和调试黑盒。

### 2.4 数据库

| 方案 | 场景 | 说明 |
|------|------|------|
| **MySQL 8.0** | 开发/生产环境 | 成熟稳定，适合中小规模业务数据 |
| **SQLite** | 本地快速启动（可选） | 零配置，通过 `DB_TYPE=sqlite` 切换 |

通过 `DB_TYPE` 环境变量实现零侵入切换。实际开发和生产环境均使用 MySQL 8.0（连接信息见 `backend/.env`）。

---

## 3. 系统架构总览

```
                        +---------------------+
                        |    Nginx / CDN      |
                        +----------+----------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
    +---------v--------+  +-------v--------+  +--------v---------+
    |  React SPA       |  |  WeChat Mini   |  |  第三方系统       |
    |  (Web 管理后台)   |  |  Program       |  |  (API 对接)      |
    |  Vite + React 19 |  |  (移动端)      |  |                  |
    +---------+--------+  +-------+--------+  +--------+---------+
              |                    |                    |
              +--------------------+--------------------+
                                   |
                          RESTful API (JSON)
                          Bearer Token / Cookie
                                   |
                        +----------v----------+
                        |   FastAPI (ASGI)    |
                        |   Uvicorn Server    |
                        +----------+----------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
    +---------v--------+  +-------v--------+  +--------v---------+
    |  Router Layer    |  |  Service Layer |  |  Core Layer       |
    |  (10 API 模块)   |  |  (业务逻辑)    |  |  (Auth/DB/Config) |
    +---------+--------+  +-------+--------+  +--------+---------+
              |                    |                    |
              +--------------------+--------------------+
                                   |
                        +----------v----------+
                        |  SQLModel ORM       |
                        +----------+----------+
                                   |
                                   |
                        +----------v----------+
                        |     MySQL 8.0       |
                        |  (开发/生产环境)     |
                        +---------------------+
```

---

## 4. 后端 API 架构

### 4.1 应用启动流程

入口文件 `backend/app/main.py` 按以下顺序初始化：

1. 创建 FastAPI 实例（配置标题、版本、描述）
2. 注册 CORS 中间件（允许前端开发服务器跨域）
3. 注册请求日志中间件（记录每个请求的方法、路径、响应码）
4. 注册异常处理器（`AtlasException` 与通用异常）
5. 注册 10 个路由模块（统一前缀 `/api/v1`）
6. 启动事件中按需初始化数据库

### 4.2 路由模块一览

```
/api/v1/
  +-- auth/           认证登录          (auth.py)
  +-- iam/            组织与权限        (iam.py,       ~700+ 行)
  +-- todo/           任务与请假        (todo.py,      ~1000+ 行)
  +-- contract/       合同管理          (contract.py)
  +-- project/        项目管理          (project.py,   ~2000+ 行)
  +-- finance/        财务管理          (finance.py)
  +-- ai/             AI 能力          (ai.py)
  +-- kb/             企业大脑        (kb.py,        ~460 行)
  +-- meeting/        会议记录        (meeting.py,   ~490 行)
  +-- changelog/      版本更新日志    (changelog.py)
```

### 4.3 中间件栈

| 顺序 | 中间件 | 职责 |
|------|--------|------|
| 1 | CORS | 处理跨域，允许 `localhost:15173`/`15030` 及部署域名 |
| 2 | 请求日志 | 记录请求方法、路径，响应状态码，捕获异常堆栈 |

### 4.4 异常处理体系

```
AtlasException (基类, code=400)
  +-- NotFoundException      (code=404)
  +-- UnauthorizedException  (code=401)
  +-- ForbiddenException     (code=403)
  +-- ValidationException    (code=400, 附带 errors 列表)
```

### 4.5 统一响应格式

```json
// 成功
{ "data": "<any>", "message": "ok" }

// 失败
{ "code": 400, "message": "错误描述", "errors": ["可选的详细错误"] }
```

工具函数 `success_response()` 和 `error_response()` 确保全局一致。

### 4.6 配置管理

通过 `pydantic-settings` 读取 `.env` 文件，关键配置项：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DB_TYPE` | `sqlite` | 数据库类型切换 |
| `SECRET_KEY` | (需修改) | JWT 签名密钥 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token 有效期 24 小时 |
| `ENFORCE_RBAC` | `True` | RBAC 权限开关（已正式启用） |
| `AUTO_CREATE_TABLES_ON_STARTUP` | `False` | 启动时是否自动建表 |
| `AUTO_RUN_MIGRATIONS_ON_STARTUP` | `False` | 启动时是否自动迁移 |
| `UPLOAD_DIR` | `./data/files` | 文件上传存储路径 |
| `MAX_UPLOAD_SIZE` | `10MB` | 单文件上传大小限制 |
| `GEMINI_API_KEY` | (可选) | AI 功能所需的 API 密钥 |
| `CHROMADB_PATH` | `./data/chromadb` | ChromaDB 向量数据库存储路径 |
| `GEMINI_EMBEDDING_MODEL` | `text-embedding-004` | Gemini Embedding 模型 |
| `KB_CHUNK_SIZE` | `1000` | 知识库文档切片大小（字符） |
| `KB_CHUNK_OVERLAP` | `200` | 切片重叠长度 |
| `KB_RAG_TOP_K` | `5` | RAG 检索返回的 top-k 数量 |
| `LITELLM_BASE_URL` | （见 `.env`） | LiteLLM 代理地址（会议纪要/AI 对话） |
| `LITELLM_API_KEY` | (已配置) | LiteLLM API 密钥 |
| `LITELLM_MODEL` | `gemini/gemini-3.1-flash-lite-preview` | LiteLLM 使用的模型 |
| `VOLC_ASR_APP_KEY` | (已配置) | 豆包 ASR 应用 Key |
| `VOLC_ASR_ACCESS_KEY` | (已配置) | 豆包 ASR 访问 Key |

### 4.7 服务层模式

- **Router 层**：请求校验、权限检查、调用服务/数据层、组装响应
- **Service 层**：复杂业务逻辑（Word 文档生成、文档解析、Embedding、向量存储、RAG 对话、ASR 转写）
- **数据富化函数**：各 Router 内的 `_enrich_*()` 辅助函数，负责关联查询（如将 `pm_user_id` 解析为显示名称）
- **依赖注入**：通过 FastAPI 的 `Depends()` 注入数据库会话和当前用户

---

## 5. 数据库设计

### 5.1 基础模型

所有业务表继承自 `BaseDBModel`，自动获得：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键，自动生成 |
| `created_at` | datetime | 创建时间（UTC） |
| `updated_at` | datetime | 更新时间（UTC） |

### 5.2 模块与数据模型总览

```
IAM 模块
  +-- User                 用户（含个人档案、请假额度、Beli 积分、首次登录状态）
  +-- OrgUnit              部门（树形自引用）
  +-- JobTitle             职位
  +-- JobTitlePermission   职位-权限关联
  +-- OurEntity            我方实体（公司/分支/工作室）
  +-- Role                 角色
  +-- Permission           权限
  +-- RolePermission       角色-权限关联
  +-- UserRole             用户-角色关联（含作用域）
  +-- OrgMembership        组织成员关系
  +-- BeliRule             积分规则

Todo 模块
  +-- TodoItem             任务条目
  +-- LeaveRequest         请假申请
  +-- NotificationLog      通知记录

Project 模块
  +-- Project              项目
  +-- ProjectStage         项目阶段
  +-- ProjectMember        项目成员

Contract 模块
  +-- Contract             合同（三方）
  +-- Counterparty         对手方
  +-- ContractPaymentPlan  付款计划

Finance 模块
  +-- FinanceAccount       财务账户
  +-- FinanceTransaction   交易记录
  +-- FinanceInvoice       发票
  +-- InvoiceRequest       开票申请
  +-- Reimbursement        报销单

Approval 模块
  +-- ApprovalFlow         审批流程模板
  +-- ApprovalInstance     审批实例
  +-- ApprovalStep         审批步骤

Shared 模块
  +-- AuditLog             操作审计日志
  +-- FileMetadata         文件元数据
  +-- ChangeLog            版本更新日志（version, title, content, published_by, published_at）
  +-- WeChatUserBinding    微信用户绑定
  +-- WeChatMessageTemplate 微信消息模板

KB 模块（企业大脑）
  +-- KBDocument           知识库文档（标题、文件、标签、AI摘要、状态）
  +-- KBDocumentChunk      文档切片（文本、token数、ChromaDB ID）
  +-- KBConversation       RAG 对话会话
  +-- KBMessage            对话消息（用户/助手、引用信息）

Meeting 模块（会议记录）
  +-- MeetingRecord        会议主表（音频、ASR/导入状态、说话人映射、AI纪要、会议日期、参会人员；attendees 由转写分段 speaker 自动同步）
  +-- MeetingTranscriptSegment  转写分段（说话人、时间、文本；可来自 ASR 或 Word/PDF 文稿导入，可通过完整列表保存进行新增/插入/删除/重排）
```

### 5.3 核心模型字段详情

#### User（用户）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `display_name` | str | 必填 | 显示名称 |
| `email` | str | 唯一，可选 | 邮箱 |
| `phone` | str | 可选 | 手机号 |
| `username` | str | 唯一，可选 | 登录用户名 |
| `hashed_password` | str | 可选 | bcrypt 哈希密码 |
| `status` | UserStatus | 默认 ACTIVE | 账号状态 |
| `is_shareholder` | bool | 默认 False | 是否股东 |
| `manager_user_id` | FK -> User | 可选 | 直属上级（自引用） |
| `job_title_id` | FK -> JobTitle | 可选 | 职位 |
| `department_id` | FK -> OrgUnit | 可选 | 所属部门 |
| `leave_*_remaining` | float | 各类假期余额 | 年假5/产假15/婚假3/事假3/病假3 |
| `beili_balance` | float | 默认 0 | Beli 积分余额 |

#### TodoItem（任务）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `our_entity_id` | FK -> OurEntity | 必填 | 所属主体 |
| `title` | str | 必填 | 任务标题 |
| `description` | str | 可选 | 详细描述 |
| `assignee_user_id` | FK -> User | 必填，索引 | 执行人/负责人 |
| `creator_user_id` | FK -> User | 必填 | 创建者 |
| `source_type` | TodoSourceType | 必填，索引 | 来源类型（project_task/approval_step/custom 等） |
| `source_id` | str | 必填，索引 | 来源对象 ID |
| `action_type` | TodoActionType | 必填 | 操作类型（do/approve/review/ack） |
| `priority` | TodoPriority | 默认 P2 | 优先级（P0-P3） |
| `status` | TodoStatus | 默认 OPEN，索引 | 状态 |
| `due_at` | datetime | 可选 | 截止时间 |
| `start_at` | datetime | 可选 | 开始时间 |
| `done_at` | datetime | 可选 | 完成时间 |
| `done_by_user_id` | FK -> User | 可选 | 完成操作人 |
| `reviewed_by_user_id` | FK -> User | 可选 | 审核员 |
| `review_comment` | str | 可选 | 审核评语 |
| `tags` | JSON | 默认 [] | 标签列表 |
| `link` | JSON | 可选 | 关联对象链接（project_id、leave_id 等） |
| `blocked_reason` | str | 可选 | 阻塞原因 |
| `dismiss_reason` | str | 可选 | 忽略原因 |

**状态流转**：`OPEN -> IN_PROGRESS -> PENDING_REVIEW -> DONE`（也支持 BLOCKED / DISMISSED / AI_FIXING / AI_FIXED 分支）

**团队任务规则**：显示 `(creator==me AND assignee!=me) OR (reviewed_by==me)` 的任务，排除自指派。

**请假审批待办**：请假提交后自动创建 TodoItem（creator=assignee=申请人，reviewed_by=上级，source_type=approval_step）。审批/驳回时同步更新 TodoItem 状态为 done/dismissed。

#### Project（项目）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `our_entity_id` | FK -> OurEntity | 可选（nullable），索引 | 所属主体（B2C 可为空） |
| `project_no` | str | 唯一，索引 | 项目编号（自动生成 PR-YYYYMMDD-NNN） |
| `name` | str | 必填 | 项目名称 |
| `project_type` | ProjectType | 必填 | B2B / B2C |
| `status` | ProjectStatus | 默认 DRAFT，索引 | 项目状态 |
| `owner_user_id` | FK -> User | 必填 | 项目负责人 |
| `pm_user_id` | FK -> User | 必填 | 项目经理 |
| `customer_id` | FK -> Counterparty | 可选 | 客户 |
| `contract_id` | FK -> Contract | 可选 | 关联合同 |
| `start_at` | date | 可选 | 项目开始日期 |
| `due_at` | date | 可选 | 项目截止日期 |
| `current_stage_code` | str | 必填 | 当前阶段代码 |
| `progress` | float | 0.0 ~ 1.0 | 进度百分比 |
| `description` | str | 可选 | 项目描述 |
| `attachments` | JSON | 默认 [] | 项目附件 |

**阶段 feature_list**：`ProjectStage.feature_list` 类型为 LONGTEXT，存储功能清单/报价单/原型确认单等 JSON 数据。

#### Contract（合同）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `contract_no` | str | 唯一，索引 | 合同编号 |
| `name` | str | 必填 | 合同名称 |
| `contract_type` | ContractType | 必填 | 销售/采购/三方 |
| `party_a_id` | FK -> Counterparty | 必填，索引 | 甲方 |
| `party_b_id` | FK -> Counterparty | 必填，索引 | 乙方 |
| `party_c_id` | FK -> Counterparty | 可选，索引 | 丙方 |
| `amount_total` | Decimal(18,2) | 必填 | 合同总金额 |
| `pending_amount` | Decimal(18,2) | 必填 | 待收/付金额 |
| `content_doc` | str | 可选 | Markdown 合同内容 |
| `attachments` | JSON | 默认 [] | 合同附件元数据（PDF/图片，文件存储在 `contract-attachments`） |

#### FinanceTransaction（交易记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `account_id` | FK -> FinanceAccount | 必填，索引 | 所属账户 |
| `txn_type` | TransactionType | 默认 PAYMENT，索引 | 收款/付款/报销 |
| `txn_direction` | TransactionDirection | 必填 | 收入(IN)/支出(OUT) |
| `amount` | Decimal(18,2) | 必填 | 金额 |
| `txn_date` | date | 必填，索引 | 交易日期 |
| `reconcile_status` | ReconcileStatus | 默认 UNRECONCILED | 对账状态 |
| `attachments` | JSON | 默认 [] | 交易凭证 |

#### FinanceAccount（财务账户）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `entity_id` | FK -> Counterparty | 必填，索引 | 账户所属实体 |
| `account_category` | AccountCategory | 必填 | 账户类别 |
| `account_name` | str | 必填 | 账户名称 |
| `bank_name` | str | 可选 | 开户银行 |
| `bank_branch` | str | 可选 | 开户支行 |
| `account_no_encrypted` | str | 可选 | 银行账号（加密存储） |
| `account_no_masked` | str | 可选 | 银行账号（脱敏显示） |
| `currency` | str | 默认 CNY | 币种 |
| `initial_balance` | Decimal | 默认 0 | 初始余额 |
| `status` | AccountStatus | 必填 | 账户状态 |
| `is_default` | bool | 默认 False | 是否默认账户 |

#### ProjectStage（项目阶段）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `project_id` | FK -> Project | 必填，索引 | 所属项目 |
| `stage_code` | str | 必填 | 阶段代码 |
| `stage_name` | str | 必填 | 阶段名称 |
| `sequence_no` | int | 必填 | 排序序号 |
| `status` | StageStatus | 默认 NOT_STARTED | 阶段状态 |
| `planned_start_at` / `planned_end_at` | date | 可选 | 计划起止日期 |
| `actual_start_at` / `actual_end_at` | date | 可选 | 实际起止日期 |
| `deliverables` | str | 可选 | 备注/交付物 |
| `feature_list` | LONGTEXT | 可选 | 功能清单/报价单/原型确认单 JSON |
| `attachments` | JSON | 默认 [] | 阶段附件 |

#### LeaveRequest（请假申请）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `our_entity_id` | FK -> OurEntity | 可选 | 所属主体 |
| `applicant_user_id` | FK -> User | 必填，索引 | 申请人 |
| `leave_type` | LeaveType | 必填，索引 | 请假类型（年假/产假/婚假/事假/病假） |
| `status` | LeaveStatus | 默认 PENDING，索引 | 审批状态 |
| `start_at` | datetime | 必填 | 请假开始时间 |
| `end_at` | datetime | 必填 | 请假结束时间 |
| `reason` | str | 可选 | 请假原因 |
| `approved_by_user_id` | FK -> User | 可选 | 审批人 |
| `approved_at` | datetime | 可选 | 审批时间 |
| `review_comment` | str | 可选 | 审批评语 |

#### Counterparty（交易方）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `name` | str | 必填 | 交易方名称 |
| `type` | str | 必填 | 类型（individual/organization） |
| `identifier` | str | 可选 | 税号/统一社会信用代码 |
| `address` | str | 可选 | 地址 |
| `phone` | str | 可选 | 联系电话 |
| `bank_name` | str | 可选 | 开户银行 |
| `bank_account` | str | 可选 | 银行账号 |

### 5.4 枚举类型汇总

| 模块 | 枚举 | 可选值 |
|------|------|--------|
| IAM | UserStatus | `ACTIVE`, `INACTIVE` |
| IAM | OurEntityType | `COMPANY`, `BRANCH`, `STUDIO`, `OTHER` |
| IAM | ScopeType | `GLOBAL`, `OUR_ENTITY`, `ALL_ENTITIES` |
| IAM | BeliRuleType | `TASK_TIMELINESS` |
| Todo | TodoStatus | `OPEN`, `IN_PROGRESS`, `BLOCKED`, `PENDING_REVIEW`, `DONE`, `DISMISSED`, `AI_FIXING`, `AI_FIXED` |
| Todo | TodoPriority | `P0`, `P1`, `P2`, `P3` |
| Todo | TodoSourceType | `PROJECT_TASK`, `APPROVAL_STEP`, `CONTRACT_REMINDER`, `FINANCE_ACTION`, `CUSTOM` |
| Todo | TodoActionType | `DO`, `APPROVE`, `REVIEW`, `ACK` |
| Todo | LeaveType | `ANNUAL`(年假), `MATERNITY`(产假), `MARRIAGE`(婚假), `PERSONAL`(事假), `SICK`(病假) |
| Todo | LeaveStatus | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| Finance | AccountCategory | 账户类别枚举 |
| Finance | AccountStatus | 账户状态枚举 |
| Project | ProjectType | `B2B`, `B2C` |
| Project | ProjectStatus | `DRAFT`, `ACTIVE`, `PAUSED`, `CLOSED`, `CANCELLED` |
| Project | StageStatus | `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `SKIPPED` |
| Contract | ContractType | `SALES`, `PURCHASE`, `THIRD_PARTY` |
| Contract | ContractStatus | `DRAFT`, `IN_APPROVAL`, `APPROVED`, `SIGNED`, `IN_DELIVERY`, `ACCEPTED`, `ARCHIVED`, `CANCELLED` |
| Finance | TransactionType | `RECEIPT`, `PAYMENT`, `REIMBURSEMENT` |
| Finance | TransactionDirection | `IN`, `OUT` |
| Finance | ReconcileStatus | `UNRECONCILED`, `COMPLETED`, `RECONCILED` |
| Finance | InvoiceKind | `OUTPUT`(销项), `INPUT`(进项) |
| Approval | ApprovalStatus | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| KB | KBDocumentStatus | `PROCESSING`, `READY`, `FAILED` |
| Meeting | MeetingType | `MORNING`, `WEEKLY`, `PROJECT`, `REVIEW`, `BRAINSTORM`, `OTHER` |
| Meeting | MeetingStatus | `UPLOADING`, `TRANSCRIBING`, `TRANSCRIBED`, `SUMMARIZED`, `ARCHIVED`, `FAILED` |

### 5.5 关键关联关系

```
User ---< UserRole >--- Role ---< RolePermission >--- Permission
  |
  +-- manager_user_id ---> User (自引用：上下级)
  +-- job_title_id ------> JobTitle
  +-- department_id -----> OrgUnit ---> OrgUnit (自引用：部门树)
  |
  +---< TodoItem (assignee / creator)
  +---< LeaveRequest (applicant / approver)
  +---< ProjectMember >--- Project
  |                          |
  |                          +---< ProjectStage
  |                          +-- contract_id ---> Contract
  |                          +-- customer_id ---> Counterparty
  |
  +---< FinanceTransaction
  +---< Reimbursement

Contract
  +-- party_a_id ---> Counterparty (甲方)
  +-- party_b_id ---> Counterparty (乙方)
  +-- party_c_id ---> Counterparty (丙方，可选)
  +---< ContractPaymentPlan

FinanceAccount
  +-- entity_id ---> Counterparty
  +---< FinanceTransaction

ApprovalInstance
  +-- object_id ---> (Contract / InvoiceRequest / Reimbursement)
  +---< ApprovalStep
```

### 5.6 字段类型约定

| 类型 | 使用场景 |
|------|---------|
| UUID | 所有主键和大部分外键 |
| Decimal(18,2) | 所有金额字段（合同、交易、发票、报销） |
| JSON | 可变结构数据（附件列表、标签、审批步骤配置、费用明细） |
| Enum | 所有状态和类型分类字段 |
| float | 余额类字段（假期余额、Beli 积分） |
| datetime/date | 时间戳和业务日期 |

### 5.7 数据库迁移

- 工具：Alembic
- 目录：`backend/db_migrations/`
- 策略：非破坏性迁移序列（扩展 -> 数据迁移 -> 收缩）
- 运行：`alembic upgrade head`

---

## 6. 前端架构

### 6.1 技术栈

- **框架**：React 19.2.0 + React Router 7.12.0
- **构建**：Vite 7.x（路径别名 `@` -> `./src`，默认 `base=/`；开发子路径 `/punkrecord/` 由 `dev.sh` 设置 `VITE_BASE=/punkrecord/`，`App.jsx` 也会按当前路径自动兼容 basename；开发代理 `/punkrecord/api` -> `localhost:15085`）
- **状态管理**：React Context API（AuthContext 管理登录态）
- **HTTP 客户端**：Axios 1.13.2（拦截器统一注入 Token、处理 401）
- **样式**：Tailwind CSS 原子化类名 + 页面级作用域
- **图标**：Lucide React（Tree-shakable）

### 6.2 路由结构

```
/login                          登录页
/                               受保护布局
  +-- /                         仪表盘
  +-- /todo                     任务管理
  +-- /iam
  |     +-- /users              用户管理
  |     +-- /entities           实体管理
  |     +-- /departments        部门管理
  |     +-- /job-titles         职位管理
  |     +-- /beli-rules         积分规则
  |     +-- /org-chart          组织架构图
  +-- /contract
  |     +-- /list               合同列表
  |     +-- /counterparties     对手方管理
  +-- /project                  项目列表
  |     +-- /:id                项目详情
  |     +-- /:id/dev-progress   开发进度
  +-- /finance
  |     +-- /accounts           账户管理
  |     +-- /transactions       交易记录
  +-- /kb                       企业大脑 - 文档列表
  |     +-- /chat               AI 对话（新对话）
  |     +-- /chat/:id           AI 对话（历史对话）
  |     +-- /documents/:id      文档详情
  +-- /meeting                  会议列表
        +-- /:id                会议详情/编辑
```

### 6.3 状态管理

采用 React Context 而非 Redux/Zustand，原因：

- 全局状态简单（仅认证信息），无需引入额外依赖
- 各业务页面状态独立，通过 `useState` / `useEffect` 本地管理
- 减少学习成本和包体积

---

## 7. 微信小程序架构

### 7.1 页面结构

```
pages/
  +-- login/        登录
  +-- home/         首页
  +-- todo/         任务（含请假）
  +-- project/      项目列表
  |     +-- detail/ 项目详情
  +-- finance/      财务概览
  +-- mine/         个人中心
  +-- contract/     合同
  +-- iam/          组织
```

### 7.2 设计原则

- 与 Web 端保持统一的视觉语言（亮色主题，白底深字，蓝色主色调）
- 用户可见标签使用中文，后端枚举值在 JS 逻辑层映射
- 响应式布局采用 `rpx` 单位
- 自定义 TabBar 支持大字号标签，提升可读性

### 7.3 网络层

- `utils/request.js`：Promise 封装 `wx.request()`
- 统一 Bearer Token 鉴权
- 401 自动清除会话并跳转登录
- 错误提示中文化（"登录已过期"、"网络异常"等）

---

## 8. 认证与权限体系

### 8.1 认证流程

```
客户端                          服务端
  |                               |
  |-- POST /auth/login ---------->|
  |   (username + password)       |
  |                               |-- bcrypt 验证密码
  |                               |-- 生成 JWT (HS256, 24h)
  |<--------- Token + Cookie -----|
  |                               |
  |-- GET /auth/me -------------->|
  |   (Bearer Token / Cookie)     |
  |                               |-- 解码 JWT
  |                               |-- 查询用户状态
  |<-- 用户信息 + permissions ----|
```

**双通道 Token 投递**：
- Web 端：`Authorization: Bearer <token>` 头部
- Cookie 备选：`HttpOnly + Secure + SameSite=Lax`

**首次登录流程**：
- 新员工账号默认 `profile_completed=false`, `must_change_password=true`
- 登录后前端检测到上述标记，重定向到 `/profile-setup` 页面
- 用户填写个人档案（生日、身份证号、家庭住址、毕业学校、学历）并上传身份证图片和简历 PDF
- 设置新密码后标记完成，进入系统正常页面
- 管理员可通过 `POST /api/v1/iam/users/{id}/reset-password` 重置密码，触发下次登录强制修改

### 8.2 RBAC 权限模型

```
通道 1（角色权限）：
User --< UserRole >-- Role --< RolePermission >-- Permission
              |
              +-- scope_type: GLOBAL / OUR_ENTITY / ALL_ENTITIES
              +-- our_entity_id: (仅 OUR_ENTITY 作用域时有效)

通道 2（职位权限）：
User -- job_title_id --> JobTitle --< JobTitlePermission >-- Permission
```

**双通道权限合并**：鉴权时取两个通道的**并集**，即用户只要通过角色或职位中任一通道拥有某权限即可访问对应资源。实现位于 `backend/app/core/auth.py` 的 `require_permission()` 中。

**默认角色**：`admin`, `finance`, `cashier`, `shareholder`, `pm`, `owner`, `employee`, `approver`, `legal`, `seal_admin`

**权限粒度**：`<模块>.<操作>`，共 14 个权限码：

| 权限码 | 说明 |
|--------|------|
| `iam.read` / `iam.write` | 用户管理 |
| `todo.read` / `todo.write` | 待办事项 |
| `contract.read` / `contract.write` | 合同管理 |
| `project.read` / `project.write` | 项目管理 |
| `finance.read` / `finance.write` | 财务管理 |
| `kb.read` / `kb.write` | 企业大脑 |
| `meeting.read` / `meeting.write` | 会议记录 |

**职位权限管理 API**：
- `GET /api/v1/iam/permissions` — 获取所有权限列表（按模块分组）
- `GET /api/v1/iam/job-titles/{id}/permissions` — 获取职位已分配的权限代码
- `PUT /api/v1/iam/job-titles/{id}/permissions` — 设置职位权限（全量替换）

**前后端双层权限控制**（`ENFORCE_RBAC=True`）：
- **后端**：`require_permission()` 依赖在 API 端点校验权限，无权限返回 403
- **前端**：`/auth/me` 返回用户 `permissions` 数组，`AuthContext` 提供 `hasPermission()` / `hasAnyPermission()` 方法
  - `Sidebar` 根据权限过滤菜单项（无权限的模块不显示）
  - `PermissionRoute` 路由守卫拦截直接 URL 访问，显示 403 页面
- **权限查询**：`get_user_permissions()` 合并角色权限 + 职位权限取并集，admin 角色自动获得全部权限

---

## 9. AI 能力集成

| 能力 | 端点 | 实现 |
|------|------|------|
| 功能清单生成 | `POST /api/v1/ai/chat` | 调用 Gemini API，解析返回 JSON 为 10 列功能表 |
| 合同智能起草 | `POST /api/v1/ai/chat-stream` | SSE 流式响应，注入项目上下文（甲乙方、金额、税号） |
| 开发任务拆解 | 项目模块内 | 从功能清单自动生成任务，支持批量分配 |
| RAG 企业知识对话 | `POST /api/v1/kb/chat` | Embedding检索→ChromaDB→上下文拼接→Gemini流式回答 |
| 文档智能摘要/标签 | 上传文档后台自动触发 | Gemini 自动生成摘要和分类标签 |
| 会议纪要生成 | `POST /api/v1/meeting/records/{id}/summarize` | SSE 流式生成结构化会议纪要 |
| 会议重新转写 | `POST /api/v1/meeting/records/{id}/retranscribe` | 对已有音频重新触发豆包 ASR，成功后替换旧分段 |
| 会议文稿导入 | `POST /api/v1/meeting/records/{id}/upload-transcript` | 解析 Word `.docx` / PDF 中的说话人文稿，生成会议转写分段 |
| 会议转写编辑 | `PATCH /api/v1/meeting/records/{id}/transcript` | `replace=true` 时按完整分段列表保存，支持新增讲话人、插入/删除分段和自动同步参会人员 |
| 图片文字提取 | 知识库上传图片时 | Gemini Vision 提取图片中的文字内容 |

**AI 技术栈**：LiteLLM 代理（统一调用 Gemini 等模型） + Gemini Embedding text-embedding-004（向量化） + ChromaDB（向量存储检索） + 豆包 ASR（语音转文字）

通过 LiteLLM 代理统一调用 AI 模型，支持 OpenAI 兼容接口。会议纪要、AI 对话等功能均通过 LiteLLM 路由。前端使用 `react-markdown` 渲染 Markdown。

---

## 10. 文档维护约定

本文档（`project-overview.md`）是项目的技术全景说明，必须与项目实际状态保持同步。

### 更新触发条件

| 变更类型 | 需更新的章节 |
|---------|-------------|
| 新增/移除技术依赖 | 第 2 章（技术选型） |
| 后端架构变更（中间件、路由、异常处理） | 第 4 章（后端 API 架构） |
| 数据模型变更（新增/修改模型、字段、枚举） | 第 5 章（数据库设计） |
| 前端架构变更（路由、状态管理、构建工具） | 第 6 章（前端架构） |
| 小程序页面或架构变更 | 第 7 章（微信小程序架构） |
| 认证/权限逻辑变更 | 第 8 章（认证与权限体系） |
| AI 能力新增或调整 | 第 9 章（AI 能力集成） |

### 编码规范

- **编码**：UTF-8（无 BOM）
- **换行符**：LF（`\n`）
- **语言**：中文（技术术语和代码标识符保持英文原文）

> 以上编码规范确保文档在 macOS、Windows、Linux 三个平台上均可正确显示，不会出现乱码。

---

*最后更新：2026-08-17*
