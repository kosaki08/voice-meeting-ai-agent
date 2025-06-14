import { PassThrough } from "node:stream";
import { chunkByFrame } from "@/utils/chunkByFrame";

describe("chunkByFrame", () => {
  it("should yield chunks of specified size", async () => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    const bytesPerChunk = 1920;

    // 非同期でチャンクを収集
    const collectPromise = (async () => {
      for await (const chunk of chunkByFrame(stream, bytesPerChunk)) {
        chunks.push(chunk);
      }
    })();

    // データを送信
    stream.push(Buffer.alloc(1920)); // 正確に1チャンク
    stream.push(Buffer.alloc(1920)); // もう1チャンク
    stream.end();

    await collectPromise;

    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(1920);
    expect(chunks[1].length).toBe(1920);
  });

  it("should handle partial chunks correctly", async () => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    const bytesPerChunk = 1920;
    // 非同期でチャンクを収集
    const collectPromise = (async () => {
      for await (const chunk of chunkByFrame(stream, bytesPerChunk)) {
        chunks.push(chunk);
      }
    })();

    // 部分的なデータを送信
    stream.push(Buffer.alloc(500)); // 500バイト
    stream.push(Buffer.alloc(1500)); // 1500バイト → 合計2000バイト = 1チャンク + 80バイトの余り
    stream.push(Buffer.alloc(2000)); // 2000バイト → 合計2080バイト = 1チャンク + 160バイトの余り
    stream.end();

    await collectPromise;

    // 2チャンクのみが返され、余りは捨てられる
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(1920);
    expect(chunks[1].length).toBe(1920);
  });

  it("should handle empty stream", async () => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    const bytesPerChunk = 1920;

    // 非同期でチャンクを収集
    const collectPromise = (async () => {
      for await (const chunk of chunkByFrame(stream, bytesPerChunk)) {
        chunks.push(chunk);
      }
    })();
    stream.end(); // 空のストリーム

    await collectPromise;

    expect(chunks.length).toBe(0);
  });

  it("should discard trailing bytes less than chunk size", async () => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    const bytesPerChunk = 1920;

    // 非同期でチャンクを収集
    const collectPromise = (async () => {
      for await (const chunk of chunkByFrame(stream, bytesPerChunk)) {
        chunks.push(chunk);
      }
    })();

    // 1919バイト（1バイト不足）
    stream.push(Buffer.alloc(1919));
    stream.end();

    await collectPromise;

    // チャンクサイズに満たないため、何も返されない
    expect(chunks.length).toBe(0);
  });

  it("should handle multiple small buffers that combine to full chunks", async () => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    const bytesPerChunk = 1920;
    // 非同期でチャンクを収集
    const collectPromise = (async () => {
      for await (const chunk of chunkByFrame(stream, bytesPerChunk)) {
        chunks.push(chunk);
      }
    })();

    // 小さなバッファを複数回送信
    for (let i = 0; i < 192; i++) {
      stream.push(Buffer.alloc(10)); // 10バイト × 192 = 1920バイト
    }
    stream.end();

    await collectPromise;

    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(1920);
  });
});
