/**
 * PunkRecord 后端 REST 客户端。用 pat_ agent token 调用,操作归因到 token 所属用户。
 */
import { config } from "./config.js";

type Json = Record<string, unknown>;

async function call(method: string, path: string, body?: Json): Promise<Json> {
  const url = `${config.punkrecordApi.replace(/\/+$/, "")}${path}`;
  const resp = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.punkrecordAgentToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: Json = {};
  try {
    data = (await resp.json()) as Json;
  } catch {
    /* 非 JSON 响应 */
  }
  if (!resp.ok) {
    const msg = (data.message as string) || (data.detail as string) || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  // punkrecord 统一响应包 {code,message,data};这里返回 data(无 data 则返回整体)。
  return (data && typeof data === "object" && "data" in data ? (data.data as Json) : data) ?? {};
}

export const punkrecord = {
  approveTodo: (todoId: string, comment?: string) =>
    call("POST", `/todo/${todoId}/approve`, { comment: comment ?? null }),
  rejectTodo: (todoId: string, comment: string) =>
    call("POST", `/todo/${todoId}/reject`, { comment }),
  getTodo: (todoId: string) => call("GET", `/todo/${todoId}`),
  listMyTodos: (status?: string) =>
    call("GET", `/todo/my?${status ? `status=${encodeURIComponent(status)}&` : ""}page_size=20`),
  /** 当前 token 用户作为审核人、处于 pending_review 的任务列表。 */
  async listTasksToReview(): Promise<Json> {
    const me = (await call("GET", `/auth/me`)) as { id?: string };
    return call(
      "GET",
      `/todo/team?status=pending_review&reviewed_by_user_id=${me.id}&page_size=50`,
    );
  },
  /** 触发离线队列补发(机器人收到来信=通道激活信号时调用)。 */
  flushPending: () => call("POST", `/wechat-notify/flush`, {}),
};
