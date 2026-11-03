import { type FFmpeg } from "@ffmpeg/ffmpeg";

export const FFMPEG_CORE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

// Decoded sizes of the pinned core. unpkg gzips both files without a
// Content-Length, so the download total has to be known up front.
export const CORE_FILES = [
  { name: "ffmpeg-core.js", mime: "text/javascript", bytes: 114_494 },
  { name: "ffmpeg-core.wasm", mime: "application/wasm", bytes: 32_129_114 },
];
export const CORE_TOTAL_BYTES = CORE_FILES.reduce(
  (sum, file) => sum + file.bytes,
  0,
);

// A dropped download tries again this many times in all
export const DOWNLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

export interface LoadListener {
  // Bytes received across both core files so far
  onDownload?: (receivedBytes: number) => void;
  // A file dropped and is about to download again
  onRetry?: (attempt: number) => void;
}

export interface LoadOptions {
  // Wait before retry n is n times this, tests pass 0
  retryDelayMs?: number;
}

// 0 to 1, held under 1 so the bar only fills once the engine starts
export function downloadRatio(receivedBytes: number): number {
  return Math.min(0.99, Math.max(0, receivedBytes) / CORE_TOTAL_BYTES);
}

// The ring shows how far as a percent, the text only names the step
export function downloadStatus(receivedBytes: number): string {
  return receivedBytes >= CORE_TOTAL_BYTES
    ? "Starting engine..."
    : "Downloading engine...";
}

export function retryStatus(attempt: number): string {
  return `Connection dropped, retrying (${attempt} of ${DOWNLOAD_ATTEMPTS})...`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Streams one file into a blob URL, reporting each decoded chunk
async function downloadBlobUrl(
  url: string,
  mime: string,
  cache: RequestCache,
  onChunk: (bytes: number) => void,
): Promise<string> {
  const response = await fetch(url, { cache });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);

  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    onChunk(buffer.byteLength);
    return URL.createObjectURL(new Blob([buffer], { type: mime }));
  }

  const chunks: BlobPart[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as BlobPart);
    onChunk(value.byteLength);
  }
  return URL.createObjectURL(new Blob(chunks, { type: mime }));
}

// Retries a dropped file from scratch, taking back the bytes it had counted.
// Retries skip the HTTP cache, a failing cache write can abort the stream.
async function downloadWithRetry(
  url: string,
  mime: string,
  onChunk: (bytes: number) => void,
  listener: LoadListener,
  retryDelayMs: number,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    let counted = 0;
    try {
      return await downloadBlobUrl(
        url,
        mime,
        attempt === 1 ? "default" : "no-store",
        (bytes) => {
          counted += bytes;
          onChunk(bytes);
        },
      );
    } catch (error) {
      onChunk(-counted);
      if (attempt >= DOWNLOAD_ATTEMPTS) throw error;
      listener.onRetry?.(attempt + 1);
      await wait(retryDelayMs * attempt);
    }
  }
}

// Downloads the FFmpeg core and wasm, then starts the engine with them
export async function loadFfmpegCore(
  ffmpeg: FFmpeg,
  listener: LoadListener = {},
  { retryDelayMs = RETRY_DELAY_MS }: LoadOptions = {},
): Promise<void> {
  let received = 0;
  const [coreURL, wasmURL] = await Promise.all(
    CORE_FILES.map((file) =>
      downloadWithRetry(
        `${FFMPEG_CORE_URL}/${file.name}`,
        file.mime,
        (bytes) => {
          received += bytes;
          listener.onDownload?.(received);
        },
        listener,
        retryDelayMs,
      ),
    ),
  );
  await ffmpeg.load({ coreURL: coreURL!, wasmURL: wasmURL! });
}
