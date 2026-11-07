import { type FFmpeg } from "@ffmpeg/ffmpeg";
import { openCoreStore, type CoreStore } from "./devCoreStore";

export const FFMPEG_CORE_VERSION = __FFMPEG_CORE_VERSION__;
export const FFMPEG_CORE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

// Decoded sizes of the pinned core. unpkg gzips both files without a
// Content-Length, so the download total has to be known up front. A spec
// checks them against the installed package, update them on every bump.
export const CORE_FILES = [
  { name: "ffmpeg-core.js", mime: "text/javascript", bytes: 111_804 },
  { name: "ffmpeg-core.wasm", mime: "application/wasm", bytes: 32_232_419 },
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
  // Keep the core in the dev store, on for the dev server only
  keepInStore?: boolean;
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

// Streams one file into a blob, reporting each decoded chunk
async function downloadBlob(
  url: string,
  cache: RequestCache,
  onChunk: (bytes: number) => void,
): Promise<Blob> {
  const response = await fetch(url, { cache });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);

  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    onChunk(buffer.byteLength);
    return new Blob([buffer]);
  }

  const chunks: BlobPart[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as BlobPart);
    onChunk(value.byteLength);
  }
  return new Blob(chunks);
}

// Retries a dropped file from scratch, taking back the bytes it had counted.
// Retries skip the HTTP cache, a failing cache write can abort the stream.
async function downloadWithRetry(
  url: string,
  onChunk: (bytes: number) => void,
  listener: LoadListener,
  retryDelayMs: number,
): Promise<Blob> {
  for (let attempt = 1; ; attempt++) {
    let counted = 0;
    try {
      return await downloadBlob(
        url,
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

// One core file from the dev store, else downloaded and saved for next time
async function coreFileBlob(
  store: CoreStore | null,
  file: (typeof CORE_FILES)[number],
  onChunk: (bytes: number) => void,
  listener: LoadListener,
  retryDelayMs: number,
): Promise<Blob> {
  const url = `${FFMPEG_CORE_URL}/${file.name}`;
  const stored = await store?.read(url, file.bytes);
  if (stored) {
    onChunk(stored.size);
    return stored;
  }
  const blob = await downloadWithRetry(url, onChunk, listener, retryDelayMs);
  store?.save(url, blob);
  return blob;
}

// Fetches the FFmpeg core and wasm, then starts the engine with them
export async function loadFfmpegCore(
  ffmpeg: FFmpeg,
  listener: LoadListener = {},
  {
    retryDelayMs = RETRY_DELAY_MS,
    keepInStore = import.meta.env.DEV,
  }: LoadOptions = {},
): Promise<void> {
  const store = keepInStore ? await openCoreStore(FFMPEG_CORE_VERSION) : null;
  let received = 0;
  const blobs = await Promise.all(
    CORE_FILES.map((file) =>
      coreFileBlob(
        store,
        file,
        (bytes) => {
          received += bytes;
          listener.onDownload?.(received);
        },
        listener,
        retryDelayMs,
      ),
    ),
  );
  const [coreURL, wasmURL] = blobs.map((blob, index) =>
    URL.createObjectURL(new Blob([blob], { type: CORE_FILES[index]!.mime })),
  );
  try {
    await ffmpeg.load({ coreURL: coreURL!, wasmURL: wasmURL! });
  } catch (error) {
    // A stored file that fails to start would fail every reload after
    await store?.drop();
    throw error;
  }
}
