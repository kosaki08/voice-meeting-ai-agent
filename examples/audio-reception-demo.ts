#!/usr/bin/env node
/**
 * Discord Voice Channel Audio Reception Demo
 *
 * Discord VCから音声データを受信するデモ
 *
 * 使用方法:
 *   1. .env.localに必要な環境変数を設定
 *   2. pnpm example:audio を実行
 *   3. 指定されたVCで話す
 */
import path from "path";
import { Client, GatewayIntentBits, VoiceChannel } from "discord.js";
import dotenv from "dotenv";
import { DiscordAdapter } from "../src/adapters/audio/discordAdapter.js";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

const DISCORD_TOKEN_RECEIVER = process.env.DISCORD_TOKEN_RECEIVER;
const GUILD_ID = process.env.GUILD_ID;
const VC_ID = process.env.VC_ID;

if (!DISCORD_TOKEN_RECEIVER || !GUILD_ID || !VC_ID) {
  console.error("環境変数が設定されていません。.env.localを確認してください。");
  process.exit(1);
}

async function audioReceptionDemo() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  console.log("Discordにログイン中...");
  await client.login(DISCORD_TOKEN_RECEIVER);

  await new Promise<void>((resolve) => {
    if (client.isReady()) resolve();
    else client.once("ready", () => resolve());
  });

  const guild = await client.guilds.fetch(GUILD_ID!);
  const channel = (await guild.channels.fetch(VC_ID!)) as VoiceChannel;

  console.log(`接続先: ${guild.name} / ${channel.name}`);

  const adapter = new DiscordAdapter({
    guildId: guild.id,
    channelId: channel.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfId: client.user!.id,
  });

  console.log("音声受信デモ開始 (30秒間)");
  console.log("VCで話すと音声データの受信を確認できます。");

  let chunkCount = 0;
  const startTime = Date.now();

  for await (const _chunk of adapter.pull()) {
    chunkCount++;

    if (chunkCount === 1) {
      console.log("✓ 音声受信開始！");
    }

    if (chunkCount % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ${chunkCount} chunks (${elapsed}秒経過)`);
    }

    if (Date.now() - startTime > 30000) {
      break;
    }
  }

  console.log("=== 結果 ===");
  console.log(`受信チャンク数: ${chunkCount}`);
  console.log(`受信時間: ${((chunkCount * 20) / 1000).toFixed(1)}秒`);
  console.log(chunkCount > 0 ? "✓ 音声受信成功" : "✗ 音声を受信できませんでした");

  await client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => {
  console.log("終了します...");
  process.exit(0);
});

audioReceptionDemo().catch(console.error);
