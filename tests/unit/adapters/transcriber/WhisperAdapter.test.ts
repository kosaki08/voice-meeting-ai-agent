import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { WhisperAdapter } from "@adapters/transcriber/WhisperAdapter.js";
import type { PCMChunk } from "@ports/AudioSourcePort.js";
import { OpenAI } from "openai";

// OpenAI モジュールをモック
jest.mock("openai", () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn(),
      },
    },
  })),
}));

jest.mock("openai/uploads", () => ({
  toFile: jest.fn().mockImplementation((buffer, filename) => ({
    name: filename,
    buffer,
  })),
}));

// ffmpeg-static をモック
jest.mock("ffmpeg-static", () => "/usr/bin/ffmpeg");

// child_process.spawn をモック
jest.mock("node:child_process", () => ({
  spawn: jest.fn(() => {
    const mockProcess = new EventEmitter() as any;
    const stdinStream = new PassThrough();
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    mockProcess.stdin = stdinStream;
    mockProcess.stdout = stdoutStream;
    mockProcess.stderr = stderrStream;

    // ffmpeg の挙動をシミュレート
    let inputData = Buffer.alloc(0);

    stdinStream.on("data", (chunk) => {
      inputData = Buffer.concat([inputData, chunk]);
    });

    stdinStream.on("end", () => {
      // 簡略化: 入力データの半分のサイズを出力（48kHz -> 16kHz のシミュレーション）
      const outputData = Buffer.alloc(Math.floor(inputData.length / 3));
      stdoutStream.write(outputData);
      stdoutStream.end();
      setImmediate(() => {
        mockProcess.emit("close", 0);
      });
    });

    return mockProcess;
  }),
}));

describe("WhisperAdapter", () => {
  let adapter: WhisperAdapter;
  let mockOpenAI: jest.MockedObjectDeep<OpenAI>;

  // テスト用の環境変数を設定
  const originalEnv = process.env;
  beforeAll(() => {
    process.env = {
      ...originalEnv,
      WHISPER_MODEL: "whisper-1",
      WHISPER_CHUNK_MS: "1000",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // OpenAI のモックインスタンスを設定
    mockOpenAI = {
      audio: {
        transcriptions: {
          create: jest.fn(),
        },
      },
    } as any;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    adapter = new WhisperAdapter("test-api-key");
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    adapter.stop();
  });

  describe("push", () => {
    it("should accept 48kHz PCM chunks", async () => {
      const chunk: PCMChunk = {
        data: Buffer.alloc(1920), // 20ms of 48kHz mono 16-bit PCM
        sampleRate: 48000,
      };

      await expect(adapter.push(chunk)).resolves.not.toThrow();
    });

    it("should reject non-48kHz sample rates", async () => {
      const chunk: PCMChunk = {
        data: Buffer.alloc(320), // 20ms of 16kHz mono 16-bit PCM
        sampleRate: 16000,
      };

      await expect(adapter.push(chunk)).rejects.toThrow("Unsupported sample rate: 16000");
    });

    it("should reject push after stop", async () => {
      adapter.stop();

      const chunk: PCMChunk = {
        data: Buffer.alloc(1920),
        sampleRate: 48000,
      };

      await expect(adapter.push(chunk)).rejects.toThrow("WhisperAdapter has been stopped");
    });
  });

  describe("stream", () => {
    it("should yield transcript segments when available", async () => {
      // Whisper API のレスポンスをモック
      mockOpenAI.audio.transcriptions.create.mockResolvedValue({
        text: "こんにちは",
        segments: [
          {
            id: 0,
            seek: 0,
            start: 0,
            end: 2,
            text: "こんにちは",
            tokens: [],
            temperature: 0,
            avg_logprob: 0,
            compression_ratio: 0,
            no_speech_prob: 0,
          },
        ],
        language: "ja",
        duration: 2,
      } as any);

      // オーディオチャンクをプッシュ
      const chunk: PCMChunk = {
        data: Buffer.alloc(96000), // 1秒分の48kHz mono 16-bit PCM
        sampleRate: 48000,
      };
      await adapter.push(chunk);

      // タイマーをトリガーして処理を実行
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      // Promise を解決させるため一旦リアルタイマーに戻す
      jest.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ストリームから結果を取得
      const iterator = adapter.stream()[Symbol.asyncIterator]();
      const result = await iterator.next();

      expect(result.done).toBe(false);
      expect(result.value).toMatchObject({
        text: "こんにちは",
        isFinal: true,
      });
    });

    it("should handle empty response gracefully", async () => {
      mockOpenAI.audio.transcriptions.create.mockResolvedValue({
        text: "",
        segments: [],
        language: "ja",
        duration: 0,
      } as any);

      const chunk: PCMChunk = {
        data: Buffer.alloc(96000),
        sampleRate: 48000,
      };
      await adapter.push(chunk);

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      jest.useRealTimers();

      // ストリームから読み込みを試みる
      const segments: any[] = [];
      const _iterator = adapter.stream()[Symbol.asyncIterator]();

      // タイムアウトで読み込みを中断
      const timeout = setTimeout(() => adapter.stop(), 100);

      try {
        for await (const segment of adapter.stream()) {
          segments.push(segment);
        }
      } catch (_e) {
        // 正常終了
      } finally {
        clearTimeout(timeout);
      }

      expect(segments).toHaveLength(0);
    });
  });

  describe("stop", () => {
    it("should clean up resources when stopped", () => {
      adapter.stop();

      // 再度stopを呼んでもエラーにならない
      expect(() => adapter.stop()).not.toThrow();
    });

    it("should process remaining buffer on stop", async () => {
      mockOpenAI.audio.transcriptions.create.mockResolvedValue({
        text: "最後のメッセージ",
        segments: [],
        language: "ja",
        duration: 1,
      } as any);

      const chunk: PCMChunk = {
        data: Buffer.alloc(48000), // 0.5秒分
        sampleRate: 48000,
      };
      await adapter.push(chunk);

      // 停止時に残りのバッファが処理される
      adapter.stop();

      // 少し待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const error = new Error("API Error");
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const chunk: PCMChunk = {
        data: Buffer.alloc(96000),
        sampleRate: 48000,
      };
      await adapter.push(chunk);

      // processingTimerのcallbackを直接実行
      const processAudioBuffer = (adapter as any).processAudioBuffer.bind(adapter);
      await processAudioBuffer();

      expect(consoleSpy).toHaveBeenCalledWith("Error processing audio buffer:", error);

      consoleSpy.mockRestore();
    });
  });
});
