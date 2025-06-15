import type { AudioSourcePort } from "@ports/AudioSourcePort.js";
import type { TranscriberPort, TranscriptSegment } from "@ports/TranscriberPort.js";

export interface TranscriptionServiceOptions {
  audioSource: AudioSourcePort;
  transcriber: TranscriberPort;
  onSegment?: (segment: TranscriptSegment) => void;
  onError?: (error: Error) => void;
}

/**
 * 音声ソースから転写を管理するサービス
 */
export class TranscriptionService {
  private readonly audioSource: AudioSourcePort;
  private readonly transcriber: TranscriberPort;
  private readonly onSegment?: (segment: TranscriptSegment) => void;
  private readonly onError?: (error: Error) => void;
  private abortController = new AbortController();
  private isRunning = false;

  constructor(options: TranscriptionServiceOptions) {
    this.audioSource = options.audioSource;
    this.transcriber = options.transcriber;
    this.onSegment = options.onSegment;
    this.onError = options.onError;
  }

  /**
   * 転写処理を開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("TranscriptionService is already running");
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      // 音声取得と転写結果の処理を並行実行
      await Promise.all([this.processAudioStream(), this.processTranscriptStream()]);
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        this.handleError(error as Error);
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 転写処理を停止
   */
  stop(): void {
    this.abortController.abort();
    this.transcriber.stop();
    this.isRunning = false;
  }

  /**
   * 音声ストリームを処理
   */
  private async processAudioStream(): Promise<void> {
    try {
      for await (const chunk of this.audioSource.pull()) {
        if (this.abortController.signal.aborted) {
          break;
        }
        await this.transcriber.push(chunk);
      }
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        throw error;
      }
    } finally {
      // 音声ストリームが終了したら転写も停止
      this.transcriber.stop();
    }
  }

  /**
   * 転写結果ストリームを処理
   */
  private async processTranscriptStream(): Promise<void> {
    try {
      for await (const segment of this.transcriber.stream()) {
        if (this.abortController.signal.aborted) {
          break;
        }
        if (this.onSegment) {
          this.onSegment(segment);
        }
      }
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        throw error;
      }
    }
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: Error): void {
    console.error("TranscriptionService error:", error);
    if (this.onError) {
      this.onError(error);
    }
  }

  /**
   * サービスが実行中かどうか
   */
  get running(): boolean {
    return this.isRunning;
  }
}
