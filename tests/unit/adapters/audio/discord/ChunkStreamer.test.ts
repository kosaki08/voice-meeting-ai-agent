import { PassThrough } from "node:stream";
import { ChunkStreamer } from "@/adapters/audio/discord/ChunkStreamer";
import type { VoiceConnection } from "@discordjs/voice";

// prism-mediaのモック
jest.mock("prism-media", () => ({
  opus: {
    Decoder: jest.fn().mockImplementation(() => new PassThrough()),
  },
}));

describe("ChunkStreamer", () => {
  let chunkStreamer: ChunkStreamer;
  let mockConnection: Partial<VoiceConnection>;
  let mockOpusStream: PassThrough;
  let mockPcmStream: PassThrough;

  beforeEach(() => {
    chunkStreamer = new ChunkStreamer();
    mockOpusStream = new PassThrough();
    mockPcmStream = new PassThrough();

    // pipe()の結果をmockPcmStreamにする
    mockOpusStream.pipe = jest.fn().mockReturnValue(mockPcmStream);

    mockConnection = {
      receiver: {
        subscribe: jest.fn().mockReturnValue(mockOpusStream),
      } as any,
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("registerUser", () => {
    it("should register user voice stream", () => {
      // Act
      chunkStreamer.registerUser("user123", mockConnection as VoiceConnection);

      // Assert
      expect(mockConnection.receiver?.subscribe).toHaveBeenCalledWith("user123", {
        end: {
          behavior: expect.any(Number),
          duration: 100,
        },
      });
      expect(chunkStreamer.hasActiveStreams()).toBe(true);
    });

    it("should auto-cleanup when stream ends", async () => {
      // Arrange
      chunkStreamer.registerUser("user123", mockConnection as VoiceConnection);

      // Act - PCMストリームのendイベントを発火
      mockPcmStream.emit("end");

      // Assert - イベントループを待つ
      await new Promise((resolve) => setImmediate(resolve));
      expect(chunkStreamer.hasActiveStreams()).toBe(false);
    });

    it("should auto-cleanup on error", async () => {
      // Arrange
      chunkStreamer.registerUser("user123", mockConnection as VoiceConnection);

      // Act - PCMストリームのerrorイベントを発火
      mockPcmStream.emit("error", new Error("Test error"));

      // Assert - イベントループを待つ
      await new Promise((resolve) => setImmediate(resolve));
      expect(chunkStreamer.hasActiveStreams()).toBe(false);
    });
  });

  describe("unregisterUser", () => {
    it("should remove user stream", () => {
      // Arrange
      chunkStreamer.registerUser("user123", mockConnection as VoiceConnection);

      // Act
      chunkStreamer.unregisterUser("user123");

      // Assert
      expect(chunkStreamer.hasActiveStreams()).toBe(false);
    });

    it("should not throw error when removing non-existent user", () => {
      // Act & Assert
      expect(() => chunkStreamer.unregisterUser("nonexistent")).not.toThrow();
    });
  });

  describe("getNextChunk", () => {
    it("should return null when no active streams", async () => {
      // Act
      const result = await chunkStreamer.getNextChunk();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("clear", () => {
    it("should clear all streams", () => {
      // Arrange
      chunkStreamer.registerUser("user1", mockConnection as VoiceConnection);
      chunkStreamer.registerUser("user2", mockConnection as VoiceConnection);

      // Act
      chunkStreamer.clear();

      // Assert
      expect(chunkStreamer.hasActiveStreams()).toBe(false);
    });
  });

  describe("getConfig", () => {
    it("should get default config", () => {
      // Act
      const config = chunkStreamer.getConfig();

      // Assert
      expect(config).toEqual({
        frameSize: 960,
        sampleRate: 48000,
        bytesPerChunk: 1920,
      });
    });

    it("should get custom config", () => {
      // Arrange
      const customStreamer = new ChunkStreamer({
        frameSize: 480,
        sampleRate: 16000,
        bytesPerChunk: 960,
      });

      // Act
      const config = customStreamer.getConfig();

      // Assert
      expect(config).toEqual({
        frameSize: 480,
        sampleRate: 16000,
        bytesPerChunk: 960,
      });
    });
  });
});
