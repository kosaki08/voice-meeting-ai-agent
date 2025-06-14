import { Readable } from "node:stream";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ChunkByFrameOptions {
  logLevel?: LogLevel;
  maxBufferSize?: number;
}

/**
 * Readable(PCM) を frameSize 分割し AsyncIterable<Buffer> へ
 *
 * @param stream - PCMデータのストリーム
 * @param bytesPerChunk - 1チャンクあたりのバイト数
 * @param options - オプション設定
 * @returns チャンク単位のAsyncIterable
 *
 * @remarks
 * - 端数は捨てる（bytesPerChunk未満のデータは返さない）
 * - 将来的な拡張案：
 *   - バックプレッシャー対応: Buffer.concat の maxLength オプション
 *   - ステレオ対応: チャンネル数を引数に取り bytesPerChunk を計算
 */
export async function* chunkByFrame(stream: Readable, bytesPerChunk: number, options?: ChunkByFrameOptions): AsyncIterable<Buffer> {
  const maxBufferSize = options?.maxBufferSize ?? 10 * 1024 * 1024; // 10MB default
  const logLevel = options?.logLevel ?? "error";
  let left = Buffer.alloc(0);

  for await (const data of stream) {
    const buf: Buffer = data;
    left = Buffer.concat([left, buf]);

    // メモリリーク防止のセーフガード
    if (left.length > maxBufferSize) {
      const message = `chunkByFrame: Buffer size exceeded ${maxBufferSize} bytes. Discarding buffer.`;

      switch (logLevel) {
        case "debug":
          console.debug(message);
          break;
        case "info":
          console.info(message);
          break;
        case "warn":
          console.warn(message);
          break;
        case "error":
        default:
          console.error(message);
          break;
      }

      left = Buffer.alloc(0);
      continue;
    }

    while (left.length >= bytesPerChunk) {
      yield left.subarray(0, bytesPerChunk);
      left = left.subarray(bytesPerChunk);
    }
  }
  // 端数は捨てる（1920バイト未満のチャンクは返さない）
}
