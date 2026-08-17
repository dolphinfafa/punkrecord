/**
 * PunkRecordAgent:实现 weixin-agent-sdk 的 Agent 接口。
 *
 * 每条入站消息的处理顺序:
 *   1. 触发离线队列补发(来信 = 推送通道刚被激活的信号)。
 *   2. 确定性解析"引用 + 通过/拒绝" → 直接执行(可靠、零延迟、零 LLM 成本)。
 *   3. 其余自由消息 → Claude(tool_use)理解与执行。
 */
import type { Agent, ChatRequest, ChatResponse } from "weixin-agent-sdk";
import type Anthropic from "@anthropic-ai/sdk";

import { ClaudeBrain } from "./claude.js";
import { parseCommand } from "./parse.js";
import { punkrecord } from "./punkrecord.js";

const MAX_HISTORY = 20; // 每个会话保留的最近消息条数

export class PunkRecordAgent implements Agent {
  private brain = new ClaudeBrain();
  private histories = new Map<string, Anthropic.MessageParam[]>();

  clearSession(conversationId: string): void {
    this.histories.delete(conversationId);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // 1. 任何来信都意味着推送通道被激活 → 立即补发积压通知(不阻塞回复)。
    void punkrecord.flushPending().catch(() => {});

    const text = (request.text || "").trim();
    if (!text) return { text: "我目前只处理文字消息哦。" };

    // 2. 确定性快路径:引用 + 通过/拒绝。
    const cmd = parseCommand(text);
    if (cmd.kind !== "none") {
      return { text: await this.executeApproval(cmd) };
    }

    // 3. 自由消息 → Claude。
    const history = this.histories.get(request.conversationId) ?? [];
    try {
      const reply = await this.brain.chat(history, text);
      this.histories.set(request.conversationId, history.slice(-MAX_HISTORY));
      return { text: reply };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { text: `⚠️ 我这边出了点问题:${msg}\n(如果是想审批,请引用那条待办通知,回复"通过"或"拒绝 理由")` };
    }
  }

  /** 直接执行通过/拒绝,返回中文确认。 */
  private async executeApproval(cmd: { kind: "approve" | "reject"; todoId: string; comment?: string }): Promise<string> {
    try {
      if (cmd.kind === "approve") {
        await punkrecord.approveTodo(cmd.todoId);
      } else {
        await punkrecord.rejectTodo(cmd.todoId, cmd.comment ?? "审核不通过");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `❌ ${cmd.kind === "approve" ? "通过" : "拒绝"}失败:${msg}`;
    }

    // 取任务标题让确认更友好(失败也不影响结果)。
    let title = "";
    try {
      const todo = (await punkrecord.getTodo(cmd.todoId)) as { title?: string };
      title = todo.title ?? "";
    } catch {
      /* 忽略,仅用于展示 */
    }
    const verb = cmd.kind === "approve" ? "✅ 已通过" : "🚫 已拒绝";
    const reason = cmd.kind === "reject" && cmd.comment ? `\n理由:${cmd.comment}` : "";
    return `${verb}${title ? `:${title}` : ""}${reason}`;
  }
}
