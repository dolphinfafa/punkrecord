# 业务流程与运行指南

> 本文档描述核心业务流程和项目运行命令。属于 `project-index.md` 的子文档。

---

## 1. 核心业务流程

### 1.1 认证流程

- 登录返回 Token + `profile_completed` + `must_change_password` 状态
- Web 前端通过 AuthContext 管理会话，请求头携带 Bearer Token
- 首次登录流程：
  1. 管理员创建员工账号（默认 `must_change_password=true`, `profile_completed=false`）
  2. 员工首次登录后被重定向到 `/profile-setup` 页面
  3. 填写个人档案（邮箱、手机号、生日、身份证号、家庭住址、毕业学校、学历）+ 上传身份证图片和简历 PDF + 设置新密码
  4. 完成后标记 `profile_completed=true`, `must_change_password=false`，进入系统
- 管理员可重置员工密码（默认重置为 `punkrecord123`，员工下次登录需修改）
- 小程序登录后持久化 Token，个人中心页可通过 `/auth/me` 回填用户信息
- **Agent Token**：用户在工作台"Agent 密钥"区域生成专用 Token（格式 `pat_xxx`），供 AI Agent 通过 `Authorization: Bearer pat_xxx` 调用 API。Token 可设有效期（30/90/180天/永久），支持删除。认证中间件自动识别 `pat_` 前缀并映射到用户。

### 1.2 任务生命周期

标准流程：`pending -> in_progress -> submitted -> done`

其他状态流转：
- `blocked`：任务阻塞
- `rejected`：审核驳回
- `dismissed`：任务取消

AI Agent 工作流（`link.agent_status` 字段，独立于 `todo.status`）：
- `ai_fixing`：AI 正在修复
- `ai_fixed`：AI 已完成修复，等待人工审核
- AI 只更新 `link.agent_status`，不改变 `todo.status`，两者完全解耦

小程序支持"我的任务"和"团队任务"视图及对应操作按钮。

**团队任务显示规则**：显示所有负责人不是当前用户的任务（`assignee_user_id != current_user`），支持按审核人过滤（`reviewed_by_user_id` 参数），默认过滤为当前用户。审核人匹配逻辑：显式设置的 `reviewed_by_user_id` 优先匹配；未设置时以 `creator_user_id` 作为隐含审核人。前端提供审核人下拉过滤器，可选"全部审核人"查看更广范围。

**任务图片**：创建/编辑待办和任务详情均支持截图后 Ctrl+V 粘贴图片、拖拽上传和本地选择。图片上传区采用缩略图横向展示 + `+` 号入口；点击 `+` 后弹出“粘贴或拖拽至这里上传”和“添加本地文件”两个操作。提交后后端在 `link.todo_images` 中返回规范化图片元数据，详情页可立即看到已上传图片并继续追加。MCP 客户端通过 `get_todo`/`list_todo_images` 可拿到图片下载 URL，也可用 `get_todo_image` 直接获取 base64 图片内容。

**微信通知与入站审批（v2.0.8）**：
- 微信通知绑定后，待办分配、提交审核、审批结果等事件会通过 weixin-msg-service 推送；通道失效或服务不可达时，通知进入 `wechat_pending_notification` 离线队列。
- 用户在微信里发送任意消息会记录最近来信时间，并立即 force flush 该用户积压的离线通知。
- 用户发送“待办/审批/审核”等短指令时，系统查询真实待审批任务并逐条推送，每条带编号和单号；进行中的个人待办只返回数量。
- 用户可回复“通过 1”“拒绝 2 理由:xxx”“全部通过”“全部拒绝 理由:xxx”等指令完成审批；关联请假单的待办会同步审批/驳回请假申请。
- 非指令消息走 LiteLLM 兜底对话，但系统会注入真实待办/审批数量，并要求无法确认具体事项时引导用户发送“待办”，避免编造任务内容。
- 后台 retry worker 每轮补发到期队列，同时根据 `last_inbound_at` 判断微信 context token 是否接近 24 小时失效；距过期不足 1 小时且本周期未提醒过时发送一次保活提醒。

### 1.3 请假审批

1. 员工 A 提交请假申请（选择开始日期+上午/下午、结束日期+上午/下午）
2. 系统基于工作时间计算请假天数（精度 0.5 天）
   - 工作时间：周一至周五，上午 10:00-12:00，下午 14:00-19:00
   - 上午半天 = 0.5 天，下午半天 = 0.5 天，全天 = 1.0 天
   - 自动跳过周末，仅计算工作日
3. 系统自动创建待办任务：creator=A，assignee=A，reviewed_by=A 的上级，标题为 "A - 请假申请"，描述含请假类型/时间（含上午/下午）/天数/原因，截止当天 23:59
4. 经理在待审批列表中审批/驳回（遍历 manager 链，不限于直属）
5. 审批/驳回时同步更新对应 TodoItem 状态（done/dismissed）
6. 批准后按计算天数扣减假期余额（支持 0.5 天扣减）
7. 小程序 `pages/todo` 包含请假提交、历史记录、经理审批功能

### 1.4 项目执行

- 项目 -> 阶段 -> 任务 的层级结构
- 开发任务（"开发进度"）仅在用户手动触发同步时从功能清单同步
- 开发任务支持：手动创建/编辑/删除、批量分配、一键清空
- 项目任务删除/清空会级联清理关联的镜像任务
- Bug 管理支持打开详情视图和上传多张 Bug 截图，配图可点击选择、拖拽或截图后直接粘贴
- Bug 创建只写入一条 Bug 任务记录（不创建额外镜像）
- Bug 列表视图不显示附件缩略图，图片仅在详情弹窗中展示
- Bug 管理包含"Agent 文档"面板，可一键复制自动生成的 AI Agent 操作手册
- MCP 客户端读取 Bug 时，`link.bug_images` 会附带项目附件下载 URL；无法直接 HTTP 下载时可调用 `get_bug_image(project_id, attachment_id)` 获取 base64 图片内容
- AI Agent Bug 修复流程：Agent 通过 PATCH `/api/v1/todo/{todo_id}` 更新 `link.agent_status`（`ai_fixing` → `ai_fixed`），不改变 `todo.status`。`status` 和 `agent_status` 完全独立
- Bug 列表支持编辑（预填所有字段）、配图增删改查（单张删除/撤销、继续添加）
- Bug 编辑时自动同步更新关联 TodoItem 的描述（重新组合实际结果/期望结果/复现步骤/备注）
- Bug 的备注存储在 `link.notes` 字段，编辑时正确回填到备注输入框
- Bug 管理弹窗宽度 1500px，支持按状态/Agent状态/开发人员/测试人员四维筛选

### 1.5 财务操作

- 通过财务接口跟踪账户和交易
- 交易记录支持全字段编辑，编辑后自动重算关联合同的 pending_amount（考虑已付款金额）
- 交易列表支持按日期范围和状态筛选（date_from / date_to / status；status 支持 unreconciled / completed / reconciled / voided）
- 交易可作废/恢复；作废后仍展示但不计入账户余额，并同步回退关联合同的待收/待付金额
- 已作废交易可永久删除；正常交易必须先作废再删除，避免误删有效流水
- 交易列表支持导出 Excel（含日期与状态筛选条件，作废交易状态列显示“作废”）
- 金额字段统一使用 Number() 转换确保千分位格式正确（账户余额、合同金额、交易金额）
- 报销和发票是独立但关联的工作流

### 1.6 企业大脑（知识库）

- 上传文档（PDF/Word/Excel/TXT/图片）→ 后台异步处理管线：
  1. 文本提取（PyPDF2/python-docx/openpyxl/Gemini Vision）
  2. 文本切片（可配置大小和重叠）
  3. Embedding 向量化（Gemini text-embedding-004）
  4. 存入 ChromaDB 向量数据库
  5. AI 自动生成摘要和分类标签
- 文档状态流转：`processing → ready`（或 `failed`）
- RAG 对话：用户提问 → Embedding 检索相关文档片段 → 拼接上下文 → Gemini 流式回答
- 语义搜索：直接搜索知识库中的相关内容
- 会议记录归档后自动进入知识库处理管线

### 1.7 合同管理补充

- 合同编辑支持修改 status 字段（编辑模式下显示状态下拉框）
- 编辑 amount_total 时自动重算 pending_amount（扣除已付款金额）
- 合同支持多个附件（PDF/图片）：合同列表可查看附件数量并打开附件管理弹窗；附件支持上传、查看/下载和删除，图片类附件可截图后直接粘贴，文件元数据保存在 `contract.attachments` JSON，实际文件存储在 `contract-attachments`。

### 1.8 版本更新日志

- 首页工作台"最近活动"下方新增"版本更新日志"区域
- 用户可下拉选择版本查看日志详情（Markdown 渲染）
- L0 级别员工（无上级）可创建、编辑、删除日志条目
- 日志包含版本号、标题、内容（Markdown）、发布人、发布时间
- 后端 ChangeLog 模型存储在 shared.py，API 路由前缀 `/api/v1/changelog`

### 1.9 会议记录

- 上传音频文件 → 后台异步调用豆包 ASR 转写（含说话人分离）
- **无音频创建**：可仅通过标题/类型/日期创建会议记录，进入详情页后上传 Word/PDF 文稿或直接编辑转写稿，AI 可基于转写稿生成纪要；也可后续补传音频触发 ASR 转录。参会人员不再手动维护，由转写稿中实际使用的说话人自动同步。
- **文稿导入**：创建会议时可选择上传已识别好的 Word `.docx` 或 PDF 文稿；会议详情页也可上传/替换文稿。后端解析 `讲话人1：内容`、`Speaker 1: 内容`、`张三：内容`、可选时间码格式，以及 `讲话人1  00:20` 后下一行跟正文的录音文稿格式为转写分段，自动更新说话人映射与参会人员，清空旧纪要并进入 `transcribed` 状态。已归档会议不能替换文稿。
- **大文件/长音频自动切片**：音频会统一归一化为 16k 单声道 mp3；音频 > 300MB 或时长 > 45 分钟时自动用 ffmpeg 精确切片，切片间保留 12 秒重叠并在合并时按时间+文本相似度去重，减少边界漏识别和转录时间轴错位
  - 切片说话人 ID 带 chunk 前缀：`chunk1_speaker_0`、`chunk2_speaker_0`
  - 时间戳自动加回原音频偏移，segment_index 按开始时间全局递增
  - 单片文件不加前缀，保持向后兼容
  - 用户手动将不同 chunk 的说话人改为同一名字 → AI 纪要自动视为同一人
- ASR 后处理会平滑局部孤立的超短说话人分段，降低会议任务安排中短句被误分成新 speaker 的概率。
- 会议详情页支持“重新转写”：已有音频可再次触发 ASR，新结果成功后才替换旧转写；若 ASR 失败，旧分段保留。
- 当前豆包 ASR 对低声、远场或快速语速内容仍可能原始漏识别；代码层面已避免切片/格式导致的漏字，但无法从单一 ASR 返回中恢复完全未识别的句子，必要时需人工校正或接入备用 ASR。
- 每片 ASR 超时 20 分钟，ASR 返回 0 segments 时标记为 `failed`（而非 `transcribed`）
- 会议状态流转：`uploading → transcribing → transcribed → summarized → archived`（或 `failed`）
- 转写完成后可编辑文稿内容和说话人标注；v2.0.7 起支持新增讲话人、插入/删除转写行、切换 speaker，并通过完整分段列表保存。保存后后端按分段顺序收集实际使用的 `speaker_id`，结合 `speaker_mapping` 自动重算参会人员。
- AI 生成会议纪要（SSE 流式）：会议概要、讨论要点、决策事项、待办事项；v2.0.8 起请求上下文会包含会议标题、会议日期、参会人员和转写文稿，模型应使用 `meeting_date` 作为会议时间/日期依据，避免输出“时间未注明”
- 提示词预设与自定义提示词：选择预设会**追加**预设文案到自定义框已有内容之后（两部分共存，提交时合并为 `prompt`），切换预设自动剥离上一次追加段以避免累积
- 归档到企业大脑：将转写文稿 + 纪要存为知识库文档，自动进入处理管线

---

## 2. 运行命令

### 后端（在 `backend/` 目录下）

```bash
# 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 15085

# 数据库迁移
alembic upgrade head

# 创建管理员
python create_admin.py

# 初始化数据库
python init_database.py

# 运行测试
pytest -q tests/test_health.py
pytest -q tests/test_project_workflow.py
```

### 前端（在 `frontend/` 目录下）

```bash
VITE_BASE=/punkrecord/ npm run dev  # 开发服务器（开发访问 /punkrecord/）
VITE_BASE=/ npm run build  # 生产根域名构建；子路径部署可覆盖 VITE_BASE
npm run build              # 本地/默认构建
npm run lint       # 代码检查
npm run preview    # 预览构建结果
```

### 小程序（在 `miniprogram/` 目录下）

```
在微信开发者工具中导入该目录：
- 项目路径：<仓库根目录>/miniprogram
- 使用你的微信小程序 AppID
```

**编译注意事项**：如果开发者工具报基础库版本找不到（如 `2.31.0`），修改 `miniprogram/project.private.config.json` 中的 `libVersion` 为可用版本（项目基线：`3.6.3`），清除缓存后重新编译。

### 健康检查

```bash
curl http://localhost:15085/health
```

---

## 3. Python 环境策略

### 环境要求

| 系统 | 工具 | 环境名 |
|------|------|--------|
| macOS | pyenv | punkrecord |
| Windows/Linux | conda | punkrecord |

### 使用规则

1. 先检测操作系统
2. 在执行任何 Python 命令前先激活环境
3. 绝不在 `punkrecord` 环境外运行项目的 Python 命令

### 激活命令

```bash
# macOS
pyenv activate punkrecord

# Windows / Linux
conda activate punkrecord
# 如果 shell 未初始化 conda：
eval "$(conda shell.bash hook 2>/dev/null)" && conda activate punkrecord
```

---

## 4. 数据库配置

项目已从 SQLite 迁移到 **MySQL 8.0**。

| 配置项 | 值 |
|--------|-----|
| `DB_TYPE` | `mysql` |
| `DB_HOST` | 见 `backend/.env` |
| `DB_PORT` | 见 `backend/.env` |
| `DB_NAME` | 本地开发: `punkrecord_local`，远程开发: `punkrecord_dev`，生产: `punkrecord_deploy` |
| 驱动 | `pymysql`（已在 `requirements.txt`） |
| 连接池 | `pool_pre_ping=True`，`pool_recycle=3600` |

### 数据库环境说明

| 环境 | 库名 | 主机 | 端口 | 用途 |
|------|------|------|------|------|
| 本地开发 | `punkrecord_local` | `127.0.0.1` | `3306` | 日常开发，`.env` 默认连接此库 |
| 远程开发 | `punkrecord_dev` | `14.103.133.34` | `13306` | 共享开发数据（已停止直连） |
| 生产 | `punkrecord_deploy` | `14.103.133.34` | `13306` | 生产环境 |

**注意事项**：
- 开发时使用本地数据库 `punkrecord_local`（用户: `punkrecord`，密码: `punkrecord123`），不再直连远程 `punkrecord_dev`
- User 模型表名为 `users`（`user` 是 MySQL 保留字），所有 `foreign_key` 引用已同步更新
- 旧的 SQLite 专用启动迁移代码（`_ensure_user_profile_columns`）已删除
- 测试仍使用 SQLite 内存数据库（`tests/test_project_workflow.py`），不影响生产

## 5. 后端运行时安全默认值

- 启动时默认**不再**自动应用数据库变更
- 仅在需要时显式启用以下环境变量：
  - `AUTO_CREATE_TABLES_ON_STARTUP`（首次部署 MySQL 时需设为 `true`）
  - `AUTO_RUN_MIGRATIONS_ON_STARTUP`
- RBAC 权限执行支持分阶段上线：
  - `ENFORCE_RBAC`（默认关闭，保持兼容）

---

## 6. 部署环境

### Dev 环境（开发服务器）
- **后端**：端口 15085（uvicorn, Python 3.11, conda env: punkrecord）
- **前端**：端口 15173（Vite dev server）
- **数据库**：`punkrecord_local`（本地 MySQL 3306）
- **启停**：`./dev.sh start|stop|restart|status`；`dev.sh` 前端显式设置 `VITE_BASE=/punkrecord/`，且 `App.jsx` 会在访问 `/punkrecord/` 时自动使用 `/punkrecord` basename，避免子路径白屏

### Deploy 环境（生产服务器）
- **后端**：端口 9086（uvicorn, Python 3.10+, venv/conda, pm2 守护）
- **前端**：Nginx serve `frontend/dist/`
- **数据库**：`punkrecord_deploy`
- **部署**：`git pull origin main` + `pm2 restart punkrecord-api` + 前端用 `VITE_BASE=/ npm run build` 构建 `dist`

### 端口分配（zheyang 用户专属范围 15000-19999）
| 服务 | 端口 |
|------|------|
| 后端 API | 15085 |
| 前端 Web | 15173 |
| NestJS API | 15030 |

---

*最后更新：2026-08-31*
