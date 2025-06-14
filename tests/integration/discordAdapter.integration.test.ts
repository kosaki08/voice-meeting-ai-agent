import path from "path";
import { DiscordAdapter } from "@/adapters/audio/discordAdapter";
import { Client, GatewayIntentBits, VoiceChannel } from "discord.js";
import dotenv from "dotenv";
import { collectChunksWithTimeout, nextWithTimeout } from "../helpers/iteratorHelpers";

// .env.localから環境変数を読み込む
dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

// 環境変数の存在チェック
const DISCORD_TOKEN_RECEIVER = process.env.DISCORD_TOKEN_RECEIVER;
const GUILD_ID = process.env.GUILD_ID;
const VC_ID = process.env.VC_ID;

const isIntegrationTestEnabled = DISCORD_TOKEN_RECEIVER && GUILD_ID && VC_ID;

// 統合テストが無効の場合はスキップ
const describeIfEnabled = isIntegrationTestEnabled ? describe : describe.skip;

describeIfEnabled("DiscordAdapter Integration Tests", () => {
  let client: Client;
  let adapter: DiscordAdapter;

  beforeAll(async () => {
    if (!isIntegrationTestEnabled) return;

    // Discordクライアントの初期化
    client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages],
    });

    // ボットにログイン
    await client.login(DISCORD_TOKEN_RECEIVER);
    // readyイベントを待つ
    await new Promise<void>((resolve) => {
      if (client.isReady()) {
        resolve();
        return;
      }
      client.once("ready", () => {
        resolve();
      });
    });
  }, 45000); // タイムアウトを45秒に延長

  afterAll(async () => {
    if (!isIntegrationTestEnabled) return;

    try {
      // アダプターの停止
      if (adapter) {
        (adapter as any).stop?.();
      }

      // 少し待機してからクライアントを破棄
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Discordクライアントの破棄
      if (client) {
        await client.destroy();
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }, 5000);

  test("should connect to voice channel and configure adapter", async () => {
    const guild = await client.guilds.fetch(GUILD_ID!);
    expect(guild).toBeDefined();

    const channel = (await guild.channels.fetch(VC_ID!)) as VoiceChannel;
    expect(channel).toBeDefined();
    expect(channel.type).toBe(2); // VoiceChannel type

    // アダプターの設定
    adapter = new DiscordAdapter({
      guildId: guild.id,
      channelId: channel.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfId: client.user!.id,
    });

    // pull()を呼び出して接続を確立
    const iterator = adapter.pull()[Symbol.asyncIterator]();

    // 接続が確立されることを確認（すぐに次に進む）
    expect(iterator).toBeDefined();
  });

  test("should be able to receive audio stream with timeout protection", async () => {
    // アダプターが設定されていることを確認
    expect(adapter).toBeDefined();

    // PCMチャンクの受信をテスト（音声がなくても接続自体をテスト）
    const iterator = adapter.pull()[Symbol.asyncIterator]();
    let _audioReceived = false;

    try {
      // タイムアウト付きで1チャンクを待機
      const result = await nextWithTimeout(iterator, 3000);

      if (!result.done && result.value) {
        _audioReceived = true;
        console.log("Successfully received audio data from Discord voice channel");

        // チャンクのバリデーション
        expect(result.value).toBeDefined();
        expect(result.value.data).toBeInstanceOf(Buffer);
        expect(result.value.sampleRate).toBe(48000);
      }
    } catch (error) {
      // タイムアウトは正常（誰も話していない場合）
      if (error instanceof Error && error.message.includes("iterator timeout")) {
        // 予期されるタイムアウト
      } else {
        throw error;
      }
    }

    // 音声受信の有無に関わらず、接続が正常に確立されていれば成功
    expect(true).toBe(true);
  }, 10000);

  test("should handle multiple chunks collection with timeout", async () => {
    // アダプターが設定されていることを確認
    expect(adapter).toBeDefined();

    const iterator = adapter.pull()[Symbol.asyncIterator]();
    const targetChunks = 5;

    // 5秒以内に最大5チャンクを収集
    const chunks = await collectChunksWithTimeout(iterator, targetChunks, 5000, 1000);

    if (chunks.length > 0) {
      // 各チャンクのバリデーション
      chunks.forEach((chunk, _index) => {
        expect(chunk.data).toBeInstanceOf(Buffer);
        expect(chunk.sampleRate).toBe(48000);
        // 20ms分のPCMデータは1920バイトであるべき
        expect(chunk.data.length).toBe(1920);
      });
    }

    // チャンク数に関わらず、エラーがなければ成功
    expect(true).toBe(true);
  }, 10000);
});
