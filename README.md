# Voice Meeting AI Agent

Discord Voice Channel から音声をリアルタイムに取得し、OpenAI Whisper APIで文字起こしを行うプロジェクトです。

## デモ

```bash
pnpm example:audio
```

## Quick Start

```bash
pnpm install                      # 依存解決
cp .env.local.example .env.local  # トークン設定
# .env.local に以下を設定:
# - DISCORD_BOT_TOKEN
# - DISCORD_GUILD_ID
# - DISCORD_CHANNEL_ID
# - OPENAI_API_KEY (Whisper転写用)

# macOS/Linuxの場合、FFmpegの実行権限を確認
[ -f node_modules/ffmpeg-static/ffmpeg ] && chmod +x node_modules/ffmpeg-static/ffmpeg || true

pnpm dev                          # 実行
```

## ディレクトリ構成

詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) に記載しています。

```
src/
  core/       # ドメインロジック
  ports/      # 抽象 I/F
  adapters/   # Discord・Whisper 等
tests/        # unit / integration
examples/     # 実行サンプル
```

## 技術スタック

- **TypeScript 5 / pnpm** - 型安全性とモダンなパッケージ管理
- **discord.js 14 + @discordjs/voice** - Discord音声チャンネル接続
- **OpenAI Whisper API** - リアルタイム音声認識
- **ffmpeg (child_process)** - 音声ストリームのリサンプリング (48kHz → 16kHz)
- **Hexagonal Architecture** - 音声入力源・転写エンジンの切り替え
- **Jest + ts-jest** - 高速なテスト実行
- **GitHub Actions CI** - 自動テスト・カバレッジ計測

## スクリプト

| コマンド          | 説明              |
| ----------------- | ----------------- |
| `pnpm dev`        | 開発サーバー起動  |
| `pnpm test`       | 全テスト実行      |
| `pnpm build`      | tsup ビルド       |
| `pnpm lint`       | ESLint チェック   |
| `pnpm type-check` | TypeScript 型検証 |

具体例は [examples/README.md](examples/README.md) に記載しています。

## ドキュメント

- [アーキテクチャ詳細](docs/ARCHITECTURE.md) - アーキテクチャ詳細
- [テスト戦略](docs/TESTING.md) - テスト戦略
- [ループバックテスト](examples/loopback/README.md) - 手動実行用の音声テストサンプル

## License

MIT License
