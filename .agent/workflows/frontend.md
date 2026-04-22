# 前端与小程序架构

> 本文档描述 Web 前端和微信小程序的架构设计。属于 `project-index.md` 的子文档。

---

## 1. Web 前端

### 入口与路由

入口文件：`frontend/src/App.jsx`
- 使用 `BrowserRouter` + 嵌套路由
- 受保护路由通过 `ProtectedRoute` 和 `AuthProvider` 包裹

主要路由：

| 路由 | 页面 |
|------|------|
| `/login` | 登录页（`pages/auth/LoginPage`）- 含密码显示切换、详细错误提示、密码输入限制中文 |
| `/profile-setup` | 首次登录档案完善页（`pages/auth/ProfileSetupPage`）- 新密码/确认密码输入限制中文 |
| `/` | 仪表盘 |
| `/todo` | 任务管理（看板/列表双视图，看板已完成列懒加载折叠，列表分页） |
| `/iam/users` | 用户管理 |
| `/iam/entities` | 实体管理 |
| `/iam/departments` | 部门管理 |
| `/iam/job-titles` | 职位管理 |
| `/iam/beli-rules` | 积分规则 |
| `/iam/org-chart` | 组织架构图 |
| `/contract/list` | 合同列表 |
| `/contract/counterparties` | 对手方管理 |
| `/project` | 项目列表 |
| `/project/:id` | 项目详情 |
| `/project/:id/dev-progress` | 开发进度 |
| `/finance/accounts` | 账户管理 |
| `/finance/transactions` | 交易记录 |
| `/kb` | 企业大脑 - 文档列表 |
| `/kb/chat` | 企业大脑 - AI 对话（新对话） |
| `/kb/chat/:id` | 企业大脑 - AI 对话（历史对话） |
| `/kb/documents/:id` | 企业大脑 - 文档详情 |
| `/meeting` | 会议记录 - 会议列表 |
| `/meeting/:id` | 会议记录 - 会议详情/编辑 |

### 布局与状态

- 共享布局组件：`components/layout/*`
- 认证状态：`contexts/AuthContext`（React Context，非 Redux）
- 业务页面：`src/pages/{auth,dashboard,iam,contract,project,finance,todo,kb,meeting}`

### 共享组件

| 组件 | 路径 | 说明 |
|------|------|------|
| Bug 图片预览 | `components/common/BugImagePreview.jsx` | 缩略图 + 放大查看 |
| Bug 详情弹窗 | `components/common/BugDetailModal.jsx` | 全字段详情 + 图片画廊 |
| 任务图片预览 | `components/common/TodoImagePreview.jsx` | 任务附件预览 + 放大 |

### 企业大脑页面（`pages/kb/`）

| 页面/组件 | 说明 |
|-----------|------|
| `DocumentListPage.jsx` | 文档表格 + 标签筛选 + 上传按钮 |
| `DocumentDetailPage.jsx` | 元数据、标签、文本预览、下载 |
| `ChatPage.jsx` | 左侧对话列表 + 右侧聊天区（SSE 流式） |
| `components/UploadDocumentModal.jsx` | 拖拽上传文档弹窗 |

### 会议记录页面（`pages/meeting/`）

| 页面/组件 | 说明 |
|-----------|------|
| `MeetingListPage.jsx` | 会议表格 + 搜索框（标题/参会人）+ 会议日期列 + 参会人副文本 + 上传音频按钮 |
| `MeetingDetailPage.jsx` | 音频播放 + 文稿编辑 + 说话人映射 + 单条 speaker 下拉切换 + 预设/自定义提示词 + 引用上次会议 + AI 总结 + 参会人/日期显示 + 归档 |
| `components/UploadAudioModal.jsx` | 拖拽上传音频弹窗 + 会议日期选择（默认今天） |

### API 模块（`api/`）

| 文件 | 说明 |
|------|------|
| `kb.js` | 企业大脑 API（文档 CRUD、对话、搜索） |
| `meeting.js` | 会议记录 API（会议 CRUD、转写、总结、归档） |
| `changelog.js` | 版本更新日志 API（列表、创建、更新、删除） |

---

## 2. 微信小程序

### 页面结构

小程序目录：`miniprogram/`

| 页面路径 | 说明 |
|----------|------|
| `pages/login` | 登录 |
| `pages/home` | 首页 |
| `pages/todo` | 任务（含请假提交/审批） |
| `pages/project` | 项目列表 |
| `pages/project/detail` | 项目详情（概览/阶段/成员/任务标签页） |
| `pages/finance` | 财务概览 |
| `pages/mine` | 个人中心 |
| `pages/contract` | 合同 |
| `pages/iam` | 组织管理 |

### 设计原则

- 与 Web 端保持统一的视觉语言（亮色主题，白底深字）
- 用户可见标签使用中文，后端枚举值在 JS 逻辑层映射
- 响应式布局使用 `rpx` 单位
- 自定义 TabBar（`custom-tab-bar/*`），支持大字号标签

### 网络层与服务

- 请求封装：`utils/request.js`（Promise 包装 `wx.request()`）
- 会话管理：`utils/storage.js`
- 统一 Bearer Token 鉴权，401 自动跳转登录
- API 服务映射：`services/{auth,todo,project,finance,contract,iam}.js`

### 项目详情功能

- 阶段操作标签与 Web 一致（功能清单/报价单/AI 生成合同/原型确认单/开发进度/Bug 管理/验收报告）
- 阶段附件聚合 + 文件下载
- PM/owner 可添加/移除项目成员

### 任务页功能

- 个人/团队任务视图切换
- 请假提交、请假历史、经理审批

### v1.0.3 版本变更的页面/组件

| 页面/组件 | 变更说明 |
|-----------|----------|
| `pages/auth/LoginPage.jsx` | 密码输入限制中文字符 |
| `pages/auth/ProfileSetupPage.jsx` | 新密码/确认密码输入限制中文字符 |
| `pages/project/components/BugManagementModal.jsx` | Bug 管理重构：新增编辑按钮、配图增删改查、独立 agent_status 列、弹窗宽度 1500px、四维筛选（状态/Agent状态/开发人员/测试人员） |
| `pages/project/components/ProjectTasks.jsx` | Bug 任务类型标签显示"Bug"（红色） |
| `components/todo/TodoModal.jsx` | 日期选择器从 datetime-local 改为 date（仅选日期不选时间） |
| `pages/contract/CreateContractModal.jsx` | 新增合同状态编辑（编辑模式下显示状态下拉框） |
| `pages/contract/ContractListPage.jsx` | 金额字段添加 Number() 确保千分位格式正确 |
| `pages/finance/TransactionListPage.jsx` | 新增日期筛选器 + 导出 Excel 按钮 + 编辑按钮 + 金额 Number() 转换 |
| `pages/finance/CreateTransactionModal.jsx` | 支持编辑模式（接收 initialData） |
| `pages/finance/AccountListPage.jsx` | 余额 Number() 转换确保千分位显示 |
| `pages/dashboard/DashboardPage.jsx` | 新增版本更新日志区域（最近活动下方，下拉选择版本，L0 可编辑/删除） |

### v1.0.4 版本变更的页面/组件

| 页面/组件 | 变更说明 |
|-----------|----------|
| `pages/project/components/BugManagementModal.jsx` | Bug 编辑时同步更新 TodoItem 描述（重组实际结果/期望结果/复现步骤/备注）；link 中新增 notes 字段存储备注 |
| `pages/todo/TodoPage.jsx` | 团队任务显示逻辑改为"负责人非本人"；新增审核人过滤器（默认本人）；API 调用传递 reviewed_by_user_id 参数 |
| `pages/dashboard/DashboardPage.jsx` | 请假表单改为日期+半天选择器（上午/下午）；待审批统计增加 reviewed_by_user_id 过滤 |
| `components/todo/TodoModal.css` | max-width 统一为 800px |
| `components/todo/TodoDetailModal.css` | max-width 统一为 800px |
| `pages/wechat-notify/WeChatNotifyPage.css` | `.modal-content` 重命名为 `.wechat-modal-content`，修复全局样式污染 |
| `pages/wechat-notify/WeChatNotifyPage.jsx` | 同步更新弹窗类名引用 |

### v1.0.6 版本变更的页面/组件

| 页面/组件 | 变更说明 |
|-----------|----------|
| `pages/meeting/components/UploadAudioModal.jsx` | 改为纯创建会议弹窗（标题/类型/日期），去掉音频上传，创建后跳转详情页 |
| `pages/meeting/MeetingListPage.jsx` | 按钮从"上传音频"改为"创建会议"，创建成功后跳转详情页 |
| `pages/meeting/MeetingDetailPage.jsx` | 无音频时显示上传按钮+参会人员输入；AI 纪要区无音频也可见；提示词框加大 |
| `api/meeting.js` | createMeeting 不传文件；新增 uploadAudio、updateAttendees |

---

*最后更新：2026-04-22*
