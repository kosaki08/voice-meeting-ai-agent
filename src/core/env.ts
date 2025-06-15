import dotenv from "dotenv";
import { z } from "zod";

// .env.localファイルを読み込む
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local" });
}

// 環境変数のスキーマ定義
const envSchema = z.object({
  // Discord Bot設定
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DISCORD_GUILD_ID: z.string().min(1, "DISCORD_GUILD_ID is required"),
  DISCORD_CHANNEL_ID: z.string().min(1, "DISCORD_CHANNEL_ID is required"),

  // OpenAI API（オプション）
  OPENAI_API_KEY: z.string().optional(),

  // Whisper設定
  WHISPER_MODEL: z.string().default("whisper-1"),
  WHISPER_CHUNK_MS: z.preprocess((val) => (typeof val === "string" ? parseInt(val, 10) : val), z.number().int().positive().default(1000)),

  // Anthropic API（オプション）
  ANTHROPIC_API_KEY: z.string().optional(),

  // Slack（オプション）
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_CHANNEL_ID: z.string().optional(),

  // Node環境
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CI: z.string().optional(),
});

// 環境変数の型定義
export type Env = z.infer<typeof envSchema>;

// 環境変数の検証とエクスポート
export const env = envSchema.parse(process.env);
