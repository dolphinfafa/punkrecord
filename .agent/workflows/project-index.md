---
description: PunkRecord 项目索引大纲。执行任何任务前先阅读此文件，按需查阅子文档。
---

# 项目索引

本文件是项目的行动纲领和导航入口。Agent 执行任何任务前必须先阅读本文件，再按需阅读对应子文档。

### 强制行动规则

1. 修改文件前，先用 3 个要点说明目标、改动范围和验证方式。
2. Python 命令必须使用 Conda `punkrecord` 环境；开发服务器优先直接调用 `/opt/miniconda3/envs/punkrecord/bin/python`。
3. 未经测试、构建、接口检查或日志验证，不得报告“完成”。
4. 命令失败时先阅读错误和日志、分析根因，再做最小修复，禁止盲目重试。
5. 优先复用现有模块和成熟方案，保持实现简单，不做无关重构，不引入未经用户确认的新依赖。
6. IP、API key、Token、密码等敏感信息只能保存在被 `.gitignore` 排除的 `.env` 中，不得进入代码、文档、日志或 Git。
7. `.agent/workflows/` 用于维护项目现状；`milestone/YYYY-MM-DD.md` 用于记录每日工作进展。
8. 每次更新必须同步 `.agent/test/` 中相关用例，并执行对应测试；测试入口和隔离要求见 `.agent/test/README.md`。
9. `test_result/` 是本地私有反馈目录，整体被 Git 忽略；不得强制添加原文、截图或其他反馈附件。自动化仅使用合成数据。

### 身份与沟通

- **Role**：首席工程师兼高级数据科学家
- **Voice**：专业、简洁、结果导向
- **Authority**：用户是总架构师，立即执行明确指令；仅在缺少必要信息、权限或存在不可逆风险时说明阻塞点

---

## 1. 仓库结构

```text
punkrecord/
|- backend/                 # FastAPI 后端服务
|  |- app/
|  |  |- api/               # 路由模块（auth, iam, todo, beli, contract, project, finance, ai, kb, meeting, changelog）
|  |  |- core/              # 配置、数据库、认证、响应、异常处理、文件存储
|  |  |- models/            # SQLModel ORM 模型
|  |  |- schemas/           # Pydantic 请求/响应 Schema
|  |  |- services/          # 业务服务（导出、AI、文档解析、Embedding、RAG、ASR）
|  |  `- utils/
|  |- db_migrations/        # Alembic 数据库迁移
|  |- tests/
|  |- create_admin.py       # 创建管理员脚本
|  |- init_database.py      # 初始化数据库脚本
|  |- requirements.txt
|  `- app/main.py           # FastAPI 应用入口
|- frontend/                # React Web 前端
|  `- src/
|     |- api/               # API 请求封装
|     |- components/        # 共享组件（common/, layout/, todo/）
|     |- contexts/          # AuthContext 认证状态
|     |- hooks/
|     |- pages/             # 按业务域划分的页面
|     `- utils/
|- miniprogram/             # 微信小程序客户端
|  |- pages/                # 小程序页面
|  |- custom-tab-bar/       # 自定义底部导航栏
|  |- services/             # API 服务封装
|  `- utils/                # 请求/会话工具
|- milestone/               # 里程碑工作记录
|- .agent/test/              # Agent 测试指引、回归用例
|- prd/                     # 产品需求文档
`- .agent/workflows/        # Agent 工作流文档（本目录）
```

---

## 2. 子文档索引

执行任务时，根据需要阅读对应的子文档：

| 文档 | 内容 | 何时阅读 |
|------|------|----------|
| [`backend-api.md`](backend-api.md) | 后端架构、路由模块、全部 API 接口清单 | 涉及后端代码或 API 调用时 |
| [`data-models.md`](data-models.md) | 数据模型文件、模型分组和字段概览 | 涉及数据库、模型变更时 |
| [`frontend.md`](frontend.md) | Web 前端路由/组件 + 微信小程序页面/架构 | 涉及前端或小程序代码时 |
| [`workflows.md`](workflows.md) | 核心业务流程、运行命令、环境配置 | 需要了解业务逻辑或运行项目时 |
| [`conventions.md`](conventions.md) | 命名规范、接口约定、变更安全守则 | 编写代码或提交变更时 |
| [`project-overview.md`](project-overview.md) | 项目技术全景（技术选型、架构详解、数据库设计、认证权限） | 需要深入理解项目设计时 |

---

## 3. 关键信息速查

- **后端端口**：15085（`uvicorn --port 15085`）
- **前端端口**：15173（Vite 将 `/punkrecord/api` 代理到 `localhost:15085`）
- **NestJS API 端口**：15030
- **API 前缀**：所有接口在 `/api/v1` 下
- **认证方式**：JWT Bearer Token（HS256，24 小时有效）
- **权限模型**：双通道 RBAC（角色权限 + 职位权限，取并集）
- **数据库**：MySQL 8.0，驱动 `pymysql`（连接信息见 `backend/.env`）
- **Python 环境**：Conda 环境 `punkrecord`，开发服务器解释器 `/opt/miniconda3/envs/punkrecord/bin/python`（Python 3.10.0）
- **开发服务守护**：`pm2-zheyang.service` 负责当前用户 PM2 的开机恢复；进程为 `punkrecord-backend` 和 `punkrecord-frontend`。调整进程后执行 `pm2 save`。
- **RBAC 状态**：`ENFORCE_RBAC=True`，已正式启用前后端双层权限控制
- **当前版本（2026-10-22）**：2.1.0，版本说明见 [2.1.0](../../updates/2.1.0.md)；包含下述开发升级和反馈修复，仅开发环境验证，生产部署须另行授权。MCP保持43个工具，迁移头为 `20261021_0001`。
- **开发中业务升级（2026-10-16）**：任务截止日期必填，预计工时默认 0，正数工时且验收完成才进入独立贝利审核；贝利、考勤、商城在 `/beli`，请假独立入口 `/leave`；现纳入2.1.0，未发布生产。
- **文档核对（2026-10-22）**：工作流、测试用例与每日记录已对照当前开发代码核查；MCP 当前为 43 个工具。最新结果见 [当日工作记录](../../milestone/2026-10-22.md)、[测试报告](../test/report-2026-10-22.md)，测试入口见 [测试指引](../test/README.md)；历史报告保留，GitHub 同步不等于生产发布。
- **开发反馈修复（2026-10-21）**：普通文本按字段归一化；会议创建支持文稿原子导入、模板下载、说话人员工 ID 绑定；考勤兼容旧用户名/唯一姓名但优先 ID。新增迁移 `20261021_0001`，不批量重算历史余额，启用日前不补扣；现纳入2.1.0。
- **第三轮反馈修复（2026-10-22）**：修复任务/项目长文本溢出、Bug共享分页及真实阶段PATCH备注校验遗漏；同日补齐描述/备注空态、旧Bug备注兼容及编辑清空。测试结果与同步状态见当日报告及工作记录，本次详情修复无新迁移。

---

## 4. CI 与自动化

- GitHub Actions 工作流：`.github/workflows/ci.yml`
- 当前 CI 范围：
  - 后端冒烟测试：`pytest -q tests/test_health.py`
  - 前端冒烟构建：`npm run test:smoke`

---

## 5. 文档维护规则

当项目发生结构性变更时，需同步更新相关文档：

| 变更类型 | 需更新的文档 |
|---------|-------------|
| 新增/移除目录 | 本文件（§1 仓库结构） |
| 后端路由/API 变更 | `backend-api.md` |
| 数据模型变更 | `data-models.md` |
| 前端路由/页面/组件变更 | `frontend.md` |
| 业务流程/运行命令变更 | `workflows.md` |
| 开发规范/安全规则变更 | `conventions.md` |
| 架构/技术选型/设计变更 | `project-overview.md`（参见其第 10 章维护规则） |
| 每日重要工作 | `milestone/YYYY-MM-DD.md`（同一天追加到同一文件） |
| 用户指定版本发布 | `updates/<version>.md` |

所有文档使用 UTF-8（无 BOM）编码，LF 换行符，中文书写（技术术语和代码标识符保持英文原文）。

---

*最后更新：2026-10-22*
