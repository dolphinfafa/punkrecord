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

### 1.2 任务生命周期

标准流程：`pending -> in_progress -> submitted -> done`

其他状态流转：
- `blocked`：任务阻塞
- `rejected`：审核驳回
- `dismissed`：任务取消

AI Agent 工作流：
- `ai_fixing`：AI 正在修复
- `ai_fixed`：AI 已完成修复，等待人工审核

小程序支持"我的任务"和"团队任务"视图及对应操作按钮。

### 1.3 请假审批

1. 员工 A 提交请假申请
2. 系统自动创建待办任务：creator=A，assignee=A，reviewed_by=A 的上级，标题为 "A - 请假申请"，描述含请假类型/时间/原因，截止当天 23:59
3. 经理在待审批列表中审批/驳回（遍历 manager 链，不限于直属）
4. 审批/驳回时同步更新对应 TodoItem 状态（done/dismissed）
5. 批准后自动更新假期余额
4. 小程序 `pages/todo` 包含请假提交、历史记录、经理审批功能

### 1.4 项目执行

- 项目 -> 阶段 -> 任务 的层级结构
- 开发任务（"开发进度"）仅在用户手动触发同步时从功能清单同步
- 开发任务支持：手动创建/编辑/删除、批量分配、一键清空
- 项目任务删除/清空会级联清理关联的镜像任务
- Bug 管理支持打开详情视图和上传多张 Bug 截图
- Bug 创建只写入一条 Bug 任务记录（不创建额外镜像）
- Bug 列表视图不显示附件缩略图，图片仅在详情弹窗中展示
- Bug 管理包含"Agent 文档"面板，可一键复制自动生成的 AI Agent 操作手册
- AI Agent Bug 修复流程：Agent 通过状态 API 将 Bug 从 `ai_fixing` 推进到 `ai_fixed`

### 1.5 财务操作

- 通过财务接口跟踪账户和交易
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

### 1.7 会议记录

- 上传音频文件 → 后台异步调用豆包 ASR 转写（含说话人分离）
- 会议状态流转：`uploading → transcribing → transcribed → summarized → archived`（或 `failed`）
- 转写完成后可编辑文稿内容和说话人标注
- AI 生成会议纪要（SSE 流式）：会议概要、讨论要点、决策事项、待办事项
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
npm run dev        # 开发服务器
npm run build      # 构建
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
| `DB_NAME` | 开发: `punkrecord_dev`，生产: `punkrecord_deploy` |
| 驱动 | `pymysql`（已在 `requirements.txt`） |
| 连接池 | `pool_pre_ping=True`，`pool_recycle=3600` |

**注意事项**：
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
- **后端**：端口 15085（uvicorn, Python 3.11, conda env: punk）
- **前端**：端口 15173（Vite dev server）
- **数据库**：`punkrecord_dev`
- **启停**：`./dev.sh start|stop|restart|status`

### Deploy 环境（生产服务器）
- **后端**：端口 9086（uvicorn, Python 3.9, venv, pm2 守护）
- **前端**：Nginx serve `frontend/dist/`
- **数据库**：`punkrecord_deploy`
- **部署**：`git pull origin main` + `pm2 restart punkrecord-api` + 前端需构建 dist 后 rsync

### 端口分配（zheyang 用户专属范围 15000-19999）
| 服务 | 端口 |
|------|------|
| 后端 API | 15085 |
| 前端 Web | 15173 |
| NestJS API | 15030 |

---

*最后更新：2026-03-26*
