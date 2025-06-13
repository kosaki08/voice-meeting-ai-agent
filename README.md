# Voice Meeting AI Agent

Discord音声のリアルタイム処理を行うAIエージェントシステム

## ディレクトリ構成

```
src/
├─ core/            # ドメインロジック（純粋関数）
├─ ports/           # 抽象インターフェース
├─ adapters/        # 外部依存（Discord, Whisper など）
└─ index.ts         # エントリーポイント
tests/              # Jest テスト
```

## 必須ツール & Node サポート

| Tool    | Version                       |
| ------- | ----------------------------- |
| Node.js | 18 / 20 / 22 (CIでテスト)     |
| pnpm    | 10.6.4                        |
| ffmpeg  | 同梱の `ffmpeg-static` を使用 |

## セットアップ

### Node.js のインストール

```bash
asdf install
asdf local node 20.12.2
asdf local pnpm 10.6.4
```

### 依存パッケージのインストール

```bash
pnpm install
```

## 開発

```bash
pnpm dev       # 開発サーバー起動
pnpm test      # テスト実行
pnpm build     # ビルド
pnpm lint      # ESLint
pnpm format    # Prettier
```
