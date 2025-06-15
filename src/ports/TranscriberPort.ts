import type { PCMChunk } from "./AudioSourcePort.js";

export interface TranscriptSegment {
  text: string; // リアルタイムに届く文字列
  startMs: number; // 音声開始位置（ms）
  endMs: number; // 音声終了位置（ms）
  isFinal: boolean; // Whisper から 'final' が来たら true
}

export interface TranscriberPort {
  /**
   * DiscordAdapter からの PCMChunk を流し込む
   */
  push(chunk: PCMChunk): Promise<void>;

  /**
   * 非同期イテレータで逐次 TranscriptSegment を受け取る
   */
  stream(): AsyncIterable<TranscriptSegment>;

  /**
   * 終了時のクリーンアップ
   */
  stop(): void;
}
