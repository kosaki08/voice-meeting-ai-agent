import type { AudioSourcePort, PCMChunk } from "@ports/AudioSourcePort.js";

/**
 * テスト用のDiscordAdapterモック
 */
export class DiscordAdapterMock implements AudioSourcePort {
  private chunks: PCMChunk[] = [];
  private currentIndex = 0;

  /**
   * テスト用の音声チャンクを設定
   */
  setAudioChunks(chunks: PCMChunk[]): void {
    this.chunks = chunks;
    this.currentIndex = 0;
  }

  /**
   * 設定されたチャンクを順次返す
   */
  async *pull(): AsyncIterable<PCMChunk> {
    while (this.currentIndex < this.chunks.length) {
      yield this.chunks[this.currentIndex++];
      // 実際のストリーミングをシミュレート
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  /**
   * モックをリセット
   */
  reset(): void {
    this.currentIndex = 0;
  }
}
