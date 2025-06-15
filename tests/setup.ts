import path from "path";
import dotenv from "dotenv";

// テストが実行される前に .env.local を読み込み
dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

// Fake Timersの自動リストア
afterEach(() => {
  // 各テスト後にFake Timersをリアルタイマーに戻す
  if (jest.isMockFunction(setTimeout)) {
    jest.useRealTimers();
  }
});

// グローバルタイムアウトの設定
jest.setTimeout(30000); // 30秒（CI環境用）

// Node.js未処理エラーのハンドリング
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
