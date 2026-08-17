/**
 * 推送 HTTP server:punkrecord 后端把待办通知 POST 到这里,机器人用与接收回复
 * 相同的微信账号发出去(同账号 → 用户才能"引用"该推送并回复通过/拒绝)。
 *
 * 接口与 weixin-msg-service 对齐,便于 punkrecord 端无缝切换:
 *   POST /api/send  {key, text} -> {ok:true} | 400 {ok:false,error}
 *   GET  /api/health            -> {ok:true}
 */
import http from "node:http";

import type { Bot } from "weixin-agent-sdk";

import { config } from "./config.js";

// 与后端 services/wechat_notify_queue.py 的 _CHANNEL_INACTIVE_MARKER 对齐,
// 让 punkrecord 把该失败识别为"通道未激活"进而入离线队列。
const CHANNEL_INACTIVE_ERROR = "需要先用微信给 bot 发一条消息以激活通知通道";

function json(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<{ key?: string; text?: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

export function startPushServer(bot: Bot): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/health") {
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/api/send" && req.method === "POST") {
        // 可选的共享密钥鉴权
      if (config.pushApiKey) {
        if (req.headers.authorization !== `Bearer ${config.pushApiKey}`) {
          return json(res, 401, { ok: false, error: "未授权" });
        }
      }
      let body: { key?: string; text?: string };
      try {
        body = await readBody(req);
      } catch {
        return json(res, 400, { ok: false, error: "请求体不是合法 JSON" });
      }
      if (!body.text) {
        return json(res, 400, { ok: false, error: "缺少 text" });
      }
      // 单用户机器人:忽略 key,直接发给当前登录用户。
      try {
        await bot.sendMessage(body.text);
        return json(res, 200, { ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // 无有效 context_token(长时间无交互)→ 返回带激活标记的错误。
        const inactive = /context_token|激活|没有找到/i.test(msg);
        return json(res, 400, { ok: false, error: inactive ? CHANNEL_INACTIVE_ERROR : msg });
      }
    }

    return json(res, 404, { ok: false, error: "接口不存在" });
  });

  server.listen(config.pushPort, () => {
    console.log(`[push] 推送服务已监听 :${config.pushPort}(punkrecord 把通知 POST 到 /api/send)`);
  });
  return server;
}
