# 系统测试指引

每次功能更新必须同步相关测试代码和本目录用例。未执行的项目明确写“未验证”，不得以构建成功替代业务验收。

最近一次复核记录见 `report-2026-10-19.md`；开发升级首轮实测记录保留在 `report-2026-10-16.md`。

## 环境与安全

1. 先读 `.agent/workflows/project-index.md`，核对分支、工作区改动和任务边界。
2. Python 必须使用 `/opt/miniconda3/envs/punkrecord/bin/python`，先打印 `sys.executable` 核实。禁止系统 Python。
3. 自动化默认使用隔离 SQLite。不得将清空表、造数、并发测试指向开发业务库或生产库。
4. 测试凭证、地址、密钥通过忽略的 `.env` 或环境变量传入；不得写进用例、截图或提交记录。SQL 日志应隐藏参数。
5. 数据迁移先备份，再检查迁移结果。不得自动回滚删除贝利流水。

## 自动化命令

在 `backend/` 执行：

```sh
/opt/miniconda3/envs/punkrecord/bin/python -m pytest -q --disable-warnings tests
```

在 `frontend/` 执行 `npm run build`。构建产物用于验证，不提交 `dist/`。

MySQL 行锁并发验证：在本地开发 MySQL、账号具有临时建库权限时，执行：

```sh
PUNKRECORD_MYSQL_TESTS=1 /opt/miniconda3/envs/punkrecord/bin/python -m pytest -q tests/test_beli_mysql.py
```

此测试只创建随机 `punkrecord_test_*` 数据库并在结束时删除。默认跳过；权限不足也会明确跳过，不代表通过并发验证。禁止通过真实业务库造数规避限制。

## 浏览器验证

1. 保持开发前端运行；另一个终端在 `backend/` 启动 `/opt/miniconda3/envs/punkrecord/bin/python tests/browser_fixture.py`。
2. 等临时服务就绪，根目录执行 `node scripts/test-planning-ui.cjs`。
3. 脚本使用已有 Playwright 和 Chromium；不同机器通过 `PLAYWRIGHT_MODULE`、`PLAYWRIGHT_CHROMIUM` 配置安装路径，不自动安装依赖。
4. `FRONTEND_TEST_URL` 指向开发前端；`BROWSER_FIXTURE_URL` 指向本机临时服务。所有浏览器 API 请求转发至临时 SQLite，不写入开发业务数据。
5. 每次重跑前重启临时服务以重置状态。截图默认放在 `/tmp/punkrecord-ui`，查看桌面与手机截图，检查文字、滚动、弹窗和图片。
6. 测试结束停止临时服务；开发前后端应保持运行。当前会话生成的临时凭证不可用于真实账号。

## 每次更新的交付记录

- 列出受影响模块及对应 `cases.md` 编号。
- 补充或调整断言，运行相关模块及其上下游回归。
- 涉及余额、库存、权限、审批、迁移的变更必须检查防重、事务回滚及越权。
- 记录通过数量、跳过原因、构建结果、截图位置和未覆盖项。
- 同步项目文档、当日 milestone；仅在用户指定版本时维护对应版本日志。
- MCP 工具新增或移除时，同步 `backend-api.md` 的工具清单和总数；`test_mcp_todo_tools.py` 会对照实际注册结果校验文档，防止章节清单遗漏。
