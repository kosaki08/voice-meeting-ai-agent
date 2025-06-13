// パスエイリアスのテスト
import { DiscordAdapter } from "@adapters/audio/discordAdapter.js";
import { AudioSourcePort } from "@ports/AudioSourcePort.js";

console.log("Voice Meeting AI Agent");

// 型チェックのみ（実行時エラーを避けるため）
const _typeCheck: AudioSourcePort = new DiscordAdapter();
