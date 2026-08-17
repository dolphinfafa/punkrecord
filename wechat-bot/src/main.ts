#!/usr/bin/env node
/**
 * PunkRecord 微信机器人入口。
 *
 *   首次:  npm run start   → 终端弹出二维码,用微信扫码登录(只需一次)
 *   常驻:  pm2 / 守护进程保持进程在线,机器人即在线
 *
 * 登录态由 weixin-agent-sdk 持久化,重启无需重新扫码(token 过期除外)。
 */
import { isLoggedIn, login, start } from "weixin-agent-sdk";

import { PunkRecordAgent } from "./agent.js";
import { startPushServer } from "./pushServer.js";

async function main() {
  if (!isLoggedIn()) {
    console.log("未检测到微信登录态,请扫码登录(仅首次需要)...\n");
    const accountId = await login();
    console.log(`\n✅ 微信登录成功: ${accountId}\n`);
  }

  const agent = new PunkRecordAgent();
  const bot = start(agent, {
    log: (m) => console.log(`[weixin] ${m}`),
  });
  console.log("🤖 PunkRecord 微信机器人已启动,等待消息...");

  startPushServer(bot);

  const shutdown = () => {
    console.log("\n正在停止...");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // 阻塞直到后台 monitor 结束(保持进程常驻)。
  await bot.wait();
}

main().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
