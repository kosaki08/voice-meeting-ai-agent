# Voice Meeting AI Agent

Discord Voice Channel から音声をリアルタイムに取得し、後から Whisperでの文字起こしを差し込める形に切り出したプロジェクトです。

- Whisper統合作業ブランチ: [feature/whisper-integration](https://github.com/kosaki08/voice-meeting-ai-agent/tree/feature/whisper-integration)

## デモ

```bash
pnpm example:audio
```

## Quick Start

```bash
pnpm install                      # 依存解決
cp .env.local.example .env.local  # トークン設定
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
- **Hexagonal Architecture** - 音声入力源の切り替えが容易
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
