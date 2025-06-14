# Examples

## audio-reception-demo.ts

Discord Voice Channelから音声データを受信するデモです。

### 実行方法

```bash
pnpm example:audio
```

### 必要な環境変数

`.env.local`に以下を設定してください：

```
DISCORD_TOKEN_RECEIVER=your_bot_token
GUILD_ID=your_guild_id
VC_ID=your_voice_channel_id
```

### 使用例

1. Botを招待したDiscordサーバーのVCに参加
2. スクリプトを実行
3. VCで話す
4. 音声データの受信を確認

### 注意事項

- 人間のユーザーがVCで話す必要があります（Botの音声は受信できません）
- Voice権限が必要です
