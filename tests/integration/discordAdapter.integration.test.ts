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

describe("DiscordAdapter Integration Tests", () => {
  let adapter: DiscordAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (adapter) {
      adapter.stop();
    }
  });

  it("should initialize and stop without errors", () => {
    adapter = new DiscordAdapter({
      guildId: "test-guild",
      channelId: "test-channel",
      adapterCreator: {} as any,
      selfId: "test-bot",
    });

    expect(() => adapter.stop()).not.toThrow();
  });

  it("should handle pull operation", async () => {
    // ChunkStreamerのモックが正しく動作するように設定
    const { ChunkStreamer } = jest.requireMock("@/adapters/audio/discord/ChunkStreamer");
    ChunkStreamer.mockImplementation(() => ({
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
    }));

    adapter = new DiscordAdapter({
      guildId: "test-guild",
      channelId: "test-channel",
      adapterCreator: {} as any,
      selfId: "test-bot",
      test: { idleSleepMs: 0, maxChunks: 0 }, // すぐに終了
    });

    const chunks: PCMChunk[] = [];
    for await (const chunk of adapter.pull()) {
      chunks.push(chunk);
    }

    // maxChunks=0なのでチャンクは0個
    expect(chunks).toHaveLength(0);
  }, 5000); // 5秒のタイムアウトを設定

  it("should handle stop during pull", async () => {
    adapter = new DiscordAdapter({
      guildId: "test-guild",
      channelId: "test-channel",
      adapterCreator: {} as any,
      selfId: "test-bot",
    });

    const iterator = adapter.pull()[Symbol.asyncIterator]();
    const nextPromise = iterator.next();

    // すぐに停止
    adapter.stop();

    const result = await nextPromise;
    expect(result.done).toBe(true);
  });
});
