# Discord ループバックテスト

このディレクトリには、手動実行用のDiscordループバックテストが含まれています。

## 概要

Discord の仕様により、Bot は他の Bot の音声を受信できません。このテストは主に以下を検証します：

1. 両方の Bot が正しく Voice Channel に接続できること
2. 送信側 Bot が音声を再生できること
3. 受信側の処理が正しく動作すること（音声は受信できないが）

## 実行方法

### 1. 環境変数の設定

`.env.local` ファイルに以下の環境変数を設定してください：

```env
# 受信用 Bot (Bot A)
DISCORD_BOT_TOKEN=XXXX_YOUR_RECEIVER_BOT_TOKEN_XXXX

# 送信用 Bot (Bot B) - ループバックテスト専用
DISCORD_TOKEN_SENDER=XXXX_YOUR_SENDER_BOT_TOKEN_XXXX

# Discord リソース ID
DISCORD_GUILD_ID=111111111111111111
DISCORD_CHANNEL_ID=222222222222222222
```

### 2. テストの実行

```bash
# 手動でループバックテストを実行
pnpm tsx examples/loopback/discordLoopback.test.ts
```

## 注意事項

- このテストは CI では実行されません
- 2つの異なる Bot トークンが必要です
- Discord の Rate Limit に注意してください
- 実際の音声受信テストには、人間のユーザーが Voice Channel で話す必要があります

## 代替テスト方法

- `discordAdapterMock.integration.test.ts`: モックを使用した統合テスト
- `audio-reception-demo.ts`: 実際の音声受信デモ（人間のユーザーが必要）
