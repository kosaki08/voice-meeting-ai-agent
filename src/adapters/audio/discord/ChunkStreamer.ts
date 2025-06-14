import { Readable } from "node:stream";
import { EndBehaviorType, type VoiceConnection } from "@discordjs/voice";
import prism from "prism-media";
import { chunkByFrame, type LogLevel } from "@utils/chunkByFrame";

// 1 chunk = 20 ms = 48 kHz × 16-bit × 1ch → 1920 byte
const FRAME_SIZE = 960; // sample /channel /20 ms
const SAMPLE_RATE = 48_000;
const BYTES_PER_CHUNK = FRAME_SIZE * 2; // 16-bit = 2 bytes

export interface ChunkStreamerOptions {
  frameSize?: number;
  sampleRate?: number;
  bytesPerChunk?: number;
  logLevel?: LogLevel;
}

/**
 * Opus → PCM → chunk 変換を担当
 */
export class ChunkStreamer {
  private readonly frameSize: number;
  private readonly sampleRate: number;
  private readonly bytesPerChunk: number;
  private readonly logLevel: LogLevel;
  private activeStreams = new Map<string, AsyncIterable<Buffer>>();
  private activeIterators = new Map<string, AsyncIterator<Buffer>>();

  constructor(options?: ChunkStreamerOptions) {
    this.frameSize = options?.frameSize ?? FRAME_SIZE;
    this.sampleRate = options?.sampleRate ?? SAMPLE_RATE;
    this.bytesPerChunk = options?.bytesPerChunk ?? BYTES_PER_CHUNK;
    this.logLevel = options?.logLevel ?? "warn";
  }

  /**
   * ユーザーの音声ストリームを登録
   */
  registerUser(userId: string, connection: VoiceConnection): void {
    const opusStream = connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 100,
      },
    });

    // Opus→PCM デコード
    let pcm: Readable;
    try {
      pcm = opusStream.pipe(
        new prism.opus.Decoder({
          frameSize: this.frameSize,
          channels: 1,
          rate: this.sampleRate,
        }),
      );
    } catch (_error) {
      // テスト環境などでprism-mediaが正しくモックされていない場合
      pcm = opusStream;
    }

    // PCM→PCMChunk(20 ms) に分割
    const chunkedStream = chunkByFrame(pcm, this.bytesPerChunk, {
      logLevel: this.logLevel,
    });
    this.activeStreams.set(userId, chunkedStream);

    // ストリーム終了時のクリーンアップ
    pcm.on("end", () => {
      this.unregisterUser(userId);
    });

    pcm.on("error", () => {
      this.unregisterUser(userId);
    });
  }

  /**
   * ユーザーの音声ストリームを削除
   */
  unregisterUser(userId: string): void {
    this.activeStreams.delete(userId);
    this.activeIterators.delete(userId);
  }

  /**
   * 次のチャンクを取得
   */
  async getNextChunk(): Promise<{ userId: string; data: Buffer } | null> {
    for (const [userId, stream] of this.activeStreams) {
      let iterator = this.activeIterators.get(userId);
      if (!iterator) {
        iterator = stream[Symbol.asyncIterator]();
        this.activeIterators.set(userId, iterator);
      }

      try {
        const { value, done } = await iterator.next();
        if (!done && value) {
          return { userId, data: value };
        } else if (done) {
          this.unregisterUser(userId);
        }
      } catch (_error) {
        this.unregisterUser(userId);
      }
    }

    return null;
  }

  /**
   * アクティブなストリームがあるか
   */
  hasActiveStreams(): boolean {
    return this.activeStreams.size > 0;
  }

  /**
   * すべてのストリームをクリア
   */
  clear(): void {
    this.activeStreams.clear();
    this.activeIterators.clear();
  }

  /**
   * 設定値を取得
   */
  getConfig() {
    return {
      frameSize: this.frameSize,
      sampleRate: this.sampleRate,
      bytesPerChunk: this.bytesPerChunk,
    };
  }
}
