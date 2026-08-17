/**
 * 确定性解析微信"引用 + 回复"消息。
 *
 * SDK 把引用消息拼成:  [引用: {标题} | {被引用正文}]\n{用户回复}
 * 我们的待办推送正文里有一行 "单号: {todo_uuid}",据此定位目标 todo。
 *
 * 这是审批(通过/拒绝)的可靠快路径:能确定就绕过 LLM 直接执行;
 * 不能确定的自由消息交给 Claude(见 agent.ts)。
 */

export type ParsedCommand =
  | { kind: "approve"; todoId: string }
  | { kind: "reject"; todoId: string; comment: string }
  | { kind: "none" };

/** 从文本里拆出"被引用内容"和"用户自己的回复"。无引用返回 null。 */
export function extractQuotedAndReply(text: string): { quoted: string; reply: string } | null {
  if (!text) return null;
  const trimmed = text.replace(/\r\n/g, "\n");
  if (!trimmed.startsWith("[引用:")) return null;
  const close = trimmed.indexOf("]");
  if (close === -1) return null;
  const quoted = trimmed.slice("[引用:".length, close).trim();
  const reply = trimmed.slice(close + 1).replace(/^\n+/, "").trim();
  return { quoted, reply };
}

/** 从被引用内容里提取单号(todo UUID,带或不带连字符)。 */
export function extractTodoId(quoted: string): string | null {
  if (!quoted) return null;
  const m = quoted.match(/单号\s*[:：]\s*([0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}|[0-9a-fA-F]{32})/);
  if (!m) return null;
  const raw = m[1];
  // 规范成不带连字符的 32 位小写,再插回标准连字符形式。
  const hex = raw.replace(/-/g, "").toLowerCase();
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const APPROVE_RE = /^(通过|同意|批准|可以啊?|可以的?|行|好的?|OK|okay|approve|lgtm|yes|没问题)[\s!。.~！]*$/i;

// 拒绝:关键词后可跟理由(冒号/逗号/空格分隔)。
const REJECT_RE = /^(拒绝|驳回|不同意|不通过|打回|退回|reject|no)(?:\s*[理理]?由?\s*[:：,，]?\s*)?(.*)$/i;

const DEFAULT_REJECT_COMMENT = "审核不通过";

/** 把用户回复解析为审批指令;无法确定返回 { kind: "none" }。 */
export function classifyIntent(reply: string): { action: "approve" | "reject"; comment?: string } | null {
  const r = (reply || "").trim();
  if (!r) return null;
  if (APPROVE_RE.test(r)) return { action: "approve" };
  const m = r.match(REJECT_RE);
  if (m) {
    let comment = (m[2] || "").trim().replace(/^[理由由\s]*[:：]?/, "").trim();
    return { action: "reject", comment: comment || DEFAULT_REJECT_COMMENT };
  }
  return null;
}

/** 解析整条入站消息为审批指令;非"引用+通过/拒绝"则返回 none。 */
export function parseCommand(text: string): ParsedCommand {
  const parts = extractQuotedAndReply(text);
  if (!parts) return { kind: "none" };
  const todoId = extractTodoId(parts.quoted);
  if (!todoId) return { kind: "none" };
  const intent = classifyIntent(parts.reply);
  if (!intent) return { kind: "none" };
  if (intent.action === "approve") return { kind: "approve", todoId };
  return { kind: "reject", todoId, comment: intent.comment ?? DEFAULT_REJECT_COMMENT };
}
