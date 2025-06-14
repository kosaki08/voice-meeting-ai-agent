import { joinVoiceChannel, VoiceConnectionStatus, type DiscordGatewayAdapterCreator, type VoiceConnection } from "@discordjs/voice";

export interface ConnectionOptions {
  guildId: string;
  channelId: string;
  adapterCreator: DiscordGatewayAdapterCreator;
  selfDeaf?: boolean;
  selfMute?: boolean;
  timeoutMs?: number;
}

/**
 * Discord Voice Connection の管理を担当
 */
export class ConnectionManager {
  private connection?: VoiceConnection;

  async connect(opts: ConnectionOptions): Promise<VoiceConnection> {
    if (this.connection && this.connection.state.status === VoiceConnectionStatus.Ready) {
      return this.connection;
    }

    this.connection = joinVoiceChannel({
      guildId: opts.guildId,
      channelId: opts.channelId,
      adapterCreator: opts.adapterCreator,
      selfDeaf: opts.selfDeaf ?? false,
      selfMute: opts.selfMute ?? true,
    });

    // 接続が確立されるまで待機
    await this.waitForReady(opts.timeoutMs);
    return this.connection;
  }

  disconnect(): void {
    if (this.connection) {
      try {
        this.connection.receiver.speaking.removeAllListeners();
        this.connection.destroy();
      } catch (error) {
        // 多重呼び出しや既に破棄されている場合のエラーを無視
        console.debug("Error during disconnect:", error);
      } finally {
        this.connection = undefined;
      }
    }
  }

  getConnection(): VoiceConnection | undefined {
    return this.connection;
  }

  isConnected(): boolean {
    return this.connection?.state.status === VoiceConnectionStatus.Ready;
  }

  private async waitForReady(timeoutMs?: number): Promise<void> {
    if (!this.connection) {
      throw new Error("Connection was not created");
    }

    if (this.connection.state.status === VoiceConnectionStatus.Ready) {
      return;
    }

    const timeout = timeoutMs ?? (process.env.CI ? 20000 : 10000);

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Voice connection timeout"));
      }, timeout);

      const conn = this.connection;
      if (!conn) {
        clearTimeout(timer);
        reject(new Error("Connection was destroyed during setup"));
        return;
      }

      conn.once(VoiceConnectionStatus.Ready, () => {
        clearTimeout(timer);
        resolve();
      });

      conn.once(VoiceConnectionStatus.Destroyed, () => {
        clearTimeout(timer);
        reject(new Error("Connection was destroyed before ready"));
      });

      conn.once(VoiceConnectionStatus.Disconnected, () => {
        clearTimeout(timer);
        reject(new Error("Connection was disconnected"));
      });
    });
  }
}
