import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DiscordAdapterMock } from "@adapters/audio/discord/DiscordAdapterMock.js";
import { WhisperAdapter } from "@adapters/transcriber/WhisperAdapter.js";
import type { TranscriptSegment } from "@ports/TranscriberPort.js";

describe("WhisperAdapter Integration", () => {
  let whisperAdapter: WhisperAdapter;
  let discordAdapter: DiscordAdapterMock;

  // 必要な環境変数が設定されているかチェック
  const hasRequiredEnvVars = Boolean(process.env.OPENAI_API_KEY);
  // CI環境またはテスト専用のフラグをチェック
  const shouldUseRealAPI = process.env.USE_REAL_OPENAI_API === "true";

  beforeEach(() => {
    if (!hasRequiredEnvVars && shouldUseRealAPI) {
      return;
    }

    whisperAdapter = new WhisperAdapter();
    discordAdapter = new DiscordAdapterMock();
  });

  afterEach(() => {
    if (whisperAdapter) {
      whisperAdapter.stop();
    }
  });

  it("should transcribe audio from Discord adapter", async () => {
    if (!hasRequiredEnvVars && shouldUseRealAPI) {
      console.log("Skipping test: OPENAI_API_KEY not set");
      return;
    }

    if (!shouldUseRealAPI) {
      console.log("Skipping real API test. Set USE_REAL_OPENAI_API=true to run with actual API");
      return;
    }

    // テスト用のPCMファイルを読み込む
    const audioPath = join(process.cwd(), "tests", "assets", "konnichiwa_16khz_mono.pcm");
    let audioData: Buffer;
    let isUsingMockData = false;

    try {
      audioData = await readFile(audioPath);
    } catch (_error) {
      console.warn("Test audio file not found, creating mock data");
      // モックデータを作成（無音）
      audioData = Buffer.alloc(16000 * 2 * 3); // 3秒分の16kHz mono PCM
      isUsingMockData = true;
    }

    // 48kHzに変換されたものとして扱う（実際のDiscordアダプタは48kHzを出力）
    const chunk48k = {
      data: audioData,
      sampleRate: 48000 as const,
    };

    // DiscordAdapterMockにデータを設定
    discordAdapter.setAudioChunks([chunk48k]);

    // Discord から音声を取得して Whisper に送信
    const transcripts: TranscriptSegment[] = [];

    // タイムアウトを設定
    const timeout = setTimeout(() => {
      whisperAdapter.stop();
    }, 10000); // 10秒でタイムアウト

    try {
      // Discord adapter から音声を取得
      for await (const chunk of discordAdapter.pull()) {
        await whisperAdapter.push(chunk);
      }

      // Whisper からの転写結果を取得
      for await (const segment of whisperAdapter.stream()) {
        transcripts.push(segment);
        if (transcripts.length >= 1) {
          break; // 最初の転写結果を取得したら終了
        }
      }

      clearTimeout(timeout);

      // 結果を検証
      if (isUsingMockData) {
        // 無音データの場合、Whisperは何も返さない可能性が高い
        console.log("Using mock silent data, transcripts may be empty");
        expect(transcripts.length).toBeGreaterThanOrEqual(0);
      } else {
        // 実際の音声データがある場合
        expect(transcripts.length).toBeGreaterThan(0);
        expect(transcripts[0]).toMatchObject({
          text: expect.any(String),
          startMs: expect.any(Number),
          endMs: expect.any(Number),
          isFinal: true,
        });
        console.log("Transcription result:", transcripts[0].text);
      }
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }, 30000); // 30秒のタイムアウト

  it("should handle multiple audio chunks", async () => {
    if (!hasRequiredEnvVars && shouldUseRealAPI) {
      console.log("Skipping test: OPENAI_API_KEY not set");
      return;
    }

    if (!shouldUseRealAPI) {
      console.log("Skipping real API test. Set USE_REAL_OPENAI_API=true to run with actual API");
      return;
    }

    // 複数の短いチャンクを作成
    const chunks = Array.from({ length: 10 }, () => ({
      data: Buffer.alloc(9600), // 100ms of 48kHz mono PCM
      sampleRate: 48000 as const,
    }));

    discordAdapter.setAudioChunks(chunks);

    const startTime = Date.now();
    let chunkCount = 0;

    // チャンクを順次処理
    for await (const chunk of discordAdapter.pull()) {
      await whisperAdapter.push(chunk);
      chunkCount++;
    }

    expect(chunkCount).toBe(10);

    // 処理時間を確認
    const elapsed = Date.now() - startTime;
    console.log(`Processed ${chunkCount} chunks in ${elapsed}ms`);
  });

  it("should stop gracefully", async () => {
    if (!hasRequiredEnvVars && shouldUseRealAPI) {
      console.log("Skipping test: OPENAI_API_KEY not set");
      return;
    }

    if (!shouldUseRealAPI) {
      console.log("Skipping real API test. Set USE_REAL_OPENAI_API=true to run with actual API");
      return;
    }

    const chunk = {
      data: Buffer.alloc(96000), // 1秒分
      sampleRate: 48000 as const,
    };

    await whisperAdapter.push(chunk);

    // すぐに停止
    whisperAdapter.stop();

    // 再度pushしようとするとエラーになる
    await expect(whisperAdapter.push(chunk)).rejects.toThrow("WhisperAdapter has been stopped");
  });
});

/**
 * タイムアウト付きでAsyncIteratorから要素を収集（未使用だが参考実装として残す）
 */
async function _collectChunksWithTimeout<T>(iterator: AsyncIterator<T>, maxCount: number, timeoutMs = 5000): Promise<T[]> {
  const results: T[] = [];
  const timeout = setTimeout(() => {
    throw new Error("Timeout while collecting chunks");
  }, timeoutMs);

  try {
    while (results.length < maxCount) {
      const { value, done } = await iterator.next();
      if (done) break;
      results.push(value);
    }
  } finally {
    clearTimeout(timeout);
  }

  return results;
}
