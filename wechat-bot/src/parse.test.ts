import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyIntent,
  extractQuotedAndReply,
  extractTodoId,
  parseCommand,
} from "./parse.js";

const UUID = "3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b";
const UUID_NODASH = UUID.replace(/-/g, "");

const NOTIFY = `📋 任务待审核\n标题: 修复登录页样式\n优先级: P1\n状态: pending_review\n负责人: 张三\n单号: ${UUID}`;

test("extractQuotedAndReply 拆分引用与回复", () => {
  const r = extractQuotedAndReply(`[引用: ${NOTIFY}]\n通过`);
  assert.ok(r);
  assert.equal(r.reply, "通过");
  assert.match(r.quoted, /单号/);
});

test("extractQuotedAndReply 无引用返回 null", () => {
  assert.equal(extractQuotedAndReply("通过"), null);
  assert.equal(extractQuotedAndReply(""), null);
});

test("extractTodoId 支持带连字符 UUID", () => {
  assert.equal(extractTodoId(NOTIFY), UUID);
});

test("extractTodoId 支持不带连字符的 32 位并规范化为带连字符", () => {
  const quoted = `单号: ${UUID_NODASH}`;
  assert.equal(extractTodoId(quoted), UUID);
});

test("extractTodoId 无单号返回 null", () => {
  assert.equal(extractTodoId("标题: 没有单号"), null);
});

test("classifyIntent 识别各种'通过'", () => {
  for (const w of ["通过", "同意", "批准", "可以", "好的", "ok", "OK", "通过。"]) {
    assert.deepEqual(classifyIntent(w), { action: "approve" }, `应识别: ${w}`);
  }
});

test("classifyIntent 识别'拒绝'并提取理由", () => {
  assert.deepEqual(classifyIntent("拒绝"), { action: "reject", comment: "审核不通过" });
  assert.deepEqual(classifyIntent("拒绝 理由:预算超了"), { action: "reject", comment: "预算超了" });
  assert.deepEqual(classifyIntent("驳回,需求不明确"), { action: "reject", comment: "需求不明确" });
});

test("classifyIntent 非指令返回 null", () => {
  assert.equal(classifyIntent("今天天气怎么样"), null);
  assert.equal(classifyIntent(""), null);
});

test("parseCommand 引用+通过 → approve", () => {
  const cmd = parseCommand(`[引用: ${NOTIFY}]\n通过`);
  assert.deepEqual(cmd, { kind: "approve", todoId: UUID });
});

test("parseCommand 引用+拒绝+理由 → reject 带 comment", () => {
  const cmd = parseCommand(`[引用: ${NOTIFY}]\n拒绝 理由:还差点东西`);
  assert.deepEqual(cmd, { kind: "reject", todoId: UUID, comment: "还差点东西" });
});

test("parseCommand 无引用 → none", () => {
  assert.deepEqual(parseCommand("通过"), { kind: "none" });
});

test("parseCommand 引用但无单号 → none", () => {
  assert.deepEqual(parseCommand("[引用: 标题: 某任务]\n通过"), { kind: "none" });
});

test("parseCommand 引用+单号但回复非指令 → none(交给 Claude)", () => {
  assert.deepEqual(parseCommand(`[引用: ${NOTIFY}]\n这个能延期吗`), { kind: "none" });
});
