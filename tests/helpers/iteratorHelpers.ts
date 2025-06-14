/**
 * iterator.next() に n ms のタイムアウトを付ける
 * @param iter - AsyncIterator
 * @param ms - タイムアウト時間（ミリ秒）
 * @returns IteratorResult with timeout protection
 */
export async function nextWithTimeout<T>(iter: AsyncIterator<T>, ms = 5000): Promise<IteratorResult<T>> {
  return Promise.race([
    iter.next(),
    new Promise<IteratorResult<T>>((_, reject) => setTimeout(() => reject(new Error(`iterator timeout after ${ms} ms`)), ms)),
  ]);
}

/**
 * 複数のチャンクを取得する際のタイムアウト付きヘルパー
 * @param iter - AsyncIterator
 * @param count - 取得するチャンク数
 * @param timeoutMs - 全体のタイムアウト時間
 * @param chunkTimeoutMs - 各チャンクのタイムアウト時間
 * @returns 取得したチャンクの配列
 */
export async function collectChunksWithTimeout<T>(
  iter: AsyncIterator<T>,
  count: number,
  timeoutMs = 5000,
  chunkTimeoutMs = 1000,
): Promise<T[]> {
  const chunks: T[] = [];
  const deadline = Date.now() + timeoutMs;

  while (chunks.length < count && Date.now() < deadline) {
    try {
      const result = await nextWithTimeout(iter, chunkTimeoutMs);
      if (result.done) break;
      if (result.value) chunks.push(result.value);
    } catch (error) {
      // チャンクタイムアウトの場合は続行
      if (error instanceof Error && error.message.includes("iterator timeout")) {
        break;
      }
      throw error;
    }
  }

  return chunks;
}
