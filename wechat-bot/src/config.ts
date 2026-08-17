/**
 * Central config for the PunkRecord WeChat bot, from environment variables.
 */

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量 ${name}(参考 .env.example)`);
  return v;
}

function opt(name: string, def: string): string {
  const v = process.env[name];
  return v && v.length ? v : def;
}

export const config = {
  /** Anthropic (Claude) —— 机器人的"大脑"。 */
  anthropicApiKey: req("ANTHROPIC_API_KEY"),
  /** 可指向代理(如 LiteLLM 的 Anthropic 兼容端点);留空用官方默认。 */
  anthropicBaseUrl: opt("ANTHROPIC_BASE_URL", ""),
  anthropicModel: opt("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),

  /** PunkRecord 后端 REST。 */
  punkrecordApi: opt("PUNKRECORD_API", "http://127.0.0.1:15085/api/v1"),
  /** 机器人代表哪个用户操作:该用户的 pat_ agent token。 */
  punkrecordAgentToken: req("PUNKRECORD_AGENT_TOKEN"),

  /** 推送 HTTP server(punkrecord 后端把通知 POST 到这里)。 */
  pushPort: Number(opt("BOT_PUSH_PORT", "15090")),
  /** 推送接口的共享密钥;设置后 punkrecord 端需带 Authorization: Bearer。 */
  pushApiKey: opt("BOT_PUSH_API_KEY", ""),
} as const;
