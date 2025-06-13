import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { DiscordAdapter, DiscordAdapterOpts } from "@/adapters/audio/discordAdapter";
import { AudioSourcePort } from "@/ports/AudioSourcePort";

jest.mock("prism-media", () => {
  // jest.mock は同期関数でファイル読み込み時に hoist されるので import を使えず ─ require で即値を取る
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PassThrough } = require("stream");
  return {
    __esModule: true,
    default: {
      opus: {
        Decoder: class MockDecoder extends PassThrough {
          constructor(_options: any) {
            super();
          }
        },
      },
    },
  };
});

// モックを最初に定義
let mockConnection: any;
let mockReceiver: any;
let mockSpeaking: EventEmitter;

// @discordjs/voiceのモック
jest.mock("@discordjs/voice", () => ({
  EndBehaviorType: { AfterSilence: 0 },
  joinVoiceChannel: jest.fn(() => {
    if (!mockConnection) {
      mockSpeaking = new EventEmitter();

      mockReceiver = {
        speaking: mockSpeaking,
        subscribe: jest.fn(),
      };

      mockConnection = {
        receiver: mockReceiver,
      };
    }
    return mockConnection;
  }),
}));

describe("DiscordAdapter", () => {
  // モックアダプタークリエイターを作成
  const mockAdapterCreator = jest.fn(() => ({
    sendPayload: jest.fn(),
    destroy: jest.fn(),
  }));

  beforeEach(() => {
    jest.clearAllMocks();

    // モックのリセット
    mockSpeaking = new EventEmitter();

    mockReceiver = {
      speaking: mockSpeaking,
      subscribe: jest.fn(),
    };

    mockConnection = {
      receiver: mockReceiver,
    };
  });

  describe("interface compliance", () => {
    it("should implement AudioSourcePort interface", () => {
      const adapter = new DiscordAdapter();
      expect(adapter).toBeInstanceOf(DiscordAdapter);
      expect(typeof adapter.pull).toBe("function");

      // AudioSourcePortインターフェースの契約を満たしているかチェック
      const audioSourcePort: AudioSourcePort = adapter;
      expect(audioSourcePort).toBeDefined();
    });

    it("should have pull method that returns AsyncIterable", () => {
      const adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });
      const result = adapter.pull();
      expect(result).toBeDefined();
      expect(typeof result[Symbol.asyncIterator]).toBe("function");
    });
  });

  describe("pull method", () => {
    it("should throw error when not configured", async () => {
      const adapter = new DiscordAdapter();
      const asyncIterable = adapter.pull();
      const iterator = asyncIterable[Symbol.asyncIterator]();

      await expect(iterator.next()).rejects.toThrow("DiscordAdapter not configured. Call configure() first");
    });

    it("should configure adapter properly", () => {
      const adapter = new DiscordAdapter();
      const opts: DiscordAdapterOpts = {
        guildId: "test-guild",
        channelId: "test-channel",
        adapterCreator: mockAdapterCreator as any,
        selfId: "test-bot",
      };

      adapter.configure(opts);

      // 設定後はエラーを投げないことを確認するために
      // pull()を呼び出せることを確認
      const asyncIterable = adapter.pull();
      expect(asyncIterable).toBeDefined();
    });

    it("should yield PCM chunks when audio is received", async () => {
      const adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });

      // モックストリームを設定
      const mockOpusStream = new PassThrough();
      mockReceiver.subscribe.mockReturnValue(mockOpusStream);

      // generatorを始動
      const iterator = adapter.pull()[Symbol.asyncIterator]();
      const firstChunkPromise = iterator.next();

      // 少し待ってからイベントリスナーが設定されることを確認
      await new Promise((resolve) => setTimeout(resolve, 10));

      // "userが話し始めた"ことをシミュレート
      mockSpeaking.emit("start", "user123");

      // prism-media Decoderが作成されてpipeチェーンが構築されるのを待つ
      await new Promise((resolve) => setTimeout(resolve, 10));

      // PCMデータを送信（20ms分のデータ）
      mockOpusStream.push(Buffer.alloc(1920));

      // 結果をawait
      const { value, done } = await firstChunkPromise;
      expect(done).toBe(false);
      expect(value.data).toBeInstanceOf(Buffer);
      expect(value.data.length).toBe(1920);
      expect(value.sampleRate).toBe(48000);
    });

    it("should handle multiple users speaking", async () => {
      const adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });

      const mockOpusStream1 = new PassThrough();
      const mockOpusStream2 = new PassThrough();

      // subscribeの呼び出し順に応じて異なるストリームを返す
      mockReceiver.subscribe.mockReturnValueOnce(mockOpusStream1).mockReturnValueOnce(mockOpusStream2);

      const iterator = adapter.pull()[Symbol.asyncIterator]();

      // 複数のチャンクを非同期で収集
      const chunks: any[] = [];
      const collectChunks = async () => {
        for (let i = 0; i < 4; i++) {
          const { value, done } = await iterator.next();
          if (!done) chunks.push(value);
        }
      };

      const collectionPromise = collectChunks();

      // 少し待ってからユーザーを追加
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 2人のユーザーが話し始める
      mockSpeaking.emit("start", "user1");
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockSpeaking.emit("start", "user2");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 各ユーザーからデータを送信
      mockOpusStream1.push(Buffer.alloc(1920));
      mockOpusStream1.push(Buffer.alloc(1920));
      mockOpusStream2.push(Buffer.alloc(1920));
      mockOpusStream2.push(Buffer.alloc(1920));

      await collectionPromise;

      expect(chunks.length).toBe(4);
      chunks.forEach((chunk) => {
        expect(chunk.data.length).toBe(1920);
        expect(chunk.sampleRate).toBe(48000);
      });
    });
  });

  describe("constructor", () => {
    it("should accept configuration in constructor", () => {
      const opts: DiscordAdapterOpts = {
        guildId: "test-guild",
        channelId: "test-channel",
        adapterCreator: mockAdapterCreator as any,
        selfId: "test-bot",
      };

      const adapter = new DiscordAdapter(opts);

      // 設定済みなのでエラーを投げないことを確認
      const asyncIterable = adapter.pull();
      expect(asyncIterable).toBeDefined();
    });
  });
});
