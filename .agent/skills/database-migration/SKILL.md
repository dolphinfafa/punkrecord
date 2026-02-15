---
name: Database Migration
description: 数据库迁移和初始化的标准流程,支持 Windows (conda) 和 macOS (pyenv) 环境
---

# Database Migration Skill

这个 skill 定义了 punkrecord 项目中数据库迁移和初始化的标准流程。

## 环境要求

- 必须在 `punkrecord` 虚拟环境中执行所有 Python 命令
  - **Windows**: conda 环境 (`conda activate punkrecord`)
  - **macOS**: pyenv 环境 (`pyenv activate punkrecord`)
- 数据库配置应在 `.env` 文件中定义

## 标准流程

### 1. 检查环境配置

在执行任何数据库操作前,必须:
- 确认 `.env` 文件存在且包含正确的数据库配置
- 验证以下环境变量:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASSWORD`

### 2. 初始化数据库

使用项目提供的初始化脚本:

**Windows (conda)**:
```bash
conda activate punkrecord
python backend/init_database.py
```

**macOS (pyenv)**:
```bash
pyenv activate punkrecord
python backend/init_database.py
```

### 3. 创建新迁移

当需要修改数据库结构时:

1. 修改 `backend/app/models/` 中的相应模型
2. 生成迁移文件(如果项目使用 Alembic):
   
   **Windows (conda)**:
   ```bash
   conda activate punkrecord
   cd backend
   alembic revision --autogenerate -m "描述性的迁移信息"
   ```
   
   **macOS (pyenv)**:
   ```bash
   pyenv activate punkrecord
   cd backend
   alembic revision --autogenerate -m "描述性的迁移信息"
   ```

3. 检查生成的迁移文件,确保正确性
4. 应用迁移:
   ```bash
   alembic upgrade head
   ```

### 4. 回滚迁移

如果需要回滚:

**Windows (conda)**:
```bash
conda activate punkrecord
cd backend
alembic downgrade -1  # 回滚一个版本
# 或
alembic downgrade <revision_id>  # 回滚到特定版本
```

**macOS (pyenv)**:
```bash
pyenv activate punkrecord
cd backend
alembic downgrade -1  # 回滚一个版本
# 或
alembic downgrade <revision_id>  # 回滚到特定版本
```

## 常见问题

### 数据库连接失败
- 检查 MySQL 服务是否运行
- 验证 `.env` 中的凭据是否正确
- 确认数据库用户有足够的权限

### 迁移冲突
- 检查是否有未提交的迁移文件
- 确保所有团队成员的迁移历史一致
- 必要时手动解决冲突

## 项目特定配置

当前项目配置:
- 数据库: MySQL
- 数据库名: punkrecord
- 默认用户: admin
- 初始化脚本: `backend/init_database.py`

## 注意事项

⚠️ **重要**: 
- 所有 Python 命令必须在 `punkrecord` 虚拟环境中执行
  - Windows: 使用 `conda activate punkrecord`
  - macOS: 使用 `pyenv activate punkrecord`
- 生产环境迁移前务必备份数据库
- 测试迁移的向上和向下路径
- 迁移文件应纳入版本控制
- 团队成员可能使用不同的操作系统,确保命令兼容性
