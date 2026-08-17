# PunkRecord 微信机器人(wechat-bot)

双向微信机器人:把 PunkRecord 的待办通知**推送**到你微信,并支持**引用某条通知、回复"通过"/"拒绝"来审批**。

- 微信收发:基于 [`weixin-agent-sdk`](https://www.npmjs.com/package/weixin-agent-sdk)(npm 公开包,MIT)。
- 大脑:Claude(Anthropic SDK 直连 + tool_use),自由问答也能答。
- 审批快路径:`引用 + 通过/拒绝` 走**确定性解析**(`src/parse.ts`),不经 LLM,可靠且零延迟;Claude 只兜底自由消息。

## 它怎么工作

```
punkrecord 后端 ──POST /api/send──> 本机器人 ──> 你的微信(收通知)
你的微信 ──引用通知+回复"通过/拒绝"──> 本机器人 ──> Claude/解析 ──> punkrecord approve/reject
```

- **同一微信号**既发推送又收回复,所以"引用"才对得上。
- 推送带 `单号: {todo_uuid}`;引用回复时从 `[引用:...]` 中提取单号定位任务。
- 推送通道约 24h 无交互会失效:失效期间后端把通知**暂存离线队列**;你一旦给机器人发任意消息(通道激活),机器人立刻回调 punkrecord `/wechat-notify/flush` **逐条补发**。

## 前置条件

1. Node.js ≥ 22
2. 一个 **Anthropic API key**
3. 一个 punkrecord 用户的 **agent token**(登录 punkrecord →「MCP」页 → 创建 `pat_` token)
4. 一个**可登录的微信号**(扫一次码,作为机器人账号)

## 安装与启动

```bash
cd wechat-bot
npm install
cp .env.example .env    # 填入 ANTHROPIC_API_KEY 和 PUNKRECORD_AGENT_TOKEN
npm run build

# 首次启动:终端会弹二维码,用做机器人的那个微信扫码登录(只需一次)
npm start
```

登录态由 SDK 持久化,之后重启不用再扫(token 过期才需要)。

## 常驻(保持机器人在线)

```bash
pm2 start dist/main.js --name punkrecord-wechat-bot
pm2 save
```

进程一停机器人就掉线,所以要常驻。

## 与 punkrecord 对接(让推送走这个机器人)

推送和回复必须同一账号,因此 punkrecord 的推送要指向本机器人,而不是 bfb 的 msg-service:

1. punkrecord 后端 `backend/.env`:
   ```
   WECHAT_MSG_SERVICE_URL=http://127.0.0.1:15090
   WECHAT_MSG_SERVICE_API_KEY=<与 BOT_PUSH_API_KEY 相同,若设了的话>
   ```
   重启后端。
2. 给你的 punkrecord 用户建一条 `wechat_notify_binding`(机器人是单用户,`msg_service_key` 可填任意占位值,如 `punkrecord-bot`)。后续可做更顺滑的扫码绑定流程。
3. 开放端口(zheyang 段):`ufw allow 15090/tcp`。

## 怎么用

- 有任务分配给你 / 需要你审核 / 有请假待批 → 微信收到推送。
- 想审批:**长按那条推送 → 引用 → 回复** `通过` 或 `拒绝 理由:xxx`。
- 也可以直接问:"我有哪些待审核?"、"我的待办" 等(走 Claude)。

## 开发

```bash
npm run typecheck   # 类型检查
npm test            # 编译 + 跑解析器单测
```

## 文件

| 文件 | 职责 |
|------|------|
| `src/main.ts` | 入口:扫码登录 + 启动 bot + 起推送服务,常驻 |
| `src/agent.ts` | Agent 接口实现:补发触发 → 确定性审批快路径 → Claude 兜底 |
| `src/parse.ts` | `[引用:...单号:uuid]\n通过/拒绝` 确定性解析(可单测) |
| `src/claude.ts` | Claude tool_use 循环 + 工具定义 + 系统提示词 |
| `src/punkrecord.ts` | punkrecord REST 客户端(pat_ token) |
| `src/pushServer.ts` | `/api/send` 推送 + `/api/health` |
| `src/config.ts` | 环境变量配置 |
