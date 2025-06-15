// パスエイリアスのテスト
import { DiscordAdapter } from "@adapters/audio/discordAdapter.js";
import { WhisperAdapter } from "@adapters/transcriber/WhisperAdapter.js";
import { TranscriptionService } from "@core/TranscriptionService.js";
import { AudioSourcePort } from "@ports/AudioSourcePort.js";
import { TranscriberPort } from "@ports/TranscriberPort.js";

console.log("Voice Meeting AI Agent");

// 型チェックのみ（実行時エラーを避けるため）
const _typeCheck: AudioSourcePort = new DiscordAdapter();
const _typeCheck2: TranscriberPort = new WhisperAdapter();

// 使用例（実際の実装では環境変数から設定を読み込む）
async function _main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set, skipping transcription");
    return;
  }

  const audioSource = new DiscordAdapter();
  const transcriber = new WhisperAdapter();

  const service = new TranscriptionService({
    audioSource,
    transcriber,
    onSegment: (segment) => {
      console.log(`[${segment.startMs}-${segment.endMs}ms] ${segment.text}`);
    },
    onError: (error) => {
      console.error("Transcription error:", error);
    },
  });

  // Ctrl+C でクリーン終了
  process.on("SIGINT", () => {
    console.log("\nStopping transcription service...");
    service.stop();
    process.exit(0);
  });

  try {
    console.log("Starting transcription service...");
    await service.start();
  } catch (error) {
    console.error("Service error:", error);
    process.exit(1);
  }
}

// コメントアウトして実行を防ぐ（必要に応じて有効化）
// _main().catch(console.error);
