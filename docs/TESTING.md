# テスト戦略

## テスト階層

### 1. Unit Tests (`tests/unit/`)

- **目的**: 各モジュールの動作を独立して検証
- **モック**: 外部依存は全てモック化
- **実行時間**: < 100ms/test
- **カバレッジ目標**: 80%以上

### 2. Integration Tests (`tests/integration/`)

- **目的**: 複数モジュールの連携を検証
- **環境**: 実際のDiscord接続（オプション）
- **実行時間**: < 5s/test
- **CI**: 環境変数がない場合はスキップ

### 3. E2E Tests (`tests/e2e/`)

- **目的**: エンドツーエンドのシナリオ検証
- **将来実装予定**

## テストユーティリティ

### iteratorHelpers

非同期イテレータのテスト用ヘルパー:

- `nextWithTimeout`: タイムアウト付きでnext()を呼ぶ
- `collectChunksWithTimeout`: 複数チャンクを収集

### voiceMock

Discord音声のモック生成:

- Opus/PCMストリームのシミュレーション
- 様々なシナリオ（無音、ノイズ等）

## CI/CD戦略

### GitHub Actions

```yaml
- Unit Tests: 全PR/pushで実行
- Integration Tests: 環境変数セット時のみ
- Coverage: Codecovに自動アップロード
```

### 環境変数管理

- `.env.local.example`: テンプレート提供
- CI: GitHub Secretsで管理
- ローカル: `.env.local`（gitignore）

## テストのベストプラクティス

### 1. AAA パターン

```typescript
it("should do something", () => {
  // Arrange
  const input = prepareTestData();

  // Act
  const result = doSomething(input);

  // Assert
  expect(result).toBe(expected);
});
```

### 2. Fake Timers

- Setup: `jest.useFakeTimers()`
- Cleanup: `afterEach`で自動復元

### 3. Discord特有の注意点

- Bot間の音声通信は不可
- テストには人間ユーザーが必要
- モックを活用した代替テスト

## トラブルシューティング

### よくある問題

1. **"Connection timeout"**

   - 原因: Discord APIレート制限
   - 対策: CI環境では長めのタイムアウト設定

2. **"Cannot find module"**

   - 原因: ESM/CJSの混在
   - 対策: `.js`拡張子を明示的に指定

3. **"Memory leak detected"**
   - 原因: イベントリスナーの未解放
   - 対策: `removeAllListeners()`を確実に呼ぶ
