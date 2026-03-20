# PunkRecord Enterprise Management System

PunkRecord 是一套面向中小型团队的企业级项目管理平台，包含后端 API、Web 管理后台和微信小程序三个客户端。

## 功能模块

| 模块 | 说明 |
|------|------|
| 认证与权限 | JWT 认证、双通道 RBAC（角色权限 + 职位权限）、首次登录档案完善 |
| 组织管理（IAM） | 用户、部门（树形）、职位、权限、实体、组织架构图、Beli 积分 |
| 任务管理（Todo） | 个人/团队任务、状态机、图片附件、请假申请与审批（自动创建审批任务） |
| 合同管理 | 合同 CRUD、交易方管理（含编辑）、付款计划、AI 生成合同 |
| 项目管理 | B2B/B2C 项目、阶段管理、成员管理（搜索/筛选）、功能清单、报价单、原型确认单、开发进度、Bug 管理、验收报告 |
| 财务管理 | 账户、交易记录、发票、报销 |
| AI 能力 | AI 对话、功能清单生成、合同起草（LiteLLM/Gemini） |
| 企业大脑（KB） | 知识库文档管理、AI 自动分类标签、RAG 语义检索对话 |
| 会议记录 | 音频上传、ASR 转写（豆包）、说话人标注/切换、会议日期、参会人、预设/自定义提示词、引用历史会议、AI 会议纪要、搜索、归档到企业大脑 |

## 技术栈

- **后端**：Python / FastAPI / SQLModel / MySQL 8.0 / ChromaDB
- **前端**：React 19 / Vite / React Router / Axios
- **小程序**：原生微信小程序框架
- **AI**：LiteLLM (Gemini) / 豆包 ASR / ChromaDB 向量检索

## Project Structure

```
punkrecord/
├── backend/                 # FastAPI 后端服务
│   ├── app/
│   │   ├── api/             # 路由模块（auth, iam, todo, contract, project, finance, ai, kb, meeting）
│   │   ├── core/            # 配置、数据库、认证、响应、异常处理、文件存储
│   │   ├── models/          # SQLModel ORM 模型
│   │   ├── schemas/         # Pydantic 请求/响应 Schema
│   │   └── services/        # 业务服务（导出、AI、文档解析、Embedding、RAG、ASR）
│   ├── db_migrations/       # Alembic 数据库迁移
│   └── tests/
├── frontend/                # React Web 前端
│   └── src/
│       ├── api/             # API 请求封装
│       ├── components/      # 共享组件（common/, layout/, todo/）
│       ├── contexts/        # AuthContext 认证状态
│       └── pages/           # 按业务域划分的页面
├── miniprogram/             # 微信小程序客户端
├── milestone/               # 里程碑工作记录
├── prd/                     # 产品需求文档
└── .agent/workflows/        # Agent 工作流文档与索引
```

## 分支说明

| 分支 | 用途 | 后端端口 | 前端端口 |
|------|------|----------|----------|
| `main` | 生产/稳定版本 | 8085 | 5173 |
| `dev` | 日常开发 | 8086 | 5174 |

> **注意**: 两套环境可同时运行，互不影响。dev 分支的前端代理已指向 8086 端口。

## 环境要求

- **Node.js**: v16+
- **Python**: 3.9+（Deploy 服务器为 3.9，不支持 `X | None` 语法）
- **MySQL**: 8.0+
- **Conda**: 用于 Python 环境管理（推荐）

## 快速开始

### 1. 数据库配置

确保 MySQL 数据库已创建，配置在 `backend/.env` 中。

### 2. 后端服务启动

```bash
cd backend
conda activate punk            # 激活 conda 环境
pip install -r requirements.txt # 安装依赖
python init_database.py         # 初始化数据库（首次）

# dev 分支
uvicorn app.main:app --reload --host 0.0.0.0 --port 8086

# main 分支
uvicorn app.main:app --reload --host 0.0.0.0 --port 8085
```

### 3. 前端服务启动

```bash
cd frontend
npm install

# dev 分支
npm run dev -- --port 5174

# main 分支
npm run dev -- --port 5173
```

### 4. 访问应用

| 环境 | 前端 | 后端 API | API 文档 |
|------|------|----------|----------|
| dev | http://localhost:5174/punkrecord/ | http://localhost:8086 | http://localhost:8086/docs |
| main | http://localhost:5173/punkrecord/ | http://localhost:8085 | http://localhost:8085/docs |

### 5. 便捷启停（dev 环境）

```bash
./dev.sh start    # 启动前后端
./dev.sh stop     # 停止
./dev.sh restart  # 重启
./dev.sh status   # 查看状态
```

## 更多信息

- 详细技术文档：`.agent/workflows/project-index.md`
- 里程碑记录：`milestone/` 目录
- 产品需求文档：`prd/` 目录
