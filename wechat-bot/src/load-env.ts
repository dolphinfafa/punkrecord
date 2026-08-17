import { fileURLToPath } from "node:url";

/**
 * 在其它模块(尤其 config.ts)求值之前加载包根目录的 .env。
 * 必须是 main.ts 的第一个 import —— ESM 按 import 顺序求值。
 * 文件不存在或当前 Node 不支持时静默跳过;已存在的环境变量不会被覆盖。
 */
try {
  // dist/main.js → 包根/.env
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  /* 无 .env(或 Node < 20.12)则忽略,依赖外部环境变量 */
}
