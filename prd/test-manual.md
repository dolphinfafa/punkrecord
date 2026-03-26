# PunkRecord 测试手册

> 面向测试人员的操作指南，涵盖各功能模块的手动测试流程和 API 接口测试。

---

## 目录

- [1. 测试环境](#1-测试环境)
- [2. 测试账号](#2-测试账号)
- [3. 认证与登录](#3-认证与登录)
- [4. 工作台（Dashboard）](#4-工作台dashboard)
- [5. 待办事项（Todo）](#5-待办事项todo)
- [6. 用户管理（IAM）](#6-用户管理iam)
- [7. 合同管理（Contract）](#7-合同管理contract)
- [8. 项目管理（Project）](#8-项目管理project)
- [9. 财务管理（Finance）](#9-财务管理finance)
- [10. AI 能力](#10-ai-能力)
- [11. 权限体系测试](#11-权限体系测试)
- [12. 集成流程测试](#12-集成流程测试)

---

## 1. 测试环境

| 项目 | 值 |
|------|-----|
| 后端地址 | `http://localhost:15085` |
| 前端地址 | `http://localhost:15173` |
| API 前缀 | `/api/v1` |
| API 基础地址 | `http://localhost:15085/api/v1` |
| 数据库 | MySQL 8.0（`14.103.133.34:13306/punkrecord_dev`） |

### 启动服务

```bash
# 后端
cd backend
conda activate punkrecord
uvicorn app.main:app --reload --port 15085

# 前端
cd frontend
npm run dev
```

### API 测试约定

所有接口统一响应格式：

```json
// 成功
{ "data": { ... }, "message": "ok" }

// 失败
{ "code": 400, "message": "错误描述" }
```

下文所有 `curl` 示例中 `$TOKEN` 表示登录后获取的 Bearer Token，可通过以下方式获取：

```bash
# 登录获取 Token
TOKEN=$(curl -s -X POST http://localhost:15085/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

echo $TOKEN
```

---

## 2. 测试账号

| 姓名 | 用户名 | 密码 | 职位 | 权限范围 | 备注 |
|------|--------|------|------|---------|------|
| Administrator | admin | admin123 | - | 全部权限 | 管理员 |
| 杨喆 | zheyang | （已设置） | - | 全部权限 | 股东 L0 |
| 殷萄 | yintao | yintao123 | 产品经理 | 按职位分配 | 上级：杨喆 |
| 小泽 | xiaoze | xiaoze123 | 前端工程师 | 按职位分配 | 上级：杨喆 |
| 李辰欣 | lichenxin | lichenxin123 | 实习生 | 按职位分配 | 上级：殷萄 |
| 小雪 | xiaoxue | xiaoxue123 | 测试员 | 按职位分配 | 上级：殷萄 |

> 权限可在「用户管理 → 职位管理 → 权限」中配置。

---

## 3. 认证与登录

### 3.1 前端手动测试

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 打开 `http://localhost:15173/login` | 显示登录页面 |
| 2 | 输入错误的用户名/密码，点击「登录」 | 显示"用户名或密码错误" |
| 3 | 输入正确的用户名/密码，点击「登录」 | 跳转到工作台 |
| 4 | 使用新建账号首次登录（`must_change_password=true`） | 跳转到个人档案填写页 |
| 5 | 填写个人信息、设置新密码，点击「提交并进入系统」 | 跳转到工作台 |
| 6 | 点击侧边栏底部「退出登录」 | 跳转回登录页 |

### 3.2 API 接口测试

#### POST /auth/login — 登录

```bash
curl -X POST http://localhost:15085/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**预期响应：**
```json
{
  "data": {
    "access_token": "eyJ...",
    "token_type": "bearer",
    "user_id": "uuid",
    "display_name": "Administrator",
    "profile_completed": true,
    "must_change_password": false
  }
}
```

#### GET /auth/me — 获取当前用户信息（含权限）

```bash
curl http://localhost:15085/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应（包含 permissions 字段）：**
```json
{
  "data": {
    "id": "uuid",
    "display_name": "Administrator",
    "username": "admin",
    "email": "admin@atlas.com",
    "status": "active",
    "profile_completed": true,
    "must_change_password": false,
    "permissions": ["contract.read", "contract.write", "finance.read", "finance.write", "iam.read", "iam.write", "project.read", "project.write", "todo.read", "todo.write"]
  }
}
```

#### POST /auth/change-password — 修改密码

```bash
curl -X POST http://localhost:15085/api/v1/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"old_password":"admin123","new_password":"newpass123"}'
```

#### POST /auth/complete-profile — 首次登录完善档案

```bash
curl -X POST http://localhost:15085/api/v1/auth/complete-profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "phone": "13800138000",
    "birthday": "1995-01-01",
    "education_level": "bachelor",
    "new_password": "newpass123"
  }'
```

#### POST /auth/logout — 退出登录

```bash
curl -X POST http://localhost:15085/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. 工作台（Dashboard）

### 4.1 前端手动测试

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 登录后查看工作台 | 显示"欢迎回来, {姓名}" |
| 2 | 查看四个统计卡片 | 分别显示进行中、待审批、待开始、已完成的任务数 |
| 3 | 点击统计卡片 | 跳转到待办事项页，并按状态过滤 |
| 4 | 查看请假余额面板 | 显示年假/产假/婚假/事假/病假剩余天数 |
| 5 | 选择请假类型、填写时间、提交请假 | 提交成功，刷新余额面板 |
| 6 | （以上级身份登录）查看团队待审请假 | 显示下属的待审请假列表 |
| 7 | 点击「通过」或「驳回」 | 处理请假请求，余额相应扣减/不变 |

> **注意**：L0 级别用户（如杨喆）不需要请假，请假功能会禁用。

---

## 5. 待办事项（Todo）

### 5.1 前端手动测试

#### 任务生命周期

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 点击「新建任务」 | 弹出任务创建表单 |
| 2 | 填写标题、描述、优先级、负责人、截止日期 | - |
| 3 | 点击「保存」 | 任务出现在看板「未开始」列 |
| 4 | 拖拽任务到「进行中」列 | 状态变为 IN_PROGRESS |
| 5 | 拖拽任务到「上报完成」列 | 状态变为 PENDING_REVIEW |
| 6 | （以创建者身份）查看待审任务 | 显示审核按钮 |
| 7 | 点击「通过」 | 任务变为 DONE，贝利规则自动结算 |
| 8 | 点击「驳回」（需填写原因） | 任务退回 OPEN 状态 |

#### 视图切换

| 操作 | 预期结果 |
|------|---------|
| 点击「看板视图」 | 四列看板：未开始/进行中/上报完成/已完成 |
| 点击「全部列表」 | 列表形式显示所有任务 |
| 切换「我的任务」/「团队任务」标签 | 分别显示自己的和下属的任务 |
| 选择类型过滤器 | 按任务类型筛选 |
| 选择负责人过滤器 | 按指定人筛选 |

#### 图片附件

| 操作 | 预期结果 |
|------|---------|
| 在任务详情中上传图片 | 图片显示在附件区域 |
| 下载图片 | 正确下载图片文件 |
| 删除图片 | 图片从附件列表移除 |

### 5.2 API 接口测试

#### POST /todo — 创建任务

```bash
curl -X POST http://localhost:15085/api/v1/todo \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试任务",
    "description": "这是一个测试任务",
    "assignee_user_id": "<用户UUID>",
    "priority": "p2",
    "due_at": "2026-03-15T18:00:00"
  }'
```

#### GET /todo/my — 获取我的任务

```bash
# 全部任务
curl "http://localhost:15085/api/v1/todo/my?page=1&page_size=20" \
  -H "Authorization: Bearer $TOKEN"

# 按状态过滤（open 包含 open/in_progress/blocked）
curl "http://localhost:15085/api/v1/todo/my?status=open" \
  -H "Authorization: Bearer $TOKEN"
```

#### GET /todo/team — 获取团队任务（需有下属）

```bash
curl "http://localhost:15085/api/v1/todo/team?page=1&page_size=20" \
  -H "Authorization: Bearer $TOKEN"
```

#### POST /todo/{todo_id}/start — 开始任务

```bash
curl -X POST http://localhost:15085/api/v1/todo/<todo_id>/start \
  -H "Authorization: Bearer $TOKEN"
```

#### POST /todo/{todo_id}/submit — 提交完成

```bash
curl -X POST http://localhost:15085/api/v1/todo/<todo_id>/submit \
  -H "Authorization: Bearer $TOKEN"
```

> 如果创建者 == 负责人，自动审核通过变为 DONE；否则变为 PENDING_REVIEW。

#### POST /todo/{todo_id}/approve — 审核通过

```bash
curl -X POST http://localhost:15085/api/v1/todo/<todo_id>/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "做得好"}'
```

#### POST /todo/{todo_id}/reject — 审核驳回

```bash
curl -X POST http://localhost:15085/api/v1/todo/<todo_id>/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "需要修改细节"}'
```

#### POST /todo/{todo_id}/block — 标记阻塞

```bash
curl -X POST "http://localhost:15085/api/v1/todo/<todo_id>/block?blocked_reason=等待第三方接口" \
  -H "Authorization: Bearer $TOKEN"
```

#### POST /todo/{todo_id}/dismiss — 忽略任务

```bash
curl -X POST "http://localhost:15085/api/v1/todo/<todo_id>/dismiss?dismiss_reason=需求已取消" \
  -H "Authorization: Bearer $TOKEN"
```

#### 图片上传/下载/删除

```bash
# 上传图片
curl -X POST http://localhost:15085/api/v1/todo/<todo_id>/images \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@screenshot.png"

# 下载图片
curl http://localhost:15085/api/v1/todo/<todo_id>/images/<image_id>/download \
  -H "Authorization: Bearer $TOKEN" -o image.png

# 删除图片
curl -X DELETE http://localhost:15085/api/v1/todo/<todo_id>/images/<image_id> \
  -H "Authorization: Bearer $TOKEN"
```

#### 请假相关

```bash
# 创建请假申请
curl -X POST http://localhost:15085/api/v1/todo/leaves \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leave_type": "annual",
    "start_at": "2026-03-10T09:00:00",
    "end_at": "2026-03-11T18:00:00",
    "reason": "个人事务"
  }'

# 查看我的请假
curl "http://localhost:15085/api/v1/todo/leaves/my" \
  -H "Authorization: Bearer $TOKEN"

# 查看团队待审请假（需是上级）
curl http://localhost:15085/api/v1/todo/leaves/team/pending \
  -H "Authorization: Bearer $TOKEN"

# 审批通过（扣减假期余额）
curl -X POST http://localhost:15085/api/v1/todo/leaves/<leave_id>/approve \
  -H "Authorization: Bearer $TOKEN"

# 审批驳回
curl -X POST http://localhost:15085/api/v1/todo/leaves/<leave_id>/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "时间冲突"}'
```

---

## 6. 用户管理（IAM）

> 需要 `iam.read` / `iam.write` 权限。

### 6.1 前端手动测试

#### 员工管理（/iam/users）

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 进入用户管理页面 | 显示员工列表 |
| 2 | 点击「新建员工」 | 弹出创建表单 |
| 3 | 填写姓名、用户名、密码、部门、职位、上级 | - |
| 4 | 点击「保存」 | 员工出现在列表中 |
| 5 | 点击员工行的「编辑」 | 弹出编辑表单，显示完整信息 |
| 6 | 修改信息后保存 | 更新成功 |
| 7 | （L0 用户）点击「重置密码」 | 密码重置为 punkrecord123 |
| 8 | （L0 用户）调整贝利积分 | 余额变化 |
| 9 | （L0 用户）点击「重置假期余额」 | 所有员工假期恢复默认 |
| 10 | 使用搜索框搜索 | 按姓名/用户名过滤 |

#### 部门管理（/iam/departments）

| 操作 | 预期结果 |
|------|---------|
| 点击「新建部门」，填写名称和上级部门 | 部门出现在树形结构中 |
| 编辑部门名称 | 更新成功 |
| 删除没有子部门和成员的部门 | 删除成功 |
| 删除有子部门或成员的部门 | 报错提示 |

#### 职位管理（/iam/job-titles）

| 操作 | 预期结果 |
|------|---------|
| 创建新职位 | 出现在列表中 |
| 点击「权限」按钮 | 弹出权限配置面板 |
| 勾选/取消模块权限（如 todo.read、project.write） | - |
| 点击「保存权限」 | 权限生效，该职位用户重新登录后生效 |
| 删除没有关联用户的职位 | 删除成功 |
| 删除已关联用户的职位 | 报错提示 |

#### 贝利规则（/iam/beli-rules）

| 操作 | 预期结果 |
|------|---------|
| （L0 用户）创建规则：提前 3 天奖励 10 贝利，延迟 2 天扣除 5 贝利 | 规则出现在列表中 |
| 编辑规则 | 更新成功 |
| 禁用/启用规则 | 状态切换 |
| 删除规则 | 删除成功 |

#### 组织架构（/iam/org-chart）

| 操作 | 预期结果 |
|------|---------|
| 打开组织架构页 | 显示树形层级结构 |
| 展开/折叠节点 | 显示/隐藏下属 |
| 查看节点信息 | 显示姓名、职位、部门、层级 |
| 股东节点显示皇冠图标 | 标识为 L0 |

### 6.2 API 接口测试

#### 用户 CRUD

```bash
# 创建用户
curl -X POST http://localhost:15085/api/v1/iam/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "测试用户",
    "username": "testuser",
    "password": "test123456",
    "department_id": "<部门UUID>",
    "job_title_id": "<职位UUID>",
    "manager_user_id": "<上级UUID>"
  }'

# 查询用户列表（支持分页和过滤）
curl "http://localhost:15085/api/v1/iam/users?page=1&page_size=20" \
  -H "Authorization: Bearer $TOKEN"

# 按部门过滤
curl "http://localhost:15085/api/v1/iam/users?department_id=<UUID>" \
  -H "Authorization: Bearer $TOKEN"

# 获取单个用户
curl http://localhost:15085/api/v1/iam/users/<user_id> \
  -H "Authorization: Bearer $TOKEN"

# 更新用户
curl -X PATCH http://localhost:15085/api/v1/iam/users/<user_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "新名字", "status": "inactive"}'

# 重置密码（L0）
curl -X POST http://localhost:15085/api/v1/iam/users/<user_id>/reset-password \
  -H "Authorization: Bearer $TOKEN"

# 重置单个用户假期余额（L0）
curl -X POST http://localhost:15085/api/v1/iam/users/<user_id>/reset-leave-balances \
  -H "Authorization: Bearer $TOKEN"

# 重置所有员工假期余额（L0）
curl -X POST http://localhost:15085/api/v1/iam/users/reset-leave-balances \
  -H "Authorization: Bearer $TOKEN"
```

#### 文件上传

```bash
# 上传身份证图片
curl -X POST http://localhost:15085/api/v1/iam/users/<user_id>/id-card-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@id_card.jpg"

# 上传简历（仅 PDF）
curl -X POST http://localhost:15085/api/v1/iam/users/<user_id>/resume \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@resume.pdf"

# 下载文件
curl http://localhost:15085/api/v1/iam/users/<user_id>/files/<filename> \
  -H "Authorization: Bearer $TOKEN" -o downloaded_file
```

#### 部门 CRUD

```bash
# 查看部门树
curl http://localhost:15085/api/v1/iam/departments \
  -H "Authorization: Bearer $TOKEN"

# 创建部门
curl -X POST http://localhost:15085/api/v1/iam/departments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "测试部门", "description": "描述"}'

# 创建子部门
curl -X POST http://localhost:15085/api/v1/iam/departments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "子部门", "parent_org_unit_id": "<父部门UUID>"}'

# 更新部门
curl -X PATCH http://localhost:15085/api/v1/iam/departments/<dept_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "新部门名"}'

# 删除部门
curl -X DELETE http://localhost:15085/api/v1/iam/departments/<dept_id> \
  -H "Authorization: Bearer $TOKEN"
```

#### 职位 & 权限

```bash
# 查看所有职位
curl http://localhost:15085/api/v1/iam/job-titles \
  -H "Authorization: Bearer $TOKEN"

# 创建职位
curl -X POST http://localhost:15085/api/v1/iam/job-titles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "测试工程师", "description": "负责测试"}'

# 查看所有权限列表
curl http://localhost:15085/api/v1/iam/permissions \
  -H "Authorization: Bearer $TOKEN"

# 查看职位已分配的权限
curl http://localhost:15085/api/v1/iam/job-titles/<job_title_id>/permissions \
  -H "Authorization: Bearer $TOKEN"

# 设置职位权限（全量替换）
curl -X PUT http://localhost:15085/api/v1/iam/job-titles/<job_title_id>/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permission_codes": ["todo.read", "todo.write", "project.read"]}'
```

#### 贝利规则 & 组织架构

```bash
# 查看贝利规则
curl http://localhost:15085/api/v1/iam/beli-rules \
  -H "Authorization: Bearer $TOKEN"

# 创建贝利规则（L0）
curl -X POST http://localhost:15085/api/v1/iam/beli-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "标准任务时效规则",
    "rule_type": "task_timeliness",
    "enabled": true,
    "early_days": 3,
    "reward_beili": 10,
    "late_days": 2,
    "penalty_beili": 5,
    "note": "提前3天奖10贝利，延迟2天扣5贝利"
  }'

# 查看组织架构树
curl http://localhost:15085/api/v1/iam/org-chart \
  -H "Authorization: Bearer $TOKEN"
```

---

## 7. 合同管理（Contract）

> 需要 `contract.read` / `contract.write` 权限。

### 7.1 前端手动测试

#### 交易方管理（/contract/counterparties）

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 点击「添加交易方」 | 弹出创建表单 |
| 2 | 填写名称、类型（个人/企业）、税号、地址 | - |
| 3 | 保存 | 出现在交易方列表中 |

#### 合同管理（/contract/list）

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 点击「创建合同」 | 弹出创建表单 |
| 2 | 填写合同编号、名称、类型、甲乙方、金额 | - |
| 3 | 添加付款计划（序号、方向、名称、金额、截止日期） | - |
| 4 | 保存 | 合同出现在列表中，状态为「草稿」 |
| 5 | 编辑合同内容 | 更新成功 |
| 6 | 提交审批 | 状态变为「待审批」 |

### 7.2 API 接口测试

```bash
# 创建交易方
curl -X POST http://localhost:15085/api/v1/contract/counterparties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试科技有限公司",
    "type": "organization",
    "identifier": "91110000MA12345678",
    "address": "北京市朝阳区",
    "phone": "010-12345678"
  }'

# 查询交易方列表
curl "http://localhost:15085/api/v1/contract/counterparties" \
  -H "Authorization: Bearer $TOKEN"

# 创建合同（含付款计划）
curl -X POST http://localhost:15085/api/v1/contract/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_no": "CT-2026-001",
    "name": "测试项目开发合同",
    "contract_type": "sales",
    "party_a_id": "<甲方UUID>",
    "party_b_id": "<乙方UUID>",
    "amount_total": 100000.00,
    "currency": "CNY",
    "sign_date": "2026-03-01",
    "effective_date": "2026-03-01",
    "expire_date": "2026-12-31",
    "summary": "项目开发合同",
    "payment_plans": [
      {"sequence_no": 1, "direction": "in", "name": "首期款", "amount": 30000.00, "due_at": "2026-04-01T00:00:00"},
      {"sequence_no": 2, "direction": "in", "name": "中期款", "amount": 40000.00, "due_at": "2026-07-01T00:00:00"},
      {"sequence_no": 3, "direction": "in", "name": "尾款", "amount": 30000.00, "due_at": "2026-11-01T00:00:00", "is_final": true}
    ]
  }'

# 查询合同列表
curl "http://localhost:15085/api/v1/contract/contracts?page=1&page_size=20" \
  -H "Authorization: Bearer $TOKEN"

# 按状态和类型过滤
curl "http://localhost:15085/api/v1/contract/contracts?status=draft&contract_type=sales" \
  -H "Authorization: Bearer $TOKEN"

# 获取单个合同
curl http://localhost:15085/api/v1/contract/contracts/<contract_id> \
  -H "Authorization: Bearer $TOKEN"

# 更新合同
curl -X PATCH http://localhost:15085/api/v1/contract/contracts/<contract_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"summary": "更新后的摘要"}'

# 获取付款计划
curl http://localhost:15085/api/v1/contract/contracts/<contract_id>/payment-plans \
  -H "Authorization: Bearer $TOKEN"

# 提交审批
curl -X POST http://localhost:15085/api/v1/contract/contracts/<contract_id>/submit \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. 项目管理（Project）

> 需要 `project.read` / `project.write` 权限。

### 8.1 前端手动测试

#### 项目列表（/project）

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 点击「创建项目」 | 弹出创建表单 |
| 2 | 填写项目编号、名称、类型（B2B/B2C）、项目经理 | - |
| 3 | 保存 | 项目卡片出现在列表中 |
| 4 | 切换「ToB 项目」/「ToC 项目」标签 | 按类型过滤 |
| 5 | 点击项目卡片 | 进入项目详情页 |

#### 项目详情（/project/:id）

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 查看项目阶段 | B2B 显示 8 个阶段，B2C 显示 9 个阶段 |
| 2 | 更新阶段状态 | 设为「进行中」时自动记录开始时间 |
| 3 | 完成阶段 | 设为「完成」时自动记录结束时间 |
| 4 | 添加团队成员 | 成员出现在团队列表中 |
| 5 | 上传项目附件 | 附件出现在附件列表中 |
| 6 | 点击「下载验收报告」 | 下载 .docx 文件 |

#### 功能清单 & 任务生成

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 在功能清单阶段，使用 AI 生成功能清单 | 表格形式显示功能列表 |
| 2 | 点击「生成开发任务」 | 根据功能清单自动创建待办任务 |
| 3 | 批量分配任务给团队成员 | 所有选中任务更新负责人 |

#### 开发进度（/project/:id/dev-progress）

| 操作 | 预期结果 |
|------|---------|
| 查看开发进度页 | 按开发类型分组显示任务 |
| 筛选负责人 | 按人员过滤任务 |

### 8.2 API 接口测试

#### 项目 CRUD

```bash
# 创建 B2B 项目（自动生成 8 个阶段）
curl -X POST http://localhost:15085/api/v1/project/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_no": "PRJ-2026-001",
    "name": "测试项目",
    "project_type": "b2b",
    "pm_user_id": "<项目经理UUID>",
    "start_at": "2026-03-01",
    "due_at": "2026-06-30",
    "description": "B2B 测试项目"
  }'

# 查询项目列表
curl "http://localhost:15085/api/v1/project/projects?page=1&page_size=20&project_type=b2b" \
  -H "Authorization: Bearer $TOKEN"

# 获取项目详情
curl http://localhost:15085/api/v1/project/projects/<project_id> \
  -H "Authorization: Bearer $TOKEN"

# 更新项目
curl -X PATCH http://localhost:15085/api/v1/project/projects/<project_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "description": "更新描述"}'

# 删除项目
curl -X DELETE http://localhost:15085/api/v1/project/projects/<project_id> \
  -H "Authorization: Bearer $TOKEN"
```

#### 项目阶段

```bash
# 获取项目阶段列表
curl http://localhost:15085/api/v1/project/projects/<project_id>/stages \
  -H "Authorization: Bearer $TOKEN"

# 更新阶段状态
curl -X PATCH http://localhost:15085/api/v1/project/projects/<project_id>/stages/<stage_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'

# 完成阶段
curl -X PATCH http://localhost:15085/api/v1/project/projects/<project_id>/stages/<stage_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "done", "deliverables": "交付物说明"}'
```

#### 团队成员

```bash
# 添加单个成员
curl -X POST http://localhost:15085/api/v1/project/projects/<project_id>/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<成员UUID>", "role_in_project": "前端开发"}'

# 批量添加成员
curl -X POST http://localhost:15085/api/v1/project/projects/<project_id>/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": ["<UUID1>", "<UUID2>"]}'

# 查看成员列表
curl http://localhost:15085/api/v1/project/projects/<project_id>/members \
  -H "Authorization: Bearer $TOKEN"

# 移除成员
curl -X DELETE http://localhost:15085/api/v1/project/projects/<project_id>/members/<user_id> \
  -H "Authorization: Bearer $TOKEN"
```

#### 项目任务

```bash
# 获取项目任务列表
curl "http://localhost:15085/api/v1/project/projects/<project_id>/todos?page=1&page_size=20" \
  -H "Authorization: Bearer $TOKEN"

# 按状态和负责人过滤
curl "http://localhost:15085/api/v1/project/projects/<project_id>/todos?status=open&assignee_user_id=<UUID>" \
  -H "Authorization: Bearer $TOKEN"

# 分配任务
curl -X POST http://localhost:15085/api/v1/project/projects/<project_id>/todos/<todo_id>/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assignee_user_id": "<用户UUID>"}'

# 规划任务（设置负责人、截止日期、优先级等）
curl -X POST http://localhost:15085/api/v1/project/projects/<project_id>/todos/<todo_id>/plan \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assignee_user_id": "<UUID>",
    "due_at": "2026-04-01T18:00:00",
    "priority": "p1",
    "dev_type": "dev_frontend"
  }'

# 批量分配任务
curl -X POST http://localhost:15085/api/v1/project/projects/<project_id>/todos/batch-assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"todo_ids": ["<UUID1>", "<UUID2>"], "assignee_user_id": "<UUID>"}'

# 删除单个任务
curl -X DELETE http://localhost:15085/api/v1/project/projects/<project_id>/todos/<todo_id> \
  -H "Authorization: Bearer $TOKEN"

# 批量删除任务（可按状态过滤）
curl -X DELETE "http://localhost:15085/api/v1/project/projects/<project_id>/todos?status=open" \
  -H "Authorization: Bearer $TOKEN"
```

#### 附件

```bash
# 上传项目附件（最大 20MB）
curl -X POST http://localhost:15085/api/v1/project/projects/<project_id>/attachments \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.pdf"

# 获取附件列表
curl http://localhost:15085/api/v1/project/projects/<project_id>/attachments \
  -H "Authorization: Bearer $TOKEN"

# 下载附件
curl http://localhost:15085/api/v1/project/projects/<project_id>/attachments/<attachment_id>/download \
  -H "Authorization: Bearer $TOKEN" -o file.pdf

# 删除附件
curl -X DELETE http://localhost:15085/api/v1/project/projects/<project_id>/attachments/<attachment_id> \
  -H "Authorization: Bearer $TOKEN"

# 上传阶段附件
curl -X POST http://localhost:15085/api/v1/project/projects/<project_id>/stages/<stage_id>/attachments \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@design.png"
```

#### 功能清单 & 任务生成

```bash
# 获取功能清单
curl http://localhost:15085/api/v1/project/projects/<project_id>/feature-list \
  -H "Authorization: Bearer $TOKEN"

# 从功能清单生成开发任务
curl -X POST http://localhost:15085/api/v1/project/projects/<project_id>/generate-dev-tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feature_list": [{"l1_feature": "用户模块", "l2_feature": "登录功能", "dev_backend": 2, "dev_frontend": 3}],
    "priority": "p2"
  }'

# 同步开发任务
curl -X POST http://localhost:15085/api/v1/project/projects/<project_id>/sync-dev-tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feature_list": [...]}'
```

#### 导出

```bash
# 导出报价 Excel
curl -X POST http://localhost:15085/api/v1/project/export_quote_excel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "<UUID>", "feature_list": [...]}' -o quote.xlsx

# 导出合同 Word
curl -X POST http://localhost:15085/api/v1/project/export-contract-docx \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "<UUID>", "contract_context": {}}' -o contract.docx

# 下载验收报告
curl http://localhost:15085/api/v1/project/projects/<project_id>/acceptance-report/download \
  -H "Authorization: Bearer $TOKEN" -o report.docx
```

---

## 9. 财务管理（Finance）

> 需要 `finance.read` / `finance.write` 权限。

### 9.1 前端手动测试

#### 账户管理（/finance/accounts）

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 点击「添加账户」 | 弹出创建表单 |
| 2 | 填写账户名称、银行、类型（公户/私户）、初始余额 | - |
| 3 | 保存 | 账户出现在列表中，显示余额 |
| 4 | 编辑账户信息 | 更新成功 |

#### 交易管理（/finance/transactions）

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 点击「新增交易明细」 | 弹出创建表单 |
| 2 | 选择交易类型（收款/付款/报销） | 方向自动设置（收款=IN，付款/报销=OUT） |
| 3 | 填写金额、日期、账户、交易对象 | - |
| 4 | 关联合同（可选） | - |
| 5 | 保存 | 交易出现在列表中，账户余额自动更新 |
| 6 | 修改对账状态下拉框 | 状态实时更新 |

**验证要点：**
- 收款（receipt）金额显示为绿色 `+`
- 付款/报销金额显示为红色 `-`
- 关联合同时，合同待付金额自动扣减

### 9.2 API 接口测试

```bash
# 创建账户
curl -X POST http://localhost:15085/api/v1/finance/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "<实体UUID>",
    "account_category": "public",
    "account_name": "公司基本户",
    "bank_name": "招商银行",
    "bank_branch": "深圳科技园支行",
    "currency": "CNY",
    "initial_balance": 500000.00
  }'

# 查看账户列表（含计算余额）
curl http://localhost:15085/api/v1/finance/accounts \
  -H "Authorization: Bearer $TOKEN"

# 更新账户
curl -X PATCH http://localhost:15085/api/v1/finance/accounts/<account_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"account_name": "更新后的名称"}'

# 创建收款交易
curl -X POST http://localhost:15085/api/v1/finance/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "our_entity_id": "<实体UUID>",
    "account_id": "<账户UUID>",
    "txn_type": "receipt",
    "txn_direction": "in",
    "amount": 30000.00,
    "txn_date": "2026-03-09",
    "counterparty_id": "<交易方UUID>",
    "contract_id": "<合同UUID>",
    "purpose": "首期款收款"
  }'

# 创建付款交易
curl -X POST http://localhost:15085/api/v1/finance/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "our_entity_id": "<实体UUID>",
    "account_id": "<账户UUID>",
    "txn_type": "payment",
    "txn_direction": "out",
    "amount": 5000.00,
    "txn_date": "2026-03-09",
    "purpose": "服务器费用"
  }'

# 查询交易列表
curl "http://localhost:15085/api/v1/finance/transactions?page=1&page_size=20" \
  -H "Authorization: Bearer $TOKEN"

# 按账户和方向过滤
curl "http://localhost:15085/api/v1/finance/transactions?account_id=<UUID>&txn_direction=in" \
  -H "Authorization: Bearer $TOKEN"

# 更新对账状态
curl -X PATCH http://localhost:15085/api/v1/finance/transactions/<txn_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reconcile_status": "reconciled"}'

# 创建发票
curl -X POST http://localhost:15085/api/v1/finance/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "our_entity_id": "<实体UUID>",
    "invoice_kind": "output",
    "invoice_medium": "electronic",
    "invoice_no": "INV-2026-001",
    "issue_date": "2026-03-09",
    "amount_with_tax": 30000.00,
    "related_contract_id": "<合同UUID>"
  }'

# 查询发票列表
curl "http://localhost:15085/api/v1/finance/invoices?invoice_kind=output" \
  -H "Authorization: Bearer $TOKEN"

# 创建报销单
curl -X POST http://localhost:15085/api/v1/finance/reimbursements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "our_entity_id": "<实体UUID>",
    "total_amount": 2500.00,
    "expense_lines": [
      {"description": "出差住宿", "amount": 1500.00},
      {"description": "出差交通", "amount": 1000.00}
    ]
  }'

# 查询报销列表（仅返回自己的）
curl "http://localhost:15085/api/v1/finance/reimbursements" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 10. AI 能力

### 10.1 前端手动测试

| 操作 | 预期结果 |
|------|---------|
| 在项目详情中使用 AI 生成功能清单 | 返回结构化的功能表（10 列） |
| 在合同管理中使用 AI 起草合同 | 流式返回 Markdown 格式的合同内容 |

### 10.2 API 接口测试

```bash
# AI 对话（非流式）
curl -X POST http://localhost:15085/api/v1/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "parts": ["帮我设计一个电商平台的功能清单"]}],
    "system_instruction": "你是一个产品经理，请输出JSON格式的功能清单"
  }'

# AI 对话（流式 SSE）
curl -X POST http://localhost:15085/api/v1/ai/chat-stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "parts": ["起草一份软件开发合同"]}]
  }'
```

> 需要在 `.env` 中配置 `GEMINI_API_KEY` 才能使用。

---

## 11. 权限体系测试

### 11.1 权限码一览

| 权限码 | 说明 | 控制范围 |
|--------|------|---------|
| `iam.read` | 查看用户管理 | 侧边栏显示 + 页面访问 + API 读取 |
| `iam.write` | 编辑用户管理 | 创建/修改/删除操作 |
| `todo.read` | 查看待办事项 | 侧边栏显示 + 页面访问 + API 读取 |
| `todo.write` | 编辑待办事项 | 创建/修改/状态变更 |
| `contract.read` | 查看合同管理 | 侧边栏显示 + 页面访问 + API 读取 |
| `contract.write` | 编辑合同管理 | 创建/修改合同 |
| `project.read` | 查看项目管理 | 侧边栏显示 + 页面访问 + API 读取 |
| `project.write` | 编辑项目管理 | 创建/修改项目 |
| `finance.read` | 查看财务管理 | 侧边栏显示 + 页面访问 + API 读取 |
| `finance.write` | 编辑财务管理 | 创建/修改财务记录 |

### 11.2 前端权限测试

| 测试用例 | 操作 | 预期结果 |
|---------|------|---------|
| 无权限用户看不到模块 | 用只有 `todo.read` 权限的账号登录 | 侧边栏只显示「工作台」和「待办事项」 |
| 无权限直接访问 URL | 在浏览器输入 `/finance/accounts` | 显示 403 无权限页面 |
| admin 看到所有模块 | 用 admin 登录 | 侧边栏显示全部 6 个模块 |
| 权限变更后生效 | 修改职位权限 → 用户重新登录 | 侧边栏和页面访问权限更新 |

### 11.3 API 权限测试

```bash
# 用无权限用户的 Token 访问需要权限的接口
curl http://localhost:15085/api/v1/iam/users \
  -H "Authorization: Bearer $NO_PERM_TOKEN"
# 预期：返回 403 {"code": 403, "message": "Missing permission: iam.read"}

# 无 Token 访问受保护接口
curl http://localhost:15085/api/v1/iam/users
# 预期：返回 401 {"code": 401, "message": "Not authenticated"}
```

---

## 12. 集成流程测试

### 12.1 完整项目流程（端到端）

```
1. 创建交易方（甲方、乙方）
   ↓
2. 创建合同，关联甲乙方，添加付款计划
   ↓
3. 创建项目，关联合同，设置项目经理
   ↓
4. 添加项目成员
   ↓
5. AI 生成功能清单
   ↓
6. 从功能清单生成开发任务
   ↓
7. 分配任务给团队成员
   ↓
8. 推进项目阶段
   ↓
9. 任务完成 → 审核 → 贝利结算
   ↓
10. 收到付款 → 创建收款交易 → 合同待付金额扣减
   ↓
11. 开具发票
   ↓
12. 下载验收报告
```

### 12.2 任务审批 + 贝利结算流程

```
1. 管理员创建贝利规则（提前3天+10，延迟2天-5）
   ↓
2. 创建一个有截止日期的任务，分配给员工
   ↓
3. 员工开始任务 → 提交完成
   ↓
4. 上级审核通过
   ↓
5. 验证：
   - 提前完成：员工贝利余额 +10
   - 按时完成：贝利不变
   - 延迟完成：员工贝利余额 -5
```

### 12.3 请假审批流程

```
1. 查看员工假期余额（如年假 5 天）
   ↓
2. 员工提交年假申请（1 天）
   ↓
3. 上级查看团队待审请假
   ↓
4. 上级审批通过
   ↓
5. 验证：员工年假余额从 5 → 4
   ↓
6. 测试驳回场景：余额不变
```

### 12.4 合同 → 交易 → 对账流程

```
1. 创建合同（总额 100,000）
   ↓
2. 查看合同待付金额 = 100,000
   ↓
3. 创建收款交易（30,000），关联该合同
   ↓
4. 查看合同待付金额 = 70,000
   ↓
5. 更新交易对账状态：未完成 → 已对账
   ↓
6. 创建发票，关联合同
```

---

## 附录：错误码参考

| HTTP 状态码 | 含义 | 常见场景 |
|------------|------|---------|
| 200 | 成功 | 所有正常操作 |
| 400 | 请求错误 | 缺少必填字段、格式错误、业务校验失败 |
| 401 | 未认证 | 未提供 Token、Token 过期 |
| 403 | 无权限 | 缺少所需权限、非 L0 执行 L0 操作 |
| 404 | 未找到 | 资源不存在 |
| 500 | 服务端错误 | 未预期的异常 |

---

## 附录：分页参数

大部分列表接口支持分页：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `page` | 1 | 页码，从 1 开始 |
| `page_size` | 20 | 每页条数 |
| 最大 page_size | 100（部分接口 200） | 超过自动截断 |

**响应格式：**
```json
{
  "items": [...],
  "total": 50,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

---

## 附录：文件上传限制

| 场景 | 最大大小 | 允许类型 |
|------|---------|---------|
| 身份证图片 | 10 MB | image/jpeg, image/png, image/webp |
| 简历 | 10 MB | application/pdf |
| 任务图片 | 10 MB | image/* |
| 项目附件 | 20 MB | 任意类型 |
| 阶段附件 | 20 MB | 任意类型 |

---

*最后更新：2026-03-09*
