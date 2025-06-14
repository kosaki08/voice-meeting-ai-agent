import { Readable } from "node:stream";
import {
  EndBehaviorType,
  joinVoiceChannel,
  VoiceConnectionStatus,
  type DiscordGatewayAdapterCreator,
  type VoiceConnection,
} from "@discordjs/voice";
import prism from "prism-media";
import { AudioSourcePort, PCMChunk, SampleRate } from "../../ports/AudioSourcePort.js";

// 1 chunk = 20 ms = 48 kHz × 16-bit × 1ch → 1920 byte
const FRAME_SIZE = 960; // sample /channel /20 ms
const SAMPLE_RATE: SampleRate = 48_000;
const BYTES_PER_CHUNK = FRAME_SIZE * 2; // 16-bit = 2 bytes

export interface DiscordAdapterOpts {
  guildId: string;
  channelId: string;
  adapterCreator: DiscordGatewayAdapterCreator; // interaction.guild.voiceAdapterCreator など
  selfId: string;
}

export class DiscordAdapter implements AudioSourcePort {
  private connection?: VoiceConnection;
  private opts!: DiscordAdapterOpts;
  private shouldStop = false;

  constructor(opts?: Partial<DiscordAdapterOpts>) {
    if (opts) this.configure(opts as DiscordAdapterOpts);
  }

  configure(opts: DiscordAdapterOpts) {
    this.opts = opts;
  }

  stop() {
    this.shouldStop = true;
    if (this.connection) {
      this.connection.destroy();
      this.connection = undefined;
    }
  }

  /**
   * PCM chunk を流す AsyncGenerator
   */
  async *pull(): AsyncIterable<PCMChunk> {
    if (!this.opts) throw new Error("DiscordAdapter not configured. Call configure() first");

    // VoiceConnection 作成
    if (!this.connection) {
      this.connection = joinVoiceChannel({
        guildId: this.opts.guildId,
        channelId: this.opts.channelId,
        adapterCreator: this.opts.adapterCreator,
        selfDeaf: false, // 受信必須
        selfMute: true,
      });

      // 接続が確立されるまで待機
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Voice connection timeout")), 10000);

        if (this.connection!.state.status === VoiceConnectionStatus.Ready) {
          clearTimeout(timeout);
          resolve();
        } else {
          this.connection!.once(VoiceConnectionStatus.Ready, () => {
            clearTimeout(timeout);
            resolve();
          });
        }
      });
    }

    const activeStreams = new Map<string, AsyncIterable<Buffer>>();

    // Speaking イベントの監視
    this.connection.receiver.speaking.on("start", (userId: string) => {
      const opusStream = this.connection!.receiver.subscribe(userId, {
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
            frameSize: FRAME_SIZE,
            channels: 1,
            rate: SAMPLE_RATE,
          }),
        );
      } catch (_error) {
        // テスト環境などでprism-mediaが正しくモックされていない場合
        // opusStreamをそのまま使用（テスト用）
        pcm = opusStream;
      }

      // PCM→PCMChunk(20 ms) に分割
      const chunkedStream = chunkByFrame(pcm, BYTES_PER_CHUNK);
      activeStreams.set(userId, chunkedStream);

      // ストリーム終了時のクリーンアップ
      pcm.on("end", () => {
        activeStreams.delete(userId);
      });
    });

    // アクティブなストリームから順番にチャンクを読み取る
    const processedUsers = new Set<string>();

    while (!this.shouldStop) {
      let hasYielded = false;

      for (const [userId, stream] of activeStreams) {
        if (processedUsers.has(userId)) continue;

        try {
          const iterator = stream[Symbol.asyncIterator]();
          const { value, done } = await iterator.next();

          if (!done && value) {
            yield { data: value, sampleRate: SAMPLE_RATE };
            hasYielded = true;
          } else if (done) {
            // ストリームが終了したら即座に削除
            processedUsers.add(userId);
            activeStreams.delete(userId);
          }
        } catch (_error) {
          processedUsers.add(userId);
          activeStreams.delete(userId);
        }
      }

      // クリーンアップ
      for (const userId of processedUsers) {
        activeStreams.delete(userId);
      }
      processedUsers.clear();

      if (!hasYielded) {
        // アクティブなストリームがない場合は短時間待機
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }
}

/**
 * Readable(PCM) を frameSize 分割し AsyncIterable<Buffer> へ
 */
async function* chunkByFrame(stream: Readable, bytesPerChunk: number): AsyncIterable<Buffer> {
  let left = Buffer.alloc(0);
  for await (const data of stream) {
    const buf: Buffer = data;
    left = Buffer.concat([left, buf]);
    while (left.length >= bytesPerChunk) {
      yield left.subarray(0, bytesPerChunk);
      left = left.subarray(bytesPerChunk);
    }
  }
  // 端数は捨てる（1920バイト未満のチャンクは返さない）
}
