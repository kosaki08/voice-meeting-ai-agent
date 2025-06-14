import { PassThrough } from "node:stream";

/**
 * PassThroughストリームにPCMデータをプッシュする
 * @param stream - 対象のストリーム
 * @param bytes - プッシュするバイト数
 * @param delayMs - プッシュ前の遅延（ミリ秒）
 */
export async function pushPCM(stream: PassThrough, bytes: number, delayMs = 0): Promise<void> {
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  stream.push(Buffer.alloc(bytes));
}

/**
 * ストリームを終了して、イベントループを1tick回す
 * @param stream - 終了するストリーム
 */
export async function endStreamAndWait(stream: PassThrough): Promise<void> {
  stream.end();
  await new Promise((r) => setImmediate(r)); // 1 tick
}
