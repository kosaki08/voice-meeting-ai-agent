# アーキテクチャ詳細

## Hexagonal Architecture（ポート&アダプタパターン）

このプロジェクトでは、Hexagonal Architectureを採用しています。

```
src/
├─ core/                    # ドメインロジック（純粋関数）
│   ├─ Transcript.ts       # 音声転写結果のドメインモデル
│   └─ env.ts              # 環境変数管理
├─ ports/                   # 抽象インターフェース
│   ├─ AudioSourcePort.ts   # 音声入力の抽象化
│   ├─ TranscriberPort.ts   # 文字起こしの抽象化
│   └─ NotifierPort.ts      # 通知の抽象化
├─ adapters/                # 外部依存の実装
│   ├─ audio/
│   │   └─ discordAdapter.ts # Discord音声チャンネル接続
│   │   └─ discord/         # Discord関連のサブモジュール
│   │       ├─ ConnectionManager.ts  # 接続管理
│   │       └─ ChunkStreamer.ts     # 音声ストリーミング処理
│   └─ (将来的にWhisper, Slack等)
└─ utils/                   # ユーティリティ関数
    └─ chunkByFrame.ts      # PCMデータのチャンク分割
```

## 拡張

### 新しい音声ソースの追加

```typescript
// 1. AudioSourcePortを実装
export class ZoomAdapter implements AudioSourcePort {
  async *pull(): AsyncIterable<PCMChunk> {
    // Zoom SDK を使った実装
  }
}

// 2. index.tsで切り替え
const audioSource = process.env.SOURCE === "zoom" ? new ZoomAdapter() : new DiscordAdapter();
```

### パイプライン構成

```
Discord/Zoom → PCM → Whisper → Claude → Slack
     ↑           ↑        ↑        ↑        ↑
AudioSource  Transcriber  Formatter  Summarizer  Notifier
```

各ステージは Port で抽象化され、実装を差し替え可能です

## パフォーマンス考慮事項

- **チャンクサイズ**: 20ms（リアルタイム処理）
- **バッファ上限**: 10MB（メモリリーク防止）
- **非同期イテレータ**: バックプレッシャー対応
