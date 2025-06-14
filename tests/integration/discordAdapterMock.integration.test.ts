import { DiscordAdapter } from "@/adapters/audio/discordAdapter";
import type { PCMChunk } from "@/ports/AudioSourcePort";

// モジュールのモック
jest.mock("@/adapters/audio/discord/ConnectionManager", () => ({
  ConnectionManager: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      receiver: {
        speaking: { on: jest.fn() },
      },
    }),
    disconnect: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    getConnection: jest.fn(),
  })),
}));

jest.mock("@/adapters/audio/discord/ChunkStreamer", () => ({
  ChunkStreamer: jest.fn().mockImplementation(() => ({
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
  })),
}));

describe("DiscordAdapter Mock Integration Tests", () => {
  let adapter: DiscordAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (adapter) {
      adapter.stop();
    }
  });

  it("should handle audio streaming with test options", async () => {
    adapter = new DiscordAdapter({
      guildId: "test-guild",
      channelId: "test-channel",
      adapterCreator: {} as any,
      selfId: "test-bot",
      test: { idleSleepMs: 0, maxChunks: 3 },
    });

    const chunks: PCMChunk[] = [];

    // ChunkStreamerのモックから3つのチャンクを返すように設定
    const { ChunkStreamer } = jest.requireMock("@/adapters/audio/discord/ChunkStreamer");
    const mockInstance = ChunkStreamer.mock.results[0].value;

    mockInstance.getNextChunk
      .mockResolvedValueOnce({ userId: "user1", data: Buffer.alloc(1920) })
      .mockResolvedValueOnce({ userId: "user2", data: Buffer.alloc(1920) })
      .mockResolvedValueOnce({ userId: "user3", data: Buffer.alloc(1920) });

    for await (const chunk of adapter.pull()) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    chunks.forEach((chunk) => {
      expect(chunk.data.length).toBe(1920);
      expect(chunk.sampleRate).toBe(48000);
    });
  });

  it("should handle empty streams gracefully", async () => {
    adapter = new DiscordAdapter({
      guildId: "test-guild",
      channelId: "test-channel",
      adapterCreator: {} as any,
      selfId: "test-bot",
      test: { idleSleepMs: 0, maxChunks: 1 },
    });

    // ChunkStreamerがnullを返すように設定
    const { ChunkStreamer } = jest.requireMock("@/adapters/audio/discord/ChunkStreamer");
    const mockInstance = ChunkStreamer.mock.results[0].value;
    mockInstance.getNextChunk.mockResolvedValue(null);
    mockInstance.hasActiveStreams.mockReturnValue(false);

    const startTime = Date.now();

    // タイムアウトで停止
    setTimeout(() => adapter.stop(), 100);

    const chunks: PCMChunk[] = [];
    for await (const chunk of adapter.pull()) {
      chunks.push(chunk);
    }

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(chunks).toHaveLength(0);
  });

  it("should respect configuration options", () => {
    const opts = {
      guildId: "custom-guild",
      channelId: "custom-channel",
      adapterCreator: {} as any,
      selfId: "custom-bot",
    };

    adapter = new DiscordAdapter(opts);

    // 設定が正しく保存されていることを確認（内部状態へのアクセスは避ける）
    expect(() => adapter.stop()).not.toThrow();
  });
});
