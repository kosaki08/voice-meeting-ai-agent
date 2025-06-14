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
