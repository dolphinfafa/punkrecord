# 数据库切换指南

本项目支持在开发环境和生产环境使用不同的数据库系统。

## 数据库类型

- **SQLite** - 推荐用于开发环境
  - ✅ 无需安装额外数据库服务
  - ✅ 配置简单，开箱即用
  - ✅ 数据存储在单个文件中，便于备份和迁移
  - ⚠️ 不适合高并发生产环境

- **MySQL** - 推荐用于生产环境
  - ✅ 生产级数据库，性能优秀
  - ✅ 支持高并发访问
  - ✅ 更强大的数据管理功能
  - ⚠️ 需要单独安装和配置数据库服务

## 快速切换

### 开发环境（使用 SQLite）

在 `backend/.env` 文件中设置：

```bash
DB_TYPE=sqlite
SQLITE_DB_PATH=./atlas.db
```

### 生产环境（使用 MySQL）

在 `backend/.env` 文件中设置：

```bash
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=punkrecord
DB_USER=admin
DB_PASSWORD=Cc123456@123456
```

## 详细步骤

### 1. 开发环境配置（SQLite）

#### 步骤 1: 修改环境变量

编辑 `backend/.env` 文件：

```bash
DB_TYPE=sqlite
SQLITE_DB_PATH=./atlas.db
```

#### 步骤 2: 初始化数据库

```bash
cd backend
python init_database.py
```

#### 步骤 3: 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

数据将存储在 `backend/atlas.db` 文件中。

### 2. 生产环境配置（MySQL）

#### 步骤 1: 安装 MySQL

确保已安装 MySQL 5.7+ 或 8.0+

#### 步骤 2: 创建数据库

```bash
mysql -u root -p
```

```sql
CREATE DATABASE punkrecord CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'admin'@'localhost' IDENTIFIED BY 'Cc123456@123456';
GRANT ALL PRIVILEGES ON punkrecord.* TO 'admin'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 步骤 3: 修改环境变量

编辑 `backend/.env` 文件：

```bash
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=punkrecord
DB_USER=admin
DB_PASSWORD=Cc123456@123456
```

#### 步骤 4: 初始化数据库

```bash
cd backend
python init_database.py
```

#### 步骤 5: 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 数据迁移

### 从 SQLite 迁移到 MySQL

如果你在开发环境使用 SQLite，需要迁移到 MySQL 生产环境：

1. **导出 SQLite 数据**（可选）
   ```bash
   sqlite3 atlas.db .dump > backup.sql
   ```

2. **配置 MySQL**（按照上述生产环境步骤）

3. **重新初始化数据库**
   ```bash
   python init_database.py
   ```

4. **重新创建管理员账户**
   ```bash
   python create_admin.py
   ```

### 从 MySQL 迁移到 SQLite

1. **修改环境变量**
   ```bash
   DB_TYPE=sqlite
   SQLITE_DB_PATH=./atlas.db
   ```

2. **重新初始化数据库**
   ```bash
   python init_database.py
   ```

## 注意事项

1. **UUID 支持**: 两种数据库都支持 UUID 类型，无需修改模型代码

2. **连接池**: SQLite 不需要连接池配置，MySQL 会自动使用连接池

3. **备份建议**:
   - SQLite: 直接复制 `atlas.db` 文件
   - MySQL: 使用 `mysqldump` 命令

4. **性能考虑**:
   - 开发环境数据量小，SQLite 完全够用
   - 生产环境建议使用 MySQL 以获得更好的性能和并发支持

## 验证配置

启动应用后，访问 http://localhost:8000/docs 查看 API 文档，确认数据库连接正常。

在日志中会看到类似输出：

```
INFO:     Database URL: sqlite:///./atlas.db
```

或

```
INFO:     Database URL: mysql+pymysql://admin:***@localhost:3306/punkrecord
```
