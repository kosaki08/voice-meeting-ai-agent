import { ConnectionManager } from "@/adapters/audio/discord/ConnectionManager";
import { VoiceConnectionStatus, type VoiceConnection } from "@discordjs/voice";

describe("ConnectionManager", () => {
  let connectionManager: ConnectionManager;
  let mockConnection: Partial<VoiceConnection>;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockConnection = {
      state: {
        status: VoiceConnectionStatus.Ready,
        adapter: {} as any,
        networking: {} as any,
      } as any,
      receiver: {
        speaking: {
          removeAllListeners: jest.fn(),
        } as any,
      } as any,
      destroy: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("connect", () => {
    it("should return existing connection if already connected", async () => {
      // Arrange
      connectionManager["connection"] = mockConnection as VoiceConnection;

      // Act
      const result = await connectionManager.connect({
        guildId: "123",
        channelId: "456",
        adapterCreator: {} as any,
      });

      // Assert
      expect(result).toBe(mockConnection);
    });
  });

  describe("disconnect", () => {
    it("should cleanup when connection exists", () => {
      // Arrange
      connectionManager["connection"] = mockConnection as VoiceConnection;

      // Act
      connectionManager.disconnect();

      // Assert
      expect(mockConnection.receiver?.speaking.removeAllListeners).toHaveBeenCalled();
      expect(mockConnection.destroy).toHaveBeenCalled();
      expect(connectionManager.getConnection()).toBeUndefined();
    });

    it("should not throw error when no connection exists", () => {
      // Act & Assert
      expect(() => connectionManager.disconnect()).not.toThrow();
    });

    it("should handle multiple disconnect calls gracefully", () => {
      // Arrange
      connectionManager["connection"] = mockConnection as VoiceConnection;

      // Act & Assert
      expect(() => {
        connectionManager.disconnect();
        connectionManager.disconnect();
      }).not.toThrow();
    });
  });

  describe("isConnected", () => {
    it("should return true when connection is in Ready state", () => {
      // Arrange
      connectionManager["connection"] = mockConnection as VoiceConnection;

      // Act & Assert
      expect(connectionManager.isConnected()).toBe(true);
    });

    it("should return false when no connection exists", () => {
      // Act & Assert
      expect(connectionManager.isConnected()).toBe(false);
    });

    it("should return false when connection is in different state", () => {
      // Arrange
      mockConnection.state = {
        ...mockConnection.state,
        status: VoiceConnectionStatus.Connecting,
      } as any;
      connectionManager["connection"] = mockConnection as VoiceConnection;

      // Act & Assert
      expect(connectionManager.isConnected()).toBe(false);
    });
  });
});
