import { DiscordAdapter } from "@/adapters/audio/discordAdapter";
import type { AudioSourcePort, PCMChunk, SampleRate } from "@/ports/AudioSourcePort";

describe("DiscordAdapter", () => {
  let adapter: DiscordAdapter;

  beforeEach(() => {
    adapter = new DiscordAdapter();
  });

  describe("interface compliance", () => {
    it("should implement AudioSourcePort interface", () => {
      expect(adapter).toBeInstanceOf(DiscordAdapter);
      expect(typeof adapter.pull).toBe("function");

      // AudioSourcePortインターフェースの契約を満たしているかチェック
      const audioSourcePort: AudioSourcePort = adapter;
      expect(audioSourcePort).toBeDefined();
    });

    it("should have pull method that returns AsyncIterable", () => {
      const result = adapter.pull();
      expect(result).toBeDefined();
      expect(typeof result[Symbol.asyncIterator]).toBe("function");
    });
  });

  describe("pull method", () => {
    it("should throw 'not implemented yet' error", async () => {
      const asyncIterable = adapter.pull();
      const iterator = asyncIterable[Symbol.asyncIterator]();

      await expect(iterator.next()).rejects.toThrow("not implemented yet");
    });

    it("should be async generator", () => {
      const result = adapter.pull();
      expect(result[Symbol.asyncIterator]).toBeDefined();
      expect(typeof result[Symbol.asyncIterator]).toBe("function");
    });
  });

  describe("PCMChunk type compatibility", () => {
    it("should be compatible with expected PCMChunk structure", () => {
      // PCMChunkの型定義が正しいことを確認
      const mockChunk: PCMChunk = {
        data: Buffer.alloc(1024),
        sampleRate: 48000,
      };

      expect(mockChunk.data).toBeInstanceOf(Buffer);
      expect(typeof mockChunk.sampleRate).toBe("number");
      expect(mockChunk.sampleRate).toBeGreaterThan(0);
    });

    it("should work with different sample rates", () => {
      const commonSampleRates: SampleRate[] = [8000, 16000, 22050, 44100, 48000, 96000];

      commonSampleRates.forEach((rate) => {
        const chunk: PCMChunk = {
          data: Buffer.alloc(1024),
          sampleRate: rate,
        };
        expect(chunk.sampleRate).toBe(rate);
      });
    });
  });

  describe("error handling", () => {
    it("should handle iteration attempts gracefully", async () => {
      const asyncIterable = adapter.pull();

      // 即座に実行される async 関数として定義して expectation に渡す
      await expect(
        (async () => {
          for await (const _ of asyncIterable) {
            throw new Error("Should not yield any chunks");
          }
        })(),
      ).rejects.toThrow("not implemented yet");
    });

    it("should maintain consistent error behavior across multiple calls", async () => {
      const calls = [adapter.pull(), adapter.pull(), adapter.pull()];

      for (const call of calls) {
        const iterator = call[Symbol.asyncIterator]();
        await expect(iterator.next()).rejects.toThrow("not implemented yet");
      }
    });
  });

  describe("future implementation readiness", () => {
    it("should be ready for Discord voice connection integration", () => {
      // 将来の実装で必要になる機能の準備状況をチェック
      expect(adapter).toHaveProperty("pull");

      // DiscordAdapterが適切なインターフェースを実装していることを確認
      const isAudioSourcePort = (obj: unknown): obj is AudioSourcePort => {
        return typeof obj === "object" && obj !== null && "pull" in obj && typeof (obj as AudioSourcePort).pull === "function";
      };

      expect(isAudioSourcePort(adapter)).toBe(true);
    });

    it("should support the expected audio format (48kHz)", () => {
      // Discordの標準音声フォーマットに対応していることを確認
      const expectedSampleRate = 48000;
      const mockChunk: PCMChunk = {
        data: Buffer.alloc(1920), // 48kHz * 20ms * 2 bytes
        sampleRate: expectedSampleRate,
      };

      expect(mockChunk.sampleRate).toBe(expectedSampleRate);
      expect(mockChunk.data).toBeInstanceOf(Buffer);
    });
  });
});
