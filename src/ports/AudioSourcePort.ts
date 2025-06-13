// サンプルレートの定義（一般的な値のみに制限）
export type SampleRate = 8000 | 16000 | 22050 | 44100 | 48000 | 96000;

// 将来の拡張用のPCMフォーマット（現在は使用しない）
// export interface PCMFormat {
//   rate: SampleRate;
//   channels: 1 | 2;
//   bitDepth: 16 | 24;
// }

export type PCMChunk = {
  data: Buffer;
  sampleRate: SampleRate;
  // 将来的な拡張
  // format?: PCMFormat;
};

export interface AudioSourcePort {
  pull(): AsyncIterable<PCMChunk>;
}
