# 系统测试指引

每次功能更新必须同步相关测试代码和本目录用例。未执行的项目明确写“未验证”，不得以构建成功替代业务验收。

最近一次反馈回归见 [2026-10-22 测试报告](report-2026-10-22.md)，用例见 [回归用例](cases.md)；之前复核记录保留在 `report-2026-10-21.md`、`report-2026-10-19.md`、`report-2026-10-16.md`。

## 环境与安全

1. 先读 `.agent/workflows/project-index.md`，核对分支、工作区改动和任务边界。
2. Python 必须使用 `/opt/miniconda3/envs/punkrecord/bin/python`，先打印 `sys.executable` 核实。禁止系统 Python。
3. 自动化默认使用隔离 SQLite。不得将清空表、造数、并发测试指向开发业务库或生产库。
4. 测试凭证、地址、密钥通过忽略的 `.env` 或环境变量传入；不得写进用例、截图或提交记录。SQL 日志应隐藏参数。
5. 数据迁移先备份，再检查迁移结果。不得自动回滚删除贝利流水。

## 自动化命令

在 `backend/` 执行：

```sh
/opt/miniconda3/envs/punkrecord/bin/python -c 'import sys; print(sys.executable); assert sys.prefix == "/opt/miniconda3/envs/punkrecord"'
/opt/miniconda3/envs/punkrecord/bin/python -m pytest -q --disable-warnings tests
```

仅维护文档时，至少在仓库根目录运行 `git diff --check`、核对相对链接，并在 `backend/` 运行下列定向测试，校验文档中的 MCP 清单、反馈契约、迁移兼容和文稿解析规则。报告需将本轮结果与之前的全量、构建和浏览器结果分开记录，不将历史结果当作本轮重跑。

```sh
/opt/miniconda3/envs/punkrecord/bin/python -m pytest -q --disable-warnings tests/test_mcp_todo_tools.py tests/test_feedback_regressions.py tests/test_beli_migration.py tests/test_meeting_transcript_import.py
```

在 `frontend/` 执行 `npm run build`。构建产物用于验证，不提交 `dist/`。

MySQL 行锁并发验证：在本地开发 MySQL、账号具有临时建库权限时，执行：

```sh
PUNKRECORD_MYSQL_TESTS=1 /opt/miniconda3/envs/punkrecord/bin/python -m pytest -q tests/test_beli_mysql.py
```

此测试只创建随机 `punkrecord_test_*` 数据库并在结束时删除。默认跳过；权限不足也会明确跳过，不代表通过并发验证。禁止通过真实业务库造数规避限制。

## 浏览器验证

1. 保持开发前端运行；另一个终端在 `backend/` 启动 `/opt/miniconda3/envs/punkrecord/bin/python tests/browser_fixture.py`，确认临时服务 `/__fixtures` 返回200后再执行浏览器脚本，避免初始化期间连接失败。此端点只属于本机临时服务，不得开放到真实业务服务。
2. 等临时服务就绪，根目录执行 `node scripts/test-planning-ui.cjs`。
3. 脚本使用已有 Playwright 和 Chromium；不同机器通过 `PLAYWRIGHT_MODULE`、`PLAYWRIGHT_CHROMIUM` 配置安装路径，不自动安装依赖。
4. `FRONTEND_TEST_URL` 指向开发前端；`BROWSER_FIXTURE_URL` 指向本机临时服务。所有浏览器 API 请求转发至临时 SQLite，不写入开发业务数据。
5. 每次重跑前重启临时服务以重置状态。截图默认放在 `/tmp/punkrecord-ui`，查看桌面与手机截图，检查文字、滚动、弹窗和图片。
6. 测试结束停止临时服务；开发前后端应保持运行。当前会话生成的临时凭证不可用于真实账号。
7. 反馈修复使用 `node scripts/test-feedback-ui.cjs`，覆盖金额、商品、分页、会议导入和员工选择；与原UI脚本分开启动全新临时服务，避免残留造数影响断言。截图同样放在 `/tmp/punkrecord-ui`。
8. `test_result/` 是被忽略的本地反馈，不是测试依赖；用例中只能生成合成 DOCX/PDF，不得提交用户反馈原件或截图。
9. 第三轮反馈执行 `node scripts/test-feedback-layout-ui.cjs`，同样使用全新临时服务；覆盖1440/1330/390px长文本、图片预览、阶段备注规范化/422恢复、Bug共享分页及URL历史。仅图片下载响应使用合成PNG，业务API仍走隔离SQLite；不向真实存储上传图片。截图为 `/tmp/punkrecord-ui/feedback3-*.png`。
10. 待办详情执行 `node scripts/test-todo-details-ui.cjs`，全新临时服务，覆盖1440/390px描述与备注空态、单字段、旧Bug备注、显式清空、编辑保存刷新、Bug新建/编辑与团队待办同步。接口自动化为 `backend/tests/test_todo_details.py`，截图为 `/tmp/punkrecord-ui/todo-details-*.png`。

## 每次更新的交付记录

- 列出受影响模块及对应 `cases.md` 编号。
- 补充或调整断言，运行相关模块及其上下游回归。
- 涉及余额、库存、权限、审批、迁移的变更必须检查防重、事务回滚及越权。
- 记录通过数量、跳过原因、构建结果、截图位置和未覆盖项。
- 同步项目文档、当日 milestone；仅在用户指定版本时维护对应版本日志。
- MCP 工具新增或移除时，同步 `backend-api.md` 的工具清单和总数；`test_mcp_todo_tools.py` 会对照实际注册结果校验文档，防止章节清单遗漏。

*最后更新：2026-10-22*
