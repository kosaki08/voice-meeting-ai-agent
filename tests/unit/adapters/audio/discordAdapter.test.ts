import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { DiscordAdapter, DiscordAdapterOpts } from "@/adapters/audio/discordAdapter";

// ChunkStreamerのモック
const mockChunkStreamer = {
  registerUser: jest.fn(),
  unregisterUser: jest.fn(),
  getNextChunk: jest.fn().mockResolvedValue(null),
  hasActiveStreams: jest.fn().mockReturnValue(false),
  clear: jest.fn(),
  getConfig: jest.fn().mockReturnValue({
    frameSize: 960,
    sampleRate: 48000,
    bytesPerChunk: 1920,
  }),
};

// ConnectionManagerのモック
const mockConnectionManager = {
  connect: jest.fn().mockResolvedValue({
    receiver: {
      speaking: new EventEmitter(),
    },
  }),
  disconnect: jest.fn(),
  isConnected: jest.fn().mockReturnValue(true),
  getConnection: jest.fn(),
};

jest.mock("@/adapters/audio/discord/ConnectionManager", () => ({
  ConnectionManager: jest.fn(() => mockConnectionManager),
}));

jest.mock("@/adapters/audio/discord/ChunkStreamer", () => ({
  ChunkStreamer: jest.fn(() => mockChunkStreamer),
}));

// prism-mediaのモック
jest.mock("prism-media", () => ({
  opus: {
    Decoder: jest.fn().mockImplementation(() => new PassThrough()),
  },
}));

describe("DiscordAdapter", () => {
  let adapter: DiscordAdapter;
  const mockAdapterCreator = {};

  beforeEach(() => {
    jest.clearAllMocks();
    // モックをリセット
    mockChunkStreamer.getNextChunk.mockReset();
    mockChunkStreamer.hasActiveStreams.mockReset();
    mockChunkStreamer.hasActiveStreams.mockReturnValue(false);
  });

  afterEach(() => {
    if (adapter) {
      adapter.stop();
    }
  });

  describe("configuration", () => {
    it("should require configuration before pull", async () => {
      adapter = new DiscordAdapter();
      const iterator = adapter.pull()[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toThrow("DiscordAdapter not configured");
    });

    it("should configure adapter with options", () => {
      adapter = new DiscordAdapter();
      const opts: DiscordAdapterOpts = {
        guildId: "test-guild",
        channelId: "test-channel",
        adapterCreator: mockAdapterCreator as any,
        selfId: "test-bot",
      };

      expect(() => adapter.configure(opts)).not.toThrow();
    });
  });

  describe("interface compliance", () => {
    it("should implement AudioSourcePort interface", () => {
      adapter = new DiscordAdapter();
      expect(typeof adapter.pull).toBe("function");
      expect(typeof adapter.stop).toBe("function");
    });
  });

  describe("stop functionality", () => {
    it("should stop cleanly when called", () => {
      adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
      });

      expect(() => adapter.stop()).not.toThrow();

      // 複数回呼んでもエラーにならない
      expect(() => adapter.stop()).not.toThrow();

      // モックが呼ばれていることを確認
      expect(mockConnectionManager.disconnect).toHaveBeenCalled();
      expect(mockChunkStreamer.clear).toHaveBeenCalled();
    });
  });

  describe("pull functionality", () => {
    it("should yield chunks when data is available", async () => {
      // ChunkStreamerのモックを設定
      mockChunkStreamer.getNextChunk.mockResolvedValueOnce({ userId: "user1", data: Buffer.alloc(1920) }).mockResolvedValueOnce(null);

      adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
        test: { idleSleepMs: 0, maxChunks: 1 },
      });

      const chunks = [];
      for await (const chunk of adapter.pull()) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].data.length).toBe(1920);
      expect(chunks[0].sampleRate).toBe(48000);
    });

    it("should respect maxChunks test option", async () => {
      // 複数のチャンクを返す設定
      mockChunkStreamer.getNextChunk
        .mockResolvedValueOnce({ userId: "user1", data: Buffer.alloc(1920) })
        .mockResolvedValueOnce({ userId: "user1", data: Buffer.alloc(1920) })
        .mockResolvedValueOnce({ userId: "user1", data: Buffer.alloc(1920) });

      adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
        test: { idleSleepMs: 0, maxChunks: 2 },
      });

      const chunks = [];
      for await (const chunk of adapter.pull()) {
        chunks.push(chunk);
      }

      // maxChunks=2なので2つだけ取得される
      expect(chunks).toHaveLength(2);
    });

    it("should wait when no active streams", async () => {
      // アクティブなストリームがない場合
      mockChunkStreamer.getNextChunk.mockResolvedValue(null);
      mockChunkStreamer.hasActiveStreams.mockReturnValue(false);

      adapter = new DiscordAdapter({
        guildId: "test",
        channelId: "test",
        adapterCreator: mockAdapterCreator as any,
        selfId: "bot",
        test: { idleSleepMs: 1, maxChunks: 1 },
      });

      const startTime = Date.now();

      // 短時間後にストリームを追加
      setTimeout(() => {
        mockChunkStreamer.getNextChunk.mockResolvedValueOnce({
          userId: "user1",
          data: Buffer.alloc(1920),
        });
      }, 10);

      const chunks = [];
      for await (const chunk of adapter.pull()) {
        chunks.push(chunk);
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(chunks).toHaveLength(1);
    });
  });
});
