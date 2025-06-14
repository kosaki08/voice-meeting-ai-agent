import { ChunkStreamer } from "@adapters/audio/discord/ChunkStreamer.js";
import { ConnectionManager } from "@adapters/audio/discord/ConnectionManager.js";
import type { DiscordGatewayAdapterCreator } from "@discordjs/voice";
import { AudioSourcePort, PCMChunk, SampleRate } from "@ports/AudioSourcePort.js";

const SAMPLE_RATE: SampleRate = 48_000;

export interface DiscordAdapterOpts {
  guildId: string;
  channelId: string;
  adapterCreator: DiscordGatewayAdapterCreator;
  selfId: string;
  /**
   * @internal テスト専用。アプリ本番コードで設定する必要はありません
   */
  test?: {
    /** while ループを何 ms で 1 tick するか (既定 20) */
    idleSleepMs?: number;
    /** pull() が yield したら自動で停止する最大 chunk 数 (無限) */
    maxChunks?: number;
  };
}

/**
 * Discord音声チャンネルからPCMチャンクを取得するアダプター
 * 責務を ConnectionManager（接続管理）と ChunkStreamer（音声処理）に分離
 */
export class DiscordAdapter implements AudioSourcePort {
  private connectionManager = new ConnectionManager();
  private chunkStreamer = new ChunkStreamer();
  private opts!: DiscordAdapterOpts;
  private shouldStop = false;
  private yieldCount = 0;
  private isListening = false;

  constructor(opts?: Partial<DiscordAdapterOpts>) {
    if (opts) this.configure(opts as DiscordAdapterOpts);
  }

  configure(opts: DiscordAdapterOpts) {
    this.opts = opts;
  }

  stop() {
    this.shouldStop = true;
    this.yieldCount = 0;
    this.isListening = false;

    // リソースのクリーンアップ（多重呼び出しに対応）
    try {
      this.chunkStreamer.clear();
      this.connectionManager.disconnect();
    } catch (error) {
      // stop() の多重呼び出しでエラーが発生してもログのみ
      console.warn("Error during stop():", error);
    }
  }

  /**
   * PCM chunk を流す AsyncGenerator
   */
  async *pull(signal?: AbortSignal): AsyncIterable<PCMChunk> {
    this.yieldCount = 0;
    this.shouldStop = false;

    if (!this.opts) {
      throw new Error("DiscordAdapter not configured. Call configure() first");
    }

    // 本番環境でテストオプションが設定されていたら警告
    if (process.env.NODE_ENV !== "test" && this.opts.test) {
      console.warn("DiscordAdapter test options are ignored in non-test ENV");
    }

    // AbortSignal のリスナー設定
    if (signal) {
      signal.addEventListener("abort", () => {
        this.stop();
      });
    }

    try {
      // 接続を確立
      const connection = await this.connectionManager.connect({
        guildId: this.opts.guildId,
        channelId: this.opts.channelId,
        adapterCreator: this.opts.adapterCreator,
        selfDeaf: false,
        selfMute: true,
      });

      // Speaking イベントの監視
      if (!this.isListening) {
        this.isListening = true;
        connection.receiver.speaking.on("start", (userId: string) => {
          if (this.connectionManager.isConnected()) {
            this.chunkStreamer.registerUser(userId, connection);
          }
        });
      }

      // チャンクの生成
      while (!this.shouldStop) {
        // テストモードで maxChunks が 0 の場合は即座に終了
        if (this.opts.test?.maxChunks === 0) {
          this.shouldStop = true;
          break;
        }

        const chunk = await this.chunkStreamer.getNextChunk();

        if (chunk) {
          yield { data: chunk.data, sampleRate: SAMPLE_RATE };
          this.yieldCount++;

          // テストモードで maxChunks に達したら停止
          if (this.opts.test?.maxChunks && this.yieldCount >= this.opts.test.maxChunks) {
            this.shouldStop = true;
          }
        } else if (!this.chunkStreamer.hasActiveStreams()) {
          // アクティブなストリームがない場合は短時間待機
          const sleepMs = this.opts.test?.idleSleepMs ?? 20;
          await new Promise((resolve) => setTimeout(resolve, sleepMs));
        }
      }
    } catch (error) {
      // エラーが発生した場合はクリーンアップ
      this.stop();
      throw error;
    }
  }
}
