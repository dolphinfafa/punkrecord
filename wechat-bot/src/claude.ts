/**
 * Claude(Anthropic SDK)大脑:tool_use 循环,把用户的自由消息落到 punkrecord 工具上。
 * 仅在确定性解析(parse.ts)无法处理时才走到这里。
 */
import Anthropic from "@anthropic-ai/sdk";

import { config } from "./config.js";
import { punkrecord } from "./punkrecord.js";

const SYSTEM_PROMPT = `你是 PunkRecord 待办管理系统的微信助手。用户在微信里和你对话来管理他的待办任务。

背景:
- 每条待办推送通知的正文里都有一行 "单号: <todo_uuid>"。
- 用户常用微信"引用"某条通知再回复。被引用的内容会以 "[引用: ...单号: <uuid>...]" 出现在消息开头,换行之后才是用户自己的话。
- 看到引用里的 "单号:" 后的 UUID,就把它作为目标 todo_id。

可用工具对应 PunkRecord 的待办操作。

规则:
- 用户表达"通过/同意/批准"某条 → 调 approve_todo。
- 用户表达"拒绝/驳回/不同意"某条 → 调 reject_todo,comment 填用户给的理由;没给理由就用 "审核不通过"。
- 用户问"我有哪些待审核/要审批的" → 调 list_tasks_to_review。
- 用户问"我的待办/任务" → 调 list_my_todos。
- 用户说"开始/完成/阻塞"某条 → 也可告知目前支持通过/拒绝,其它请他在系统里操作。
- 如果无法确定用户指的是哪条任务(消息里既没有单号也没有足够线索),先调 list_tasks_to_review 列出待审核项让用户挑,绝对不要编造 todo_id。
- 操作成功后,用中文简短确认,带上任务标题;失败时用中文说明原因。
- 回复要简洁,适合微信阅读,不要用 markdown 表格。`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "approve_todo",
    description: "审核通过某个待审核的待办任务(pending_review → done)。需要提供任务的单号 todo_id。",
    input_schema: {
      type: "object" as const,
      properties: {
        todo_id: { type: "string", description: "待办任务的单号(UUID)" },
        comment: { type: "string", description: "可选的审核意见" },
      },
      required: ["todo_id"],
    },
  },
  {
    name: "reject_todo",
    description: "驳回某个待审核的待办任务(pending_review → open)。需要提供任务单号 todo_id 和驳回理由 comment。",
    input_schema: {
      type: "object" as const,
      properties: {
        todo_id: { type: "string", description: "待办任务的单号(UUID)" },
        comment: { type: "string", description: "驳回理由(必填)" },
      },
      required: ["todo_id", "comment"],
    },
  },
  {
    name: "list_tasks_to_review",
    description: "列出当前待我审核(pending_review)的任务,含标题、单号、负责人。",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_my_todos",
    description: "列出分配给我的待办任务,可按状态过滤。",
    input_schema: {
      type: "object" as const,
      properties: { status: { type: "string", description: "状态过滤,如 open/in_progress/pending_review/done" } },
    },
  },
  {
    name: "get_todo",
    description: "按单号查询某个待办任务的详情。",
    input_schema: {
      type: "object" as const,
      properties: { todo_id: { type: "string", description: "待办任务的单号(UUID)" } },
      required: ["todo_id"],
    },
  },
];

type ToolInput = Record<string, unknown>;

async function executeTool(name: string, input: ToolInput): Promise<string> {
  try {
    switch (name) {
      case "approve_todo":
        return JSON.stringify(await punkrecord.approveTodo(String(input.todo_id), input.comment ? String(input.comment) : undefined));
      case "reject_todo":
        return JSON.stringify(await punkrecord.rejectTodo(String(input.todo_id), String(input.comment ?? "审核不通过")));
      case "list_tasks_to_review":
        return JSON.stringify(await punkrecord.listTasksToReview());
      case "list_my_todos":
        return JSON.stringify(await punkrecord.listMyTodos(input.status ? String(input.status) : undefined));
      case "get_todo":
        return JSON.stringify(await punkrecord.getTodo(String(input.todo_id)));
      default:
        return JSON.stringify({ error: `未知工具 ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

export class ClaudeBrain {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
      ...(config.anthropicBaseUrl ? { baseURL: config.anthropicBaseUrl } : {}),
    });
  }

  /**
   * 跑一轮(可能多步 tool_use)对话,返回最终文本。
   * history 会被原地追加(由调用方按会话保存)。
   */
  async chat(history: Anthropic.MessageParam[], userText: string): Promise<string> {
    history.push({ role: "user", content: userText });

    // 最多 8 轮 tool_use,防止异常循环。
    for (let i = 0; i < 8; i++) {
      const resp = await this.client.messages.create({
        model: config.anthropicModel,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: history,
      });

      history.push({ role: "assistant", content: resp.content });

      if (resp.stop_reason !== "tool_use") {
        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return text || "（没有可回复的内容）";
      }

      // 执行所有 tool_use,把结果作为下一条 user 消息喂回去。
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(block.name, block.input as ToolInput);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }
      history.push({ role: "user", content: toolResults });
    }
    return "处理步骤有点多,麻烦换个说法再试一次。";
  }
}
