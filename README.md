# PunkRecord Enterprise Management System

PunkRecord 是一套面向中小型团队的企业级项目管理平台，包含后端 API、Web 管理后台和微信小程序三个客户端。

## Project Structure

-   `/backend`: 后端 API (Python / FastAPI)
-   `/frontend`: Web 管理后台 (React / Vite)
-   `/miniprogram`: 微信小程序 (原生框架)
-   `/prd`: 产品需求文档
-   `/milestone`: 项目里程碑记录
-   `/.agent/workflows`: 项目工作流文档与索引

## 环境要求

- **Node.js**: v16+ (用于前端)
- **Python**: 3.8+ (用于后端)
- **MySQL**: 5.7+ 或 8.0+
- **Conda**: 用于 Python 环境管理（推荐）

## 快速开始

### 1. 数据库配置

确保 MySQL 数据库已创建并配置：

```bash
# 数据库名称: punkrecord
# 用户名: admin
# 密码: Cc123456@123456
```

### 2. 后端服务启动

#### 安装依赖

```bash
# 进入后端目录
cd backend

# 激活 conda 环境（如果使用 conda）
conda activate punkrecord

# 安装 Python 依赖
pip install -r requirements.txt
```

#### 配置环境变量

后端目录下的 `.env` 文件已包含默认配置，如需修改请编辑 `backend/.env` 文件。

#### 初始化数据库

```bash
# 在 backend 目录下运行
python init_database.py
```

#### 启动后端服务

```bash
# 在 backend 目录下运行
uvicorn app.main:app --reload --host 0.0.0.0 --port 8085
```

后端服务将在 `http://localhost:8085` 启动，API 文档可访问 `http://localhost:8085/docs`

### 3. 前端服务启动

#### 安装依赖

```bash
# 进入前端目录
cd frontend

# 安装 npm 依赖
npm install
```

#### 启动前端服务

```bash
# 在 frontend 目录下运行
npm run dev
```

前端服务将在 `http://localhost:5173` 启动

### 4. 访问应用

- **前端界面**: http://localhost:5173
- **后端 API**: http://localhost:8085
- **API 文档**: http://localhost:8085/docs

## 更多信息

请参考 `TODO.md` 了解更多开发任务和详细说明。
