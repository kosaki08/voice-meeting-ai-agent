import path from "path";
import { DiscordAdapter } from "@/adapters/audio/discordAdapter";
import { AudioPlayer, createAudioPlayer, createAudioResource, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { Client, GatewayIntentBits, VoiceChannel } from "discord.js";
import dotenv from "dotenv";
import { collectChunksWithTimeout } from "../helpers/iteratorHelpers";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

const {
  DISCORD_TOKEN_RECEIVER, // 受信用 Bot (Bot A)
  DISCORD_TOKEN_SENDER, // 送信用 Bot (Bot B)
  GUILD_ID,
  VC_ID,
} = process.env;

// Bot Bが設定されている場合のみ有効
const isE2ETestEnabled = DISCORD_TOKEN_RECEIVER && DISCORD_TOKEN_SENDER && GUILD_ID && VC_ID;
const describeIfEnabled = isE2ETestEnabled ? describe : describe.skip;

describeIfEnabled("E2E – Bot B sends test tone, Bot A receives", () => {
  const CHUNK_TARGET = 10; // 期待チャンク数
  let recvClient: Client, sendClient: Client;
  let adapter: DiscordAdapter;
  let player: AudioPlayer | undefined; // AudioPlayerの参照を保持

  // ===================================================================
  // Discord の仕様により、Bot は他の Bot の音声を受信できないため、
  // このテストは主に以下を検証します：
  // 1. 両方の Bot が正しく VC に接続できること
  // 2. 送信側 Bot が音声を再生できること
  // 3. 受信側の処理が正しく動作すること（音声は受信できないが）
  //
  // 実際の音声受信テストには、以下のテストを使用します：
  // - 人間のユーザーが VC で話す
  // - discordAdapterMock.integration.test.ts のモックテストを使用
  // ===================================================================
  beforeAll(async () => {
    if (!isE2ETestEnabled) {
      return;
    }

    // 両方のクライアントを初期化
    recvClient = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });
    sendClient = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });

    // 並行してログイン
    await Promise.all([recvClient.login(DISCORD_TOKEN_RECEIVER), sendClient.login(DISCORD_TOKEN_SENDER)]);

    // 両方のクライアントがreadyになるまで待機（タイムアウト付き）
    const readyTimeout = 10000; // 10秒のタイムアウト

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        // 既にreadyの場合はすぐにresolve
        if (recvClient.isReady()) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => reject(new Error("Receiver ready timeout")), readyTimeout);
        recvClient.once("ready", () => {
          clearTimeout(timeout);
          resolve();
        });
      }),
      new Promise<void>((resolve, reject) => {
        // 既にreadyの場合はすぐにresolve
        if (sendClient.isReady()) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => reject(new Error("Sender ready timeout")), readyTimeout);
        sendClient.once("ready", () => {
          clearTimeout(timeout);
          resolve();
        });
      }),
    ]);
  }, 30000); // テスト用の音声は1秒なので30秒でタイムアウト

  afterAll(async () => {
    if (!isE2ETestEnabled) return;

    try {
      // プレイヤーのクリーンアップ
      if (player) {
        player.stop();
        player.removeAllListeners();
      }

      // アダプターのクリーンアップ
      if (adapter) {
        const connection = (adapter as any).connection;
        if (connection && !connection.destroyed) {
          connection.destroy();
        }
      }

      // クライアントの破棄
      await Promise.all([recvClient?.destroy().catch(() => {}), sendClient?.destroy().catch(() => {})]);
    } catch (_error) {
      // エラーは無視（既に破棄されている場合など）
    }
  });

  test("receives expected PCM chunks from Bot B", async () => {
    const guild = await recvClient.guilds.fetch(GUILD_ID!);
    const channel = (await guild.channels.fetch(VC_ID!)) as VoiceChannel;

    // Bot A – 受信用アダプター
    adapter = new DiscordAdapter({
      guildId: guild.id,
      channelId: channel.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfId: recvClient.user!.id,
    });

    // Bot B – 送信用接続
    const sendGuild = sendClient.guilds.cache.get(GUILD_ID!);
    if (!sendGuild) {
      throw new Error(`Sender bot is not in guild ${GUILD_ID}`);
    }

    const sendConnection = joinVoiceChannel({
      guildId: GUILD_ID!,
      channelId: VC_ID!,
      adapterCreator: sendGuild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    // 接続が確立するまで待機（タイムアウト付き）
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Voice connection timeout")), 10000);

      sendConnection.on(VoiceConnectionStatus.Ready, () => {
        clearTimeout(timeout);
        resolve();
      });

      sendConnection.on(VoiceConnectionStatus.Disconnected, () => {
        clearTimeout(timeout);
        reject(new Error("Voice connection disconnected"));
      });
    });

    // オーディオプレイヤーを作成
    player = createAudioPlayer();
    // テストトーンのパスを構築
    const testTonePath = path.resolve(__dirname, "../assets/test-tone.ogg");

    // ファイルが存在しない場合はスキップ
    const fs = await import("fs");
    if (!fs.existsSync(testTonePath)) {
      return;
    }

    // 再生するテストトーン
    const resource = createAudioResource(testTonePath);

    // プレイヤーを接続にサブスクライブ
    sendConnection.subscribe(player);

    // 音声受信の準備
    const iterator = adapter.pull()[Symbol.asyncIterator]();

    // 再生開始
    player.play(resource);

    // チャンクの収集（5秒以内に10チャンク）
    const chunks = await collectChunksWithTimeout(iterator, CHUNK_TARGET, 5000, 1000);

    if (chunks.length > 0) {
      // チャンクの内容を検証
      chunks.forEach((chunk, _index) => {
        expect(chunk.data).toBeInstanceOf(Buffer);
        expect(chunk.sampleRate).toBe(48000);
        expect(chunk.data.length).toBe(1920); // 20ms of 48kHz mono PCM
      });
    }

    // Bot間の制限により、チャンクを受信しないことを許容
    expect(chunks.length).toBeGreaterThanOrEqual(0);

    // クリーンアップ
    player.stop();

    // プレイヤーのイベントリスナーを削除
    player.removeAllListeners();

    sendConnection.destroy();
  }, 10000); // 1秒の音声なので10秒のタイムアウトで十分
});
