---
name: Python Environment Management
description: Python 环境管理和包安装规范,根据操作系统自动使用正确的虚拟环境(Windows: conda, macOS: pyenv)
---

# Python Environment Management Skill

这个 skill 定义了 punkrecord 项目中 Python 环境管理的标准规范。

## 核心原则

🔴 **关键规则**: 所有 Python 相关命令必须在 `punkrecord` 虚拟环境中执行

### 环境检测

根据操作系统自动选择正确的环境管理工具:

- **Windows**: 使用 **conda** 环境
  - 激活命令: `conda activate punkrecord`
  - 环境管理器: Anaconda/Miniconda
  
- **macOS**: 使用 **pyenv** 环境
  - 激活命令: `pyenv activate punkrecord`
  - 环境管理器: pyenv + pyenv-virtualenv

## 环境信息

- **环境名称**: `punkrecord`
- **Python 版本**: 参考 `.python-version` 文件
- **包管理**: pip (通过虚拟环境)
- **环境管理器**:
  - Windows: conda (Anaconda/Miniconda)
  - macOS: pyenv + pyenv-virtualenv

## 标准操作流程

### 1. 激活环境

在执行任何 Python 命令前,必须先激活环境:

**Windows (conda)**:
```bash
conda activate punkrecord
```

**macOS (pyenv)**:
```bash
pyenv activate punkrecord
```

### 2. 安装依赖

安装项目依赖时:

**Windows (conda)**:
```bash
conda activate punkrecord
cd backend
pip install -r requirements.txt
```

**macOS (pyenv)**:
```bash
pyenv activate punkrecord
cd backend
pip install -r requirements.txt
```

### 3. 运行 Python 脚本

执行任何 Python 脚本:

**Windows (conda)**:
```bash
conda activate punkrecord
python backend/script_name.py
```

**macOS (pyenv)**:
```bash
pyenv activate punkrecord
python backend/script_name.py
```

### 4. 运行开发服务器

启动后端开发服务器:

**Windows (conda)**:
```bash
conda activate punkrecord
cd backend
uvicorn app.main:app --reload
```

**macOS (pyenv)**:
```bash
pyenv activate punkrecord
cd backend
uvicorn app.main:app --reload
```

### 5. 添加新包

当需要安装新的 Python 包时:

**Windows (conda)**:
```bash
conda activate punkrecord
pip install package_name
# 然后更新 requirements.txt
pip freeze > backend/requirements.txt
```

**macOS (pyenv)**:
```bash
pyenv activate punkrecord
pip install package_name
# 然后更新 requirements.txt
pip freeze > backend/requirements.txt
```

## 命令执行检查清单

在执行 Python 命令前,确认:

- [ ] 已激活 `punkrecord` conda 环境
- [ ] 当前工作目录正确
- [ ] 所需的环境变量已设置(如 `.env` 文件)
- [ ] 依赖包已安装

## AI 助手执行规范

当 AI 助手需要运行 Python 命令时,必须:

1. **检测操作系统**: 首先确定当前操作系统(Windows 或 macOS)
2. **使用正确的激活命令**:
   - Windows: `conda activate punkrecord`
   - macOS: `pyenv activate punkrecord`
3. **设置正确的工作目录**: 使用 `Cwd` 参数指定正确的目录
4. **组合命令**: 可以使用 `&&` 连接激活和执行命令:
   
   **Windows**:
   ```bash
   conda activate punkrecord && python backend/script.py
   ```
   
   **macOS**:
   ```bash
   pyenv activate punkrecord && python backend/script.py
   ```

## 示例命令

### 数据库初始化

**Windows**:
```bash
conda activate punkrecord && python backend/init_database.py
```

**macOS**:
```bash
pyenv activate punkrecord && python backend/init_database.py
```

### 运行测试

**Windows**:
```bash
conda activate punkrecord && cd backend && pytest
```

**macOS**:
```bash
pyenv activate punkrecord && cd backend && pytest
```

### 检查包版本

**Windows**:
```bash
conda activate punkrecord && pip list
```

**macOS**:
```bash
pyenv activate punkrecord && pip list
```

### 数据库迁移

**Windows**:
```bash
conda activate punkrecord && cd backend && alembic upgrade head
```

**macOS**:
```bash
pyenv activate punkrecord && cd backend && alembic upgrade head
```

## 故障排除

### 命令找不到
- 确认已激活 `punkrecord` 环境
- 检查包是否已安装:
  - Windows: `conda activate punkrecord && pip list`
  - macOS: `pyenv activate punkrecord && pip list`

### 导入错误
- 验证工作目录是否正确
- 确认 PYTHONPATH 设置正确
- 检查 `__init__.py` 文件是否存在

### 环境不存在

如果 `punkrecord` 环境不存在,需要创建:

**Windows (conda)**:
```bash
conda create -n punkrecord python=3.x
conda activate punkrecord
pip install -r backend/requirements.txt
```

**macOS (pyenv)**:
```bash
# 首先安装 Python 版本(如果尚未安装)
pyenv install 3.x.x
# 创建虚拟环境
pyenv virtualenv 3.x.x punkrecord
# 激活环境
pyenv activate punkrecord
# 安装依赖
pip install -r backend/requirements.txt
```

## 与 Workflow 的关系

这个 skill 补充了 `.agent/workflows/python-environment.md` workflow,提供了更详细的指导原则和最佳实践。

## 注意事项

⚠️ **警告**:
- 永远不要在 base/global 环境中安装项目依赖
- 不要混用不同的 Python 环境
- Windows 和 macOS 使用不同的环境管理器,但环境名称都是 `punkrecord`
- 修改 requirements.txt 后要通知团队成员更新环境
- 定期检查并更新过时的包
- 团队成员可能使用不同的操作系统,确保命令兼容性
