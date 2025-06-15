import { spawn } from "node:child_process";
import type { PCMChunk } from "@ports/AudioSourcePort.js";
import type { TranscriberPort, TranscriptSegment } from "@ports/TranscriberPort.js";
import ffmpegPath from "ffmpeg-static";
import { OpenAI } from "openai";
import { toFile } from "openai/uploads";

// ffmpeg 実行パスの検証
if (!ffmpegPath) {
  throw new Error("ffmpeg-static path not found");
}

interface AudioBuffer {
  data: Buffer[];
  totalLength: number;
  startTime: number;
}

/**
 * PCMオーディオを48kHzから16kHzにリサンプリング（バッファ用）
 *
 * child_process.spawn を使用した直接的な ffmpeg 実行により、
 * deprecated な fluent-ffmpeg への依存を排除
 */
async function resamplePCMBuffer(pcmBuffer: Buffer, fromRate: number, toRate: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    // ffmpeg コマンドライン引数
    const args = [
      "-f",
      "s16le", // 入力フォーマット: 16bit signed little-endian
      "-ar",
      String(fromRate), // 入力サンプルレート
      "-ac",
      "1", // 入力チャンネル数: モノラル
      "-i",
      "pipe:0", // 標準入力から読み込み
      "-f",
      "s16le", // 出力フォーマット: 16bit signed little-endian
      "-ar",
      String(toRate), // 出力サンプルレート
      "-ac",
      "1", // 出力チャンネル数: モノラル
      "pipe:1", // 標準出力に出力
    ];

    const ffmpeg = spawn(ffmpegPath as string, args);

    // エラーハンドリング
    ffmpeg.stderr.on("data", (data) => {
      // ffmpeg のログは stderr に出力されるが、エラーとは限らない
      // テスト環境では出力しない
      if (process.env.NODE_ENV !== "test") {
        console.debug("ffmpeg log:", data.toString());
      }
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    // 出力データの収集
    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // 入力データの書き込み
    ffmpeg.stdin.on("error", (err) => {
      // EPIPE エラーは ffmpeg が先に終了した場合に発生する可能性があるため無視
      if (err.message.includes("EPIPE")) {
        return;
      }
      reject(err);
    });

    // データを書き込んで入力を閉じる
    ffmpeg.stdin.end(pcmBuffer);
  });
}

export class WhisperAdapter implements TranscriberPort {
  private readonly openai: OpenAI;
  private readonly controller = new AbortController();
  private readonly queue: TranscriptSegment[] = [];
  private isRunning = true;
  private isProcessing = false;
  private audioBuffer: AudioBuffer = { data: [], totalLength: 0, startTime: Date.now() };
  private processingTimer?: ReturnType<typeof setInterval>;
  private readonly chunkDurationMs: number;
  private readonly minChunkSize: number;
  private readonly model: string;
  private readonly globalStartTime: number;

  constructor(apiKey?: string, options?: { chunkDurationMs?: number; model?: string }) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.chunkDurationMs = options?.chunkDurationMs || parseInt(process.env.WHISPER_CHUNK_MS || "1000", 10);
    this.model = options?.model || process.env.WHISPER_MODEL || "whisper-1";
    this.minChunkSize = 16000 * 2 * 1; // 1秒分の16kHz mono PCM
    this.globalStartTime = Date.now();
    this.startProcessingLoop();
  }

  async push(chunk: PCMChunk): Promise<void> {
    if (!this.isRunning) {
      throw new Error("WhisperAdapter has been stopped");
    }

    if (chunk.sampleRate !== 48000) {
      throw new Error(`Unsupported sample rate: ${chunk.sampleRate}. Only 48kHz is supported.`);
    }

    // バッファに追加
    this.audioBuffer.data.push(chunk.data);
    this.audioBuffer.totalLength += chunk.data.length;
  }

  async *stream(): AsyncIterable<TranscriptSegment> {
    while (this.isRunning) {
      if (this.queue.length > 0) {
        const segment = this.queue.shift();
        if (segment) {
          yield segment;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    // 残りのキューを処理
    while (this.queue.length > 0) {
      const segment = this.queue.shift();
      if (segment) {
        yield segment;
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    this.controller.abort();
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    // 残りのバッファを処理
    this.processAudioBuffer(true).catch(console.error);
  }

  /**
   * 定期的にバッファを処理するループを開始
   */
  private startProcessingLoop(): void {
    this.processingTimer = setInterval(() => {
      this.processAudioBuffer().catch(console.error);
    }, this.chunkDurationMs);
  }

  /**
   * バッファ内のオーディオを処理
   */
  private async processAudioBuffer(force = false): Promise<void> {
    // 既に処理中の場合はスキップ（同時実行防止）
    if (this.isProcessing && !force) {
      console.log("WhisperAdapter: Skipping processAudioBuffer - already processing");
      return;
    }

    // 最小サイズに満たない場合はスキップ（強制処理でない限り）
    if (!force && this.audioBuffer.totalLength < this.minChunkSize) {
      return;
    }

    if (this.audioBuffer.data.length === 0) {
      return;
    }

    this.isProcessing = true;
    try {
      // バッファを結合
      const pcmBuffer = Buffer.concat(this.audioBuffer.data);
      const startTime = this.audioBuffer.startTime;

      // バッファをリセット
      this.audioBuffer = { data: [], totalLength: 0, startTime: Date.now() };

      // 48kHz から 16kHz にリサンプリング
      const resampled = await resamplePCMBuffer(pcmBuffer, 48000, 16000);

      // WAVヘッダーを追加
      const wavBuffer = this.addWavHeader(resampled, 16000);

      // Whisper APIに送信
      const response = await this.openai.audio.transcriptions.create({
        file: await toFile(wavBuffer, "audio.wav", { type: "audio/wav" }),
        model: this.model,
        language: "ja",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      // レスポンスを処理
      if (response && response.text && response.text.trim()) {
        const segment: TranscriptSegment = {
          text: response.text,
          startMs: startTime - this.globalStartTime,
          endMs: Date.now() - this.globalStartTime,
          isFinal: true,
        };

        // セグメント情報があれば使用
        const segments = (response as { segments?: Array<{ text: string; start?: number; end?: number }> }).segments;
        if (segments && segments.length > 0) {
          for (const seg of segments) {
            this.queue.push({
              text: seg.text,
              startMs: (seg.start || 0) * 1000 + (startTime - this.globalStartTime),
              endMs: (seg.end || 0) * 1000 + (startTime - this.globalStartTime),
              isFinal: true,
            });
          }
        } else {
          this.queue.push(segment);
        }
      }
    } catch (error) {
      console.error("Error processing audio buffer:", error);
      // エラーが発生してもアダプタは停止しない
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * PCMデータにWAVヘッダーを追加
   * 16-bit little-endian mono PCM形式を前提としています
   * 24-bit / stereo 拡張時はこのメソッドを修正します
   */
  private addWavHeader(pcmBuffer: Buffer, sampleRate: number): Buffer {
    const channels = 1; // mono
    const bitDepth = 16; // 16-bit
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const fileSize = dataSize + headerSize - 8;

    const buffer = Buffer.alloc(headerSize + dataSize);

    // RIFF chunk
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(fileSize, 4);
    buffer.write("WAVE", 8);

    // fmt chunk
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16); // chunk size
    buffer.writeUInt16LE(1, 20); // audio format (PCM)
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28); // byte rate = sampleRate * channels * bytesPerSample
    buffer.writeUInt16LE(channels * (bitDepth / 8), 32); // block align = channels * bytesPerSample
    buffer.writeUInt16LE(bitDepth, 34);

    // data chunk
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Copy PCM data
    pcmBuffer.copy(buffer, headerSize);

    return buffer;
  }
}
