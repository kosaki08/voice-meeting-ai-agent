# Voice Meeting AI Agent

Discord音声のリアルタイム処理を行うAIエージェントシステム

## アーキテクチャ

Hexagonal Architecture（ポート&アダプタパターン）を採用し、音声入力源の切り替えを容易にしています。

```
src/
├─ core/            # ドメインロジック（純粋関数）
├─ ports/           # 抽象インターフェース
├─ adapters/        # 外部依存（Discord, Whisper など）
└─ index.ts         # エントリーポイント
tests/              # 単体・統合テスト
```

## 技術スタック

- **TypeScript** - 型安全性とDXの向上
- **discord.js / @discordjs/voice** - Discord音声チャンネル接続
- **Hexagonal Architecture** - 依存関係の分離と拡張性
- **Jest** - 単体テスト・統合テスト
- **GitHub Actions** - CI/CD

## 必要環境

| Tool    | Version      |
| ------- | ------------ |
| Node.js | 18 / 20 / 22 |
| pnpm    | 10.6.4       |

## セットアップ

```bash
# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.local.example .env.local
# .env.localに Discord Bot の認証情報を設定
```

## 開発

```bash
pnpm dev         # 開発サーバー起動
pnpm build       # ビルド
pnpm test        # テスト実行
pnpm lint        # ESLint
pnpm type-check  # 型チェック
```

## 使用例

音声受信のデモ：

```bash
pnpm example:audio
```

詳細は[examples/README.md](examples/README.md)を参照してください。
pnpm type-check # TypeScript型チェック

````

## テスト戦略

### 単体テスト

各アダプターとコアロジックの動作を独立して検証：

```bash
pnpm test        # 全テスト実行
pnpm test:watch  # ウォッチモード
````

### 統合テスト

実際のDiscord環境での動作を検証（要認証情報）：

```bash
pnpm test:integration
```

**注意事項**：

- Discord の仕様により、Bot は他の Bot が送信した音声を受信できません
- 音声受信テストには、実際の人間ユーザーが VC で話す必要があります
- 自動テストでは、実接続の確認とモック音声の注入によるテストを組み合わせています

## 動作確認

音声受信が正しく動作することを確認するには：

```bash
# サンプルコードの実行
pnpm example:audio
```

または、以下のような簡単なコードで確認できます：

```typescript
import { DiscordAdapter } from "./src/adapters/audio/discordAdapter.js";

const adapter = new DiscordAdapter({
  guildId: "YOUR_GUILD_ID",
  channelId: "YOUR_CHANNEL_ID",
  adapterCreator: guild.voiceAdapterCreator,
  selfId: client.user.id,
});

for await (const chunk of adapter.pull()) {
  console.log(`Received ${chunk.data.length} bytes at ${chunk.sampleRate}Hz`);
}
```

**注意**: Discord Botは他のBotの音声を受信できません。テストには人間のユーザーがVCで話す必要があります。

## ライセンス

MIT License
