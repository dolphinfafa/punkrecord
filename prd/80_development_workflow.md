# 企业管理系统（Atlas）开发流程 Todo List

> 面向：研发团队  
> 版本：V1.0（2026-01-20）  
> 目标：提供完整的开发流程清单，从环境搭建到部署上线

---

## 阶段 0: 环境准备与初始化

### 0.1 开发环境搭建
- [ ] 安装Python 3.11+（创建虚拟环境 punkrecord）
- [ ] 安装Node.js 18+ 和 pnpm
- [ ] 安装微信开发者工具
- [ ] 配置Git仓库（.gitignore设置）
- [ ] 安装IDE/编辑器插件（Python/JavaScript/Vue）

### 0.2 项目结构初始化
- [ ] 创建项目根目录结构
  ```
  punkrecord/
  ├── backend/          # FastAPI后端
  ├── frontend/         # React前端
  ├── miniprogram/      # 微信小程序
  ├── prd/              # 需求文档（已存在）
  ├── docs/             # 开发文档
  └── scripts/          # 工具脚本
  ```
- [ ] 初始化后端项目（FastAPI + SQLModel）
- [ ] 初始化前端项目（Vite + React）
- [ ] 初始化小程序项目（微信小程序模板）

### 0.3 依赖安装
- [ ] 后端依赖（requirements.txt）:
  - fastapi, uvicorn, sqlmodel, pydantic
  - python-jose, passlib, bcrypt
  - python-multipart（文件上传）
- [ ] 前端依赖（package.json）:
  - react, react-router-dom, zustand
  - axios, antd/mui
  - vite

---

## 阶段 1: 数据库设计与基础架构（M1前置）

### 1.1 数据库Schema设计
- [ ] 设计通用Base Model（UUID, created_at, updated_at）
- [ ] 设计IAM模块表结构
  - [ ] user, role, permission, user_role, role_permission
  - [ ] our_entity, org_unit, org_membership
- [ ] 设计Approval引擎表结构
  - [ ] approval_flow, approval_instance, approval_step
- [ ] 设计Todo模块表结构
  - [ ] todo_item, notification_log
- [ ] 设计Contract模块表结构
  - [ ] contract, counterparty, contract_payment_plan
- [ ] 设计Project模块表结构
  - [ ] project, project_stage, project_member
- [ ] 设计Finance模块表结构
  - [ ] finance_account, finance_transaction, finance_invoice
  - [ ] invoice_request, reimbursement
- [ ] 设计Mini Program表结构
  - [ ] wechat_user_binding, wechat_message_template
- [ ] 设计共享表结构
  - [ ] audit_log, file_metadata

### 1.2 数据库初始化脚本
- [ ] 创建SQLite数据库文件（atlas.db）
- [ ] 编写Alembic迁移脚本（或直接使用SQLModel.create_all()）
- [ ] 编写种子数据脚本（seed data）
  - [ ] 默认管理员用户
  - [ ] 默认角色与权限
  - [ ] 默认我方主体（our_entity）
  - [ ] 默认审批流程配置

### 1.3 基础架构代码
- [ ] 配置文件管理（config.py：数据库URL、JWT密钥等）
- [ ] 数据库连接管理（database.py）
- [ ] 统一响应格式定义（response_models.py）
- [ ] 异常处理中间件（exception_handlers.py）
- [ ] CORS配置
- [ ] 日志配置（logging）

---

## 阶段 2: M1 - IAM模块与共享服务

### 2.1 IAM核心功能（后端）
- [ ] User CRUD API
  - [ ] POST /api/v1/iam/users（创建用户）
  - [ ] GET /api/v1/iam/users（用户列表，分页）
  - [ ] GET /api/v1/iam/users/{user_id}（用户详情）
  - [ ] PATCH /api/v1/iam/users/{user_id}（更新用户）
  - [ ] DELETE /api/v1/iam/users/{user_id}（停用用户）
- [ ] Role & Permission API
  - [ ] GET /api/v1/iam/roles（角色列表）
  - [ ] POST /api/v1/iam/roles（创建角色）
  - [ ] POST /api/v1/iam/roles/{role_id}/permissions（绑定权限）
- [ ] User-Role Binding API
  - [ ] POST /api/v1/iam/user-roles（用户角色绑定）
  - [ ] GET /api/v1/iam/users/{user_id}/roles（查询用户角色）
- [ ] Our Entity API
  - [ ] CRUD接口实现
  - [ ] 主体默认人员配置

### 2.2 认证与鉴权（后端）
- [ ] JWT Token生成与验证（auth.py）
  - [ ] create_access_token()
  - [ ] verify_token()
- [ ] 登录API
  - [ ] POST /api/v1/auth/login（用户名密码登录）
  - [ ] POST /api/v1/auth/refresh（刷新Token）
- [ ] 权限验证装饰器/依赖注入
  - [ ] get_current_user()
  - [ ] require_permission(permission_code)

### 2.3 Approval引擎（后端）
- [ ] Approval Flow配置API
  - [ ] CRUD接口实现
  - [ ] 流程配置解析逻辑
- [ ] Approval Instance API
  - [ ] POST /api/v1/approval/instances（创建审批实例）
  - [ ] GET /api/v1/approval/instances/{approval_id}（查询审批）
  - [ ] POST /api/v1/approval/steps/{step_id}/approve（审批通过）
  - [ ] POST /api/v1/approval/steps/{step_id}/reject（审批驳回）
- [ ] 审批与Todo联动逻辑
  - [ ] 创建审批步骤时生成Todo
  - [ ] 审批完成时关闭Todo

### 2.4 共享服务（后端）
- [ ] File Service
  - [ ] POST /api/v1/files/upload（文件上传）
  - [ ] GET /api/v1/files/{file_id}（文件下载）
  - [ ] 文件元数据记录（file_metadata表）
- [ ] Audit Log Service
  - [ ] 审计日志记录函数（log_audit()）
  - [ ] GET /api/v1/audit-logs（审计日志查询）

### 2.5 IAM前端页面（Web）
- [ ] 用户管理页面
  - [ ] 用户列表（表格、筛选、分页）
  - [ ] 用户新增/编辑弹窗
  - [ ] 用户停用操作
- [ ] 角色权限管理页面
  - [ ] 角色列表
  - [ ] 角色权限配置（树形选择器）
- [ ] 主体管理页面
  - [ ] 主体列表与编辑
- [ ] 审批流程配置页面（Admin）

---

## 阶段 3: M2 - Todo引擎与工作台

### 3.1 Todo后端API
- [ ] Todo CRUD API
  - [ ] POST /api/v1/todo（创建待办）
  - [ ] GET /api/v1/todo/my（我的待办列表，支持筛选）
  - [ ] GET /api/v1/todo/{todo_id}（待办详情）
  - [ ] PATCH /api/v1/todo/{todo_id}（更新待办）
  - [ ] POST /api/v1/todo/{todo_id}/done（完成待办）
  - [ ] POST /api/v1/todo/{todo_id}/block（阻塞待办）
  - [ ] POST /api/v1/todo/{todo_id}/dismiss（关闭待办）

### 3.2 Todo Service逻辑
- [ ] 创建待办时写审计日志
- [ ] 状态流转规则验证
- [ ] 审批类待办（action_type=approve）不允许直接完成

### 3.3 Todo前端页面（Web）
- [ ] 工作台/待办列表页
  - [ ] 待办列表（表格或卡片视图）
  - [ ] 筛选器（状态/截止/来源/优先级）
  - [ ] 快捷操作（完成/阻塞/跳转）
- [ ] 待办详情页
  - [ ] 基本信息展示
  - [ ] 关联对象跳转链接
  - [ ] 操作按钮（完成/阻塞/驳回等）

---

## 阶段 4: M3 - 合同模块

### 4.1 合同后端API
- [ ] Counterparty API
  - [ ] CRUD接口实现
- [ ] Contract CRUD API
  - [ ] POST /api/v1/contract/contracts（创建合同）
  - [ ] GET /api/v1/contract/contracts（合同列表，支持筛选）
  - [ ] GET /api/v1/contract/contracts/{contract_id}（合同详情）
  - [ ] PATCH /api/v1/contract/contracts/{contract_id}（更新合同）
  - [ ] DELETE /api/v1/contract/contracts/{contract_id}（取消合同）
- [ ] Payment Plan API
  - [ ] POST /api/v1/contract/contracts/{contract_id}/payment-plans（添加分期）
  - [ ] PATCH /api/v1/contract/payment-plans/{plan_id}（更新分期）

### 4.2 合同审批流程
- [ ] POST /api/v1/contract/contracts/{contract_id}/submit（提交审批）
  - [ ] 创建approval_instance
  - [ ] 生成approval_steps
  - [ ] 为每个步骤创建Todo
- [ ] 审批通过后更新合同状态（approved）

### 4.3 合同尾款提醒
- [ ] 编写定时任务（Celery或后台线程）
  - [ ] 检查尾款到期前30天的分期
  - [ ] 创建contract_reminder类型Todo
  - [ ] 避免重复生成（通过source_id唯一约束）

### 4.4 合同AI功能（Mock/占位）
- [ ] AI生成合同接口（POST /api/v1/contract/ai/generate）
  - [ ] 返回Mock数据（V1.1实现真实AI调用）
- [ ] AI审核合同接口（POST /api/v1/contract/ai/review）
  - [ ] 返回Mock审核报告

### 4.5 合同前端页面（Web）
- [ ] 合同列表页
  - [ ] 合同列表（表格）
  - [ ] 筛选器（类型/状态/主体/经办人）
  - [ ] 资金进度展示（进度条）
- [ ] 合同详情页
  - [ ] 基本信息展示
  - [ ] 分期列表（表格，展示已付金额）
  - [ ] 附件列表与预览
  - [ ] 审批记录
  - [ ] 关联项目/流水/发票
- [ ] 合同创建/编辑页
  - [ ] 表单（基本信息/对方主体/分期）
  - [ ] AI生成入口按钮（Mock）
  - [ ] 附件上传
- [ ] AI审核报告页（展示Mock报告）

---

## 阶段 5: M4 - 项目模块

### 5.1 项目后端API
- [ ] Project CRUD API
  - [ ] POST /api/v1/project/projects（创建项目）
    - [ ] 自动生成阶段（B2B 8个/B2C 9个）
  - [ ] GET /api/v1/project/projects（项目列表）
  - [ ] GET /api/v1/project/projects/{project_id}（项目详情）
  - [ ] PATCH /api/v1/project/projects/{project_id}（更新项目）
- [ ] Project Stage API
  - [ ] PATCH /api/v1/project/stages/{stage_id}（更新阶段状态）
  - [ ] 阶段状态变更时写审计日志
- [ ] Project Member API（可选）
  - [ ] POST /api/v1/project/projects/{project_id}/members（添加成员）

### 5.2 项目任务与Todo集成
- [ ] 项目任务接口（复用Todo API）
  - [ ] 创建任务时设置source_type=project_task
  - [ ] 设置tags=["project:{project_id}", "stage:{stage_code}"]
- [ ] 项目详情页获取任务列表
  - [ ] GET /api/v1/todo/my?source_type=project_task&project_id={id}

### 5.3 项目与合同联动
- [ ] 项目关联合同接口
  - [ ] PATCH /api/v1/project/projects/{project_id}（设置contract_id）
- [ ] 合同签署推进项目阶段逻辑
  - [ ] 合同状态变更为signed时，检查关联项目
  - [ ] 自动或提示更新项目阶段（contract_signed → done）

### 5.4 项目进度计算
- [ ] 阶段进度计算逻辑（done_tasks / total_tasks）
- [ ] 项目总进度计算逻辑（阶段平均）
- [ ] GET /api/v1/project/projects/{project_id}/progress

### 5.5 项目前端页面（Web）
- [ ] 项目列表页
  - [ ] 项目列表（卡片或表格）
  - [ ] 筛选器（类型/状态/负责人/客户）
  - [ ] 进度展示
- [ ] 项目详情页
  - [ ] 基本信息
  - [ ] 阶段看板（可视化进度条/甘特图）
  - [ ] 任务列表（来自Todo）
  - [ ] 关联合同（可跳转）
  - [ ] 项目成员
- [ ] 项目创建/编辑页
  - [ ] 表单（基本信息/类型/负责人/客户）
  - [ ] 关联合同选择器（B2B）
- [ ] 任务创建弹窗（调用Todo API）

---

## 阶段 6: M5 - 财务模块

### 6.1 财务后端API
- [ ] Account API
  - [ ] CRUD接口实现
  - [ ] 私账账户绑定股东用户（is_shareholder验证）
- [ ] Transaction API
  - [ ] POST /api/v1/finance/transactions（创建流水）
  - [ ] GET /api/v1/finance/transactions（流水列表，按权限过滤）
  - [ ] GET /api/v1/finance/transactions/{txn_id}（流水详情）
  - [ ] PATCH /api/v1/finance/transactions/{txn_id}（更新流水）
- [ ] Invoice API
  - [ ] POST /api/v1/finance/invoices（创建发票，上传文件触发OCR）
  - [ ] GET /api/v1/finance/invoices（发票列表）
  - [ ] GET /api/v1/finance/invoices/{invoice_id}（发票详情）
  - [ ] POST /api/v1/finance/invoices/{invoice_id}/confirm（人工确认OCR）

### 6.2 OCR功能（Mock/占位）
- [ ] 发票OCR接口（POST /api/v1/finance/invoices/ocr）
  - [ ] V1返回Mock数据
  - [ ] 写入ocr_extracted_fields、ocr_confidence
  - [ ] 置信度低于阈值 → ocr_status=needs_review
- [ ] OCR复核Todo生成（可选）
  - [ ] needs_review状态生成review类Todo给财务

### 6.3 开票申请与报销流程
- [ ] Invoice Request API
  - [ ] POST /api/v1/finance/invoice-requests（创建开票申请）
  - [ ] POST /api/v1/finance/invoice-requests/{request_id}/submit（提交审批）
  - [ ] 审批通过后 → 财务开票（手动创建发票并关联）
- [ ] Reimbursement API
  - [ ] POST /api/v1/finance/reimbursements（创建报销单）
  - [ ] POST /api/v1/finance/reimbursements/{reim_id}/submit（提交审批）
  - [ ] 审批通过后 → 出纳付款（创建out流水并关联）

### 6.4 财务与合同联动
- [ ] 流水关联分期接口
  - [ ] POST /api/v1/finance/transactions/{txn_id}/link-payment-plan
  - [ ] 验证方向一致（receivable→in, payable→out）
  - [ ] 回写paid_amount/paid_at/status到payment_plan
  - [ ] 触发合同资金进度重算
- [ ] 发票/开票申请关联合同/分期
  - [ ] 在创建时支持填写contract_id/payment_plan_id

### 6.5 财务前端页面（Web）
- [ ] 账户管理页
  - [ ] 账户列表（公账/私账分组）
  - [ ] 账户创建/编辑（私账绑定股东）
- [ ] 流水管理页
  - [ ] 流水列表（按权限展示）
  - [ ] 筛选器（账户/方向/日期/对方主体）
  - [ ] 关联合同分期操作
- [ ] 发票管理页
  - [ ] 发票列表（进项/销项）
  - [ ] 发票上传与OCR识别
  - [ ] OCR结果确认页（needs_review）
- [ ] 开票申请页
  - [ ] 申请列表
  - [ ] 创建申请表单（关联合同）
  - [ ] 审批进度展示
- [ ] 报销管理页
  - [ ] 报销单列表
  - [ ] 创建报销单（费用明细/附件）
  - [ ] 审批进度展示

---

## 阶段 7: M6 - 微信小程序

### 7.1 小程序认证
- [ ] 微信登录后端API
  - [ ] POST /api/v1/auth/wechat/login
    - [ ] 接收code换取openid/unionid
    - [ ] 绑定或创建user
    - [ ] 返回JWT Token
- [ ] wechat_user_binding表管理

### 7.2 小程序工作台（Todo）
- [ ] 工作台首页
  - [ ] 待办列表（调用 GET /api/v1/todo/my）
  - [ ] 筛选器（状态/截止/来源）
  - [ ] 下拉刷新
- [ ] 待办详情页
  - [ ] 展示待办信息
  - [ ] 完成/阻塞操作
  - [ ] 跳转关联对象

### 7.3 小程序审批
- [ ] 审批待办列表（筛选action_type=approve）
- [ ] 审批详情页
  - [ ] 展示审批对象（合同/开票/报销）
  - [ ] 审批操作（通过/驳回）
  - [ ] 附件预览

### 7.4 小程序合同查看
- [ ] 合同列表页
  - [ ] 合同列表（调用 GET /api/v1/contract/contracts）
  - [ ] 筛选器
- [ ] 合同详情页
  - [ ] 基本信息展示
  - [ ] 分期列表
  - [ ] 附件预览（PDF/图片）

### 7.5 小程序项目查看
- [ ] 项目列表页
- [ ] 项目详情页
  - [ ] 阶段进度看板
  - [ ] 任务列表（可完成）

### 7.6 小程序财务查看
- [ ] 账户余额页（按权限）
- [ ] 流水查询页
- [ ] 发票查看页

### 7.7 小程序通知
- [ ] 订阅消息配置（后端）
  - [ ] wechat_message_template表
  - [ ] 调用微信API发送订阅消息
- [ ] 消息中心页（小程序）
  - [ ] 站内消息列表
  - [ ] 消息跳转

---

## 阶段 8: 集成测试与UAT

### 8.1 跨模块集成测试
- [ ] B2B交付与回款闭环
  - [ ] 创建B2B项目
  - [ ] 关联合同并审批
  - [ ] 合同签署推进项目阶段
  - [ ] 创建分期
  - [ ] 录入流水并回写分期
  - [ ] 验证合同资金进度
  - [ ] 验证尾款待办生成
- [ ] C2C产品上线闭环
  - [ ] 创建C2C项目
  - [ ] 拆解任务（Todo）
  - [ ] 完成任务驱动进度
  - [ ] 阶段推进
- [ ] 报销闭环
  - [ ] 提交报销单
  - [ ] 审批流与Todo联动
  - [ ] 审批通过后出纳付款
  - [ ] 验证流水关联

### 8.2 UAT测试（按各模块验收标准）
- [ ] UAT-IAM-001 ~ 004（IAM模块）
- [ ] UAT-TODO-001 ~ 004（Todo模块）
- [ ] UAT-CT-001 ~ 005（合同模块）
- [ ] UAT-PJ-001 ~ 004（项目模块）
- [ ] UAT-FIN-001 ~ 006（财务模块）
- [ ] UAT-MP-001 ~ 006（小程序模块）

### 8.3 性能与安全测试
- [ ] API性能测试（并发/响应时间）
- [ ] 数据库性能测试（查询优化/索引）
- [ ] 安全测试（SQL注入/XSS/CSRF防护）
- [ ] 权限测试（RBAC隔离验证）

---

## 阶段 9: 部署与上线

### 9.1 部署准备
- [ ] 编写部署脚本（deploy.sh）
- [ ] 配置Nginx（反向代理/静态文件）
- [ ] 配置SSL证书（HTTPS）
- [ ] 准备生产环境配置文件（.env.production）

### 9.2 后端部署
- [ ] 上传代码到服务器
- [ ] 安装Python依赖（虚拟环境）
- [ ] 初始化生产数据库（迁移/种子数据）
- [ ] 配置Uvicorn服务（systemd/supervisor）
- [ ] 配置日志路径与轮转

### 9.3 前端部署
- [ ] 构建生产版本（npm run build）
- [ ] 上传dist到服务器
- [ ] 配置Nginx静态文件托管
- [ ] 验证Web访问

### 9.4 小程序发布
- [ ] 小程序代码上传（微信开发者工具）
- [ ] 配置服务器域名白名单（微信后台）
- [ ] 提交审核
- [ ] 审核通过后发布上线

### 9.5 上线后监控
- [ ] 配置日志监控（ELK/Grafana）
- [ ] 配置接口监控（Sentry/DataDog）
- [ ] 配置数据库备份策略
- [ ] 配置告警机制（异常/性能）

---

## 阶段 10: V1.1 增强功能（可选）

### 10.1 真实AI集成
- [ ] 接入OpenAI/通义千问API
- [ ] 实现真实合同生成
- [ ] 实现真实合同审核

### 10.2 真实OCR集成
- [ ] 接入腾讯OCR/阿里OCR
- [ ] 发票识别真实实现

### 10.3 异步任务队列
- [ ] 部署Redis
- [ ] 配置Celery
- [ ] 异步化耗时任务（OCR/AI/通知）

### 10.4 复杂审批流
- [ ] 支持动态审批流配置
- [ ] 支持多人会签/或签
- [ ] 支持条件分支审批

### 10.5 报表与统计
- [ ] 合同统计报表
- [ ] 财务统计报表
- [ ] 项目进度报表

---

## 里程碑检查点

| 里程碑 | 核心产出 | 验收标准 |
|-------|---------|---------|
| M0 | 环境准备完成 | 可运行Hello World |
| M1 | IAM + 共享服务 | 登录/权限/审批引擎可用 |
| M2 | Todo引擎 | 工作台可展示待办并操作 |
| M3 | 合同模块 | 合同审批流与尾款待办跑通 |
| M4 | 项目模块 | 项目任务进入工作台 |
| M5 | 财务模块 | 流水回写分期，发票OCR可用 |
| M6 | 小程序 | 小程序登录、工作台、审批可用 |
| M7 | 集成测试 | 三大业务闭环跑通 |
| M8 | 部署上线 | 生产环境可访问 |

---
