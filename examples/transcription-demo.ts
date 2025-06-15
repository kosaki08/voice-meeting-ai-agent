// 転写デモ: Discord音声チャンネルからWhisperで文字起こし

import { DiscordAdapter } from "@adapters/audio/discordAdapter.js";
import { WhisperAdapter } from "@adapters/transcriber/WhisperAdapter.js";
import { env } from "@core/env.js";
import { TranscriptionService } from "@core/TranscriptionService.js";
import { Client, GatewayIntentBits, Guild } from "discord.js";
import dotenv from "dotenv";

// 環境変数を読み込み
dotenv.config({ path: ".env.local" });

async function main() {
  // 環境変数チェック
  try {
    // envを使うことで自動的に検証される
    const config = env;

    if (!config.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is required for transcription");
      process.exit(1);
    }
  } catch (error) {
    console.error("Environment variable validation failed:");
    console.error(error);
    console.error("Please copy .env.local.example to .env.local and fill in the values");
    process.exit(1);
  }

  console.log("Starting Voice Meeting AI Agent with Whisper transcription...");

  // Discord クライアントを初期化
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  await client.login(env.DISCORD_BOT_TOKEN);
  await new Promise((resolve) => client.once("ready", resolve));

  // Guild を取得
  const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID) as Guild;
  if (!guild) {
    console.error(`Guild ${env.DISCORD_GUILD_ID} not found`);
    process.exit(1);
  }

  // アダプタを初期化
  const audioSource = new DiscordAdapter();
  audioSource.configure({
    guildId: env.DISCORD_GUILD_ID,
    channelId: env.DISCORD_CHANNEL_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfId: client.user?.id || "",
  });

  const transcriber = new WhisperAdapter();

  // 転写サービスを作成
  const service = new TranscriptionService({
    audioSource,
    transcriber,
    onSegment: (segment) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${segment.text}`);
      console.log(`  Duration: ${segment.startMs}-${segment.endMs}ms, Final: ${segment.isFinal}`);
    },
    onError: (error) => {
      console.error("Transcription error:", error);
    },
  });

  // シグナルハンドラを設定
  const shutdown = () => {
    console.log("\nShutting down gracefully...");
    service.stop();
    client.destroy();
    setTimeout(() => process.exit(0), 1000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // サービスを開始
  try {
    await service.start();
  } catch (error) {
    console.error("Failed to start service:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
