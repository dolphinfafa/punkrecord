---
description: PunkRecord 项目索引大纲。执行任何任务前先阅读此文件，按需查阅子文档。
---

# 项目索引

本文件是项目的导航入口，提供仓库结构总览和子文档索引。Agent 执行任务时先读此文件定位方向，再按需阅读对应的子文档获取详细信息。

---

## 1. 仓库结构

```text
punkrecord/
|- backend/                 # FastAPI 后端服务
|  |- app/
|  |  |- api/               # 路由模块（auth, iam, todo, contract, project, finance, ai, kb, meeting, changelog）
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
- **Python 环境**：虚拟环境名 `punkrecord`（macOS 用 pyenv，Linux/Windows 用 conda）
- **RBAC 状态**：`ENFORCE_RBAC=True`，已正式启用前后端双层权限控制

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

所有文档使用 UTF-8（无 BOM）编码，LF 换行符，中文书写（技术术语和代码标识符保持英文原文）。

---

*最后更新：2026-04-09*
