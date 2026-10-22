# 业务流程与运行指南

> 本文档描述核心业务流程和项目运行命令。属于 `project-index.md` 的子文档。

---

## 1. 核心业务流程

### 2.1.0 版本整理（2026-10-22）

- 当前版本2.1.0，汇总10月16日至22日开发改动；仅开发验证和GitHub同步，不代表生产部署。升级说明见 `updates/2.1.0.md`，迁移头为 `20261021_0001`；本次待办详情修复无新增迁移。
- 待办详情总是展示描述和备注，空值显示空态；普通编辑发送空串清空，省略/null保留原值。Bug备注优先顶层 `notes`，旧记录从 `link.notes` 补齐响应，显式清空不复活旧备注。
- ASR应用及访问凭证不再内置于配置或示例，必须由被Git忽略的环境文件提供；Python仍仅使用Conda `punkrecord`。

### 2026-10-22 开发反馈修复

- 阶段备注失焦保存后使用服务端回传值，不将未清理的首尾空白继续显示为已保存；纯空白422时恢复原备注并显示字段错误。空串可清空，省略/null不改已有值。
- Bug页面与贝利、请假、会议复用分页，每页30项；搜索/筛选重置页码，翻页保留其他URL参数和浏览器历史。
- 任务长英文与项目长名称完整断行显示，不以截断或隐藏代替修复；阶段表格仅在内部滚动。该批无数据库变更，现纳入2.1.0，仅开发环境。

### 2026-10-16 开发环境新流程

该轮开发时版本为2.0.9，现纳入2.1.0，尚未部署生产。

- Bug改为项目独立页面，标题模糊查询覆盖当前项目所有端；项目任务与待办使用同一条记录，重复同步不重建。
- 所有新任务截止日期必填，预计小时数默认 0；历史缺少截止日期的任务提交前补录，空工时不阻止完成。最终提交时间用于奖励延期计算，不使用经理审核等待时间。
- 待办卡片按预计工时区分：正数为绿色“贝利任务”，0/空工时为普通卡片；看板、列表、我的/团队及小程序一致。标识不代表已发奖，发放仍取决于人员资格和独立审核。
- 请假申请、审批、通知和微信审批直接操作请假单，不再创建或更新Todo。节假日/调休日历与请假天数计算共用。
- 正数工时的任务验收完成后才创建独立贝利审核，包含员工自建任务。0 工时任务正常完成但不入队；规则生效后完成的任务补录正数工时自动入队，历史已完成任务不追溯。未发奖的任务归零时退出审核并保留记录，恢复正数则回到待审核；已发奖仍需先重开冲销。L0可在奖励审核中修改正数工时、日期、重要级并同步任务；批准后结算。工资由管理员在员工管理补录，贝利页面不展示工资或换算参数。
- 内部结算：基本月工资/1000×2.5×预计小时数×重要级系数×延期系数，两位小数四舍五入。P0/P1/P2/P3对应1.2/1/1/0.8；延期0/1/2/3/4/5天及以上对应1/.95/.9/.8/.6/.5。延期按上海自然日计算，不按审核等待时间计算。
- 缺席早会：启用日之后、有早会记录的工作日，非L0在职员工应到；2026-10-21 起优先说话人绑定的员工 ID，同日取并集。旧记录先唯一用户名、再唯一姓名匹配，同名不猜测；外部/未知姓名不进入员工名单。上午已批请假豁免，缺席自动扣500；允许负数，L0可填写原因永久作废当日扣款。启用日前显示说明，不补扣。
- 未来日期记录与失败结算由5分钟周期后台任务补处理。名单纠正、补批请假、删除会议、日历调整进行差额冲正，不重复扣款。
- 员工首次结算时保存姓名与当天应到身份；以后更名、停用或升为L0不改变既有考勤。绑定员工 ID 的会议不受改名影响；未绑定的旧姓名按当天快照兼容匹配。
- 商城所有兑换需L0审批：申请冻结贝利/库存，通过才扣款；假期到账，实物待发货；驳回/取消释放冻结，未发货实物可退款。
- 开发迁移前执行本地备份脚本 `backend/scripts/upgrade_beli_dev.py`，脚本拒绝生产标记和非本机数据库；迁移后按 `.agent/test/README.md` 验收。

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

标准流程：`open -> in_progress -> pending_review -> done`；自建自执行任务可直接完成。正数工时任务仍需独立贝利审核，0 工时不参与奖励。

其他状态流转：
- `blocked`：任务阻塞
- 审核驳回：回到 `open`，保留审核意见
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
- 用户可回复“通过 1”“拒绝 2 理由:xxx”“全部通过”“全部拒绝 理由:xxx”等指令完成审批；待审批列表合并普通任务与独立请假单，请假标识为 `leave:<uuid>`，分别调用对应审批接口。
- 非指令消息走 LiteLLM 兜底对话，但系统会注入真实待办/审批数量，并要求无法确认具体事项时引导用户发送“待办”，避免编造任务内容。
- 后台 retry worker 每轮补发到期队列，同时根据 `last_inbound_at` 判断微信 context token 是否接近 24 小时失效；距过期不足 1 小时且本周期未提醒过时发送一次保活提醒。

### 1.3 请假审批

1. 员工 A 提交请假申请（选择开始日期+上午/下午、结束日期+上午/下午）
2. 系统基于工作时间计算请假天数（精度 0.5 天）
   - 工作时间：周一至周五，上午 10:00-12:00，下午 14:00-19:00
   - 上午半天 = 0.5 天，下午半天 = 0.5 天，全天 = 1.0 天
   - 默认跳过周末，按贝利页面维护的节假日/调休覆盖日历计算
3. 仅创建 `LeaveRequest`，独立通知直属主管，不生成待办
4. 经理在独立请假列表中审批/驳回（遍历 manager 链，不限于直属）
5. 不改动任何 TodoItem；历史请假待办隐藏并禁止状态操作
6. 批准后按计算天数扣减假期余额，写入独立流水；补批上午请假同时重算当天早会扣款
7. 小程序 `pages/todo` 包含请假提交、历史记录、经理审批功能

### 1.4 项目执行

- 项目 -> 阶段 -> 任务 的层级结构
- 开发任务（"开发进度"）仅在用户手动触发同步时从功能清单同步
- 开发任务支持：手动创建/编辑/删除、批量分配、一键清空
- 项目任务与普通待办共享同一条 TodoItem，不再新建镜像；有已发奖励的任务必须先重开冲销才能删除
- Bug 管理支持打开详情视图和上传多张 Bug 截图，配图可点击选择、拖拽或截图后直接粘贴
- Bug 创建只写入一条 Bug 任务记录（不创建额外镜像）
- Bug 列表视图不显示附件缩略图，图片仅在详情弹窗中展示
- Bug 管理包含"Agent 文档"面板，可一键复制自动生成的 AI Agent 操作手册
- MCP 客户端读取 Bug 时，`link.bug_images` 会附带项目附件下载 URL；无法直接 HTTP 下载时可调用 `get_bug_image(project_id, attachment_id)` 获取 base64 图片内容
- AI Agent Bug 修复流程：Agent 通过 PATCH `/api/v1/todo/{todo_id}` 更新 `link.agent_status`（`ai_fixing` → `ai_fixed`），不改变 `todo.status`。`status` 和 `agent_status` 完全独立
- Bug 列表支持编辑（预填所有字段）、配图增删改查（单张删除/撤销、继续添加）
- Bug 编辑时自动同步更新关联 TodoItem 的描述（重新组合实际结果/期望结果/复现步骤/备注）
- Bug备注同步存储在顶层 `notes` 和兼容字段 `link.notes`；回填优先顶层，旧记录响应兼容读取 `link.notes`，显式空串清空后不再回退旧内容
- Bug 管理为 `/project/:id/bugs` 独立页面，支持当前项目跨端标题子串搜索、分页及状态/Agent状态/开发人员/测试人员筛选；条件保存在URL，支持刷新及浏览器返回/前进

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
- **导入事务与模板**（2026-10-21）：创建会议时文稿随同一次请求提交，解析失败不创建会议，事务失败不保留分段或考勤扣款；已有会议替换失败保留原文稿。弹窗可下载 DOCX 模板，清理说话人标签/整行的包装引号，不改正文中的合法撇号。
- **员工绑定**（2026-10-21）：姓名下拉可按姓名/用户名搜索公司员工，显示“姓名（用户名）”，选择后保存稳定 ID；外部姓名明确未绑定，不纳入员工考勤。旧客户端保留未改名绑定；文稿替换成功使用新文稿姓名并清空员工绑定，ASR 成功同时清空旧姓名和员工绑定，需重新确认。失败保留原分段与映射，不能复用新说话人的旧身份。
- **文稿时间**：保留原始时间码；无起点时从上一段结尾顺延，无有效终点时按文本长度估算。分段时间不是空值，也不是音频对齐承诺；无音频且无原始时间码的文稿不生成会议总时长。
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
- AI 生成会议纪要（SSE 流式）：会议概要、讨论要点、决策事项、待办事项；请求上下文包含会议标题、会议日期、参会人员和转写文稿，模型应使用 `meeting_date` 作为会议时间/日期依据，避免输出“时间未注明”；当前默认模型为 `gpt-5.6-sol`
- 提示词预设与自定义提示词：选择预设会**追加**预设文案到自定义框已有内容之后（两部分共存，提交时合并为 `prompt`），切换预设自动剥离上一次追加段以避免累积
- 归档到企业大脑：将转写文稿 + 纪要存为知识库文档，自动进入处理管线

---

## 2. 运行命令

### 后端（在 `backend/` 目录下）

```bash
# 核实解释器，以下 Python 命令均使用 Conda punkrecord 环境
/opt/miniconda3/envs/punkrecord/bin/python -c 'import sys; print(sys.executable)'

# 启动开发服务器
/opt/miniconda3/envs/punkrecord/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 15085

# 开发库迁移：先备份，脚本校验本机数据库与开发环境
/opt/miniconda3/envs/punkrecord/bin/python scripts/upgrade_beli_dev.py

# 创建管理员
/opt/miniconda3/envs/punkrecord/bin/python create_admin.py

# 初始化数据库
/opt/miniconda3/envs/punkrecord/bin/python init_database.py

# 运行测试
/opt/miniconda3/envs/punkrecord/bin/python -m pytest -q tests/test_health.py
/opt/miniconda3/envs/punkrecord/bin/python -m pytest -q tests/test_project_workflow.py
```

2026-10-21 开发库已迁移至 `20261021_0001`，仅新增会议员工绑定列；本次文档复核不再次执行迁移。完整测试与隔离要求见 [测试指引](../test/README.md)，生产环境不得直接照搬上述开发库命令。

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

| 环境 | 工具 | 环境名 | Python |
|------|------|--------|--------|
| 开发服务器 | Conda | `punkrecord` | 3.10.0 |

### 使用规则

1. 在执行任何 Python 命令前确认解释器属于 `punkrecord` 环境。
2. 非交互命令优先使用绝对路径 `/opt/miniconda3/envs/punkrecord/bin/python`。
3. PM2 后端进程必须直接使用该解释器，禁止使用 PATH 中不确定来源的 `uvicorn`。
4. `scripts/start_backend.sh` 和 `dev.sh` 均固定使用该解释器。

### 激活命令

```bash
conda activate punkrecord

# Agent/PM2/脚本推荐
/opt/miniconda3/envs/punkrecord/bin/python --version
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
| 远程开发 | `punkrecord_dev` | 见对应环境 `.env` | 见对应环境 `.env` | 共享开发数据（已停止直连） |
| 生产 | `punkrecord_deploy` | 见生产 `.env` | 见生产 `.env` | 生产环境 |

**注意事项**：
- 开发时使用本地数据库 `punkrecord_local`，连接账号和密码只保存在 `backend/.env`，不再直连远程 `punkrecord_dev`
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
- **后端**：端口 15085（Uvicorn，Conda `punkrecord`，Python 3.10.0）
- **前端**：端口 15173（Vite dev server）
- **数据库**：`punkrecord_local`（本地 MySQL 3306）
- **启停**：`./dev.sh start|stop|restart|status`；PM2 后端必须以 `/opt/miniconda3/envs/punkrecord/bin/python -m uvicorn ...` 启动。`dev.sh` 前端显式设置 `VITE_BASE=/punkrecord/`，且 `App.jsx` 会在访问 `/punkrecord/` 时自动使用 `/punkrecord` basename，避免子路径白屏

**PM2 管理与停服恢复（2026-10-15）**：

- 开发服务器已配置并启用 systemd 单元 `pm2-zheyang.service`，启动时恢复 `/home/zheyang/.pm2/dump.pm2` 中保存的前后端进程。
- 已由 PM2 管理的服务使用 `pm2 restart punkrecord-backend` / `pm2 restart punkrecord-frontend`，不要与 `dev.sh` 启停混用。
- 调整 PM2 进程配置后执行 `pm2 save`；保存配置本身不会自动配置开机启动。
- 页面无法访问时，先检查 `systemctl status pm2-zheyang.service`、`pm2 list` 和两个端口是否监听，再检查认证逻辑。
- systemd 服务停止时执行 `sudo systemctl start pm2-zheyang.service`；重启该单元会短暂停止当前用户的两个项目进程。
- 验证应覆盖后端 `/health`、前端 `/punkrecord/`、经 Vite 代理登录及 `/auth/me`。

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

*最后更新：2026-10-22*
