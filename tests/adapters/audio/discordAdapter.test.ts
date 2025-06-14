import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { DiscordAdapter, DiscordAdapterOpts } from "@/adapters/audio/discordAdapter";
import { AudioSourcePort } from "@/ports/AudioSourcePort";

jest.mock("prism-media", () => {
  // jest.mock は同期関数でファイル読み込み時に hoist されるので import を使えず ─ require で即値を取る
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PassThrough } = require("stream");
  return {
    opus: {
      Decoder: class {
        constructor(_opts: unknown) {
          return new PassThrough();
        }
      },
    },
  };
});

jest.mock("@discordjs/voice", () => ({
  joinVoiceChannel: jest.fn(),
  EndBehaviorType: {
    AfterSilence: 0,
  },
}));

// モックされたモジュールをインポート
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { joinVoiceChannel: mockJoinVoiceChannel } = require("@discordjs/voice");

const mockAdapterCreator = jest.fn();

describe("DiscordAdapter", () => {
  let mockConnection: any;
  let mockReceiver: any;
  let mockSpeaking: EventEmitter;

  beforeEach(() => {
    mockSpeaking = new EventEmitter();
    mockReceiver = {
      speaking: mockSpeaking,
      subscribe: jest.fn(),
    };
    mockConnection = {
      receiver: mockReceiver,
    };
    mockJoinVoiceChannel.mockReturnValue(mockConnection);
    mockJoinVoiceChannel.mockClear();
    jest.clearAllMocks();
  });

  describe("configuration", () => {
    it("should require configuration before pull", async () => {
      const adapter = new DiscordAdapter();
      const iterator = adapter.pull()[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toThrow("DiscordAdapter not configured");
    });

    it("should configure adapter with options", () => {
      const opts: DiscordAdapterOpts = {
        guildId: "123",
        channelId: "456",
        adapterCreator: mockAdapterCreator,
        selfId: "bot",
      };
      const adapter = new DiscordAdapter(opts);
      expect(() => adapter.configure(opts)).not.toThrow();
    });
  });

  describe("interface compliance", () => {
    it("should implement AudioSourcePort", () => {
      const adapter = new DiscordAdapter();
      const _test: AudioSourcePort = adapter;
      expect(adapter.pull).toBeDefined();
    });
  });

  describe("connection management", () => {
    it("should create voice connection on first pull", async () => {
      const adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });

      // pull()を呼び出してイテレータを取得
      const gen = adapter.pull();
      const iterator = gen[Symbol.asyncIterator]();

      // 非同期にnext()を呼ぶが、結果は待たない
      iterator.next();

      // joinVoiceChannelが呼ばれたことを確認
      expect(mockJoinVoiceChannel).toHaveBeenCalledWith({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator,
        selfDeaf: false,
        selfMute: true,
      });

      // テストを終了するために何もイベントを発生させずに終了し、nextPromiseは待機しないようにする
    });

    it("should reuse existing connection", () => {
      const adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });

      // pull()を呼び出すだけで、イテレータは作成しない
      adapter.pull();

      // 接続が再利用されることを確認するために、もう一度pull()を呼び出す
      adapter.pull();

      expect(mockJoinVoiceChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe("audio streaming", () => {
    it("should yield PCM chunks when user speaks", async () => {
      const adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });

      const mockOpusStream = new PassThrough();
      mockReceiver.subscribe.mockReturnValue(mockOpusStream);

      const iterator = adapter.pull()[Symbol.asyncIterator]();

      // データを収集する非同期タスク
      const resultPromise = iterator.next();

      // Speaking イベントを発火
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockSpeaking.emit("start", "user123");

      // PCMデータを送信（1920バイト = 1チャンク）
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockOpusStream.push(Buffer.alloc(1920));

      // チャンクを受信
      const { value, done } = await resultPromise;
      expect(done).toBe(false);
      expect(value).toBeDefined();
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

      mockReceiver.subscribe.mockReturnValueOnce(mockOpusStream1).mockReturnValueOnce(mockOpusStream2);

      const iterator = adapter.pull()[Symbol.asyncIterator]();
      const chunks: any[] = [];

      // 2人のユーザーが話し始める
      mockSpeaking.emit("start", "user123");
      mockSpeaking.emit("start", "user456");

      // 非同期でチャンクを収集
      const collectPromise = (async () => {
        for (let i = 0; i < 4; i++) {
          const { value, done } = await iterator.next();
          if (!done && value) {
            chunks.push(value);
          }
        }
      })();

      // 両方からデータを送信
      await new Promise((resolve) => setTimeout(resolve, 20));
      mockOpusStream1.push(Buffer.alloc(1920));
      mockOpusStream2.push(Buffer.alloc(1920));

      await new Promise((resolve) => setTimeout(resolve, 50));
      mockOpusStream1.push(Buffer.alloc(1920));
      mockOpusStream2.push(Buffer.alloc(1920));

      // ストリーム終了
      mockOpusStream1.end();
      mockOpusStream2.end();

      await collectPromise;

      expect(chunks.length).toBe(4);
      chunks.forEach((chunk) => {
        expect(chunk.data.length).toBe(1920);
        expect(chunk.sampleRate).toBe(48000);
      });
    }, 10000);
  });

  describe("stream cleanup", () => {
    it("should clean up streams when user stops speaking", async () => {
      const adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });

      const mockOpusStream = new PassThrough();
      mockReceiver.subscribe.mockReturnValue(mockOpusStream);

      const iterator = adapter.pull()[Symbol.asyncIterator]();

      // ユーザー1のストリーム開始
      mockSpeaking.emit("start", "user123");

      // データ送信とチャンク受信
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockOpusStream.push(Buffer.alloc(1920));

      const { value } = await iterator.next();
      expect(value.data.length).toBe(1920);

      // ストリーム終了
      mockOpusStream.end();

      // 新しいユーザーのストリーム
      const mockOpusStream2 = new PassThrough();
      mockReceiver.subscribe.mockReturnValue(mockOpusStream2);

      await new Promise((resolve) => setTimeout(resolve, 50));
      mockSpeaking.emit("start", "user456");

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockOpusStream2.push(Buffer.alloc(1920));

      const { value: value2 } = await iterator.next();
      expect(value2.data.length).toBe(1920);

      mockOpusStream2.end();
    }, 10000);

    it("should handle stream errors gracefully", async () => {
      const adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });

      const mockOpusStream = new PassThrough();
      mockReceiver.subscribe.mockReturnValue(mockOpusStream);

      const iterator = adapter.pull()[Symbol.asyncIterator]();

      // ストリーム開始
      mockSpeaking.emit("start", "user123");

      // エラーハンドラを設定してエラーを処理
      mockOpusStream.on("error", () => {
        // エラーを飲み込む
      });

      // エラーを発生させる
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockOpusStream.destroy(new Error("Test error"));

      // 新しいユーザーのストリーム
      const mockOpusStream2 = new PassThrough();
      mockReceiver.subscribe.mockReturnValue(mockOpusStream2);

      await new Promise((resolve) => setTimeout(resolve, 50));
      mockSpeaking.emit("start", "user456");

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockOpusStream2.push(Buffer.alloc(1920));

      const { value } = await iterator.next();
      expect(value.data.length).toBe(1920);

      mockOpusStream2.end();
    }, 10000);
  });

  describe("PCM chunk handling", () => {
    it("should correctly handle partial chunks", async () => {
      const adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });

      const mockOpusStream = new PassThrough();
      mockReceiver.subscribe.mockReturnValue(mockOpusStream);

      const iterator = adapter.pull()[Symbol.asyncIterator]();
      const chunks: any[] = [];

      // チャンク収集を開始
      const collectPromise = (async () => {
        for (let i = 0; i < 2; i++) {
          const { value, done } = await iterator.next();
          if (!done && value) {
            chunks.push(value);
          }
        }
      })();

      mockSpeaking.emit("start", "user123");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 部分的なデータを送信
      // 500 + 1500 = 2000 (1チャンク + 80バイトの余り)
      mockOpusStream.push(Buffer.alloc(500));
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockOpusStream.push(Buffer.alloc(1500));

      // さらにデータを送信
      // 80 + 2000 = 2080 (1チャンク + 160バイトの余り)
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockOpusStream.push(Buffer.alloc(2000));

      mockOpusStream.end();

      await collectPromise;

      // 結果を検証
      expect(chunks.length).toBe(2);
      chunks.forEach((chunk) => {
        expect(chunk.data.length).toBe(1920);
        expect(chunk.sampleRate).toBe(48000);
      });
    });
  });
});
