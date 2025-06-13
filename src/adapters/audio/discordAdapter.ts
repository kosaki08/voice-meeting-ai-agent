import { AudioSourcePort, PCMChunk } from "../../ports/AudioSourcePort.js";

export class DiscordAdapter implements AudioSourcePort {
  async *pull(): AsyncIterable<PCMChunk> {
    // TODO: 音声ストリームを取得して適切に yield する実装に置き換える
    // eslint-disable-next-line no-constant-condition
    if (false) {
      yield { data: Buffer.alloc(0), sampleRate: 48000 };
    }
    throw new Error("not implemented yet");
  }
}
