import { type FFmpeg } from "@ffmpeg/ffmpeg";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CORE_FILES,
  CORE_TOTAL_BYTES,
  DOWNLOAD_ATTEMPTS,
  FFMPEG_CORE_URL,
  downloadRatio,
  downloadStatus,
  loadFfmpegCore,
  retryStatus,
} from "../ffmpegNetwork";

// A fetch response that streams the given byte counts as chunks
function streamedResponse(chunkSizes: number[]) {
  const chunks = chunkSizes.map((size) => new Uint8Array(size));
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () => {
          const value = chunks.shift();
          return Promise.resolve(
            value ? { done: false, value } : { done: true, value: undefined },
          );
        },
      }),
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadFfmpegCore", () => {
  it("loads the engine from blob URLs of both core files", async () => {
    const fetch = vi.fn(() => Promise.resolve(streamedResponse([4, 4])));
    vi.stubGlobal("fetch", fetch);
    const load = vi.fn(() => Promise.resolve(true));

    await loadFfmpegCore({ load } as unknown as FFmpeg);

    expect(fetch).toHaveBeenCalledWith(`${FFMPEG_CORE_URL}/ffmpeg-core.js`, {
      cache: "default",
    });
    expect(fetch).toHaveBeenCalledWith(`${FFMPEG_CORE_URL}/ffmpeg-core.wasm`, {
      cache: "default",
    });
    expect(load).toHaveBeenCalledWith({
      coreURL: expect.stringMatching(/^blob:/),
      wasmURL: expect.stringMatching(/^blob:/),
    });
  });

  it("reports the running byte count across both files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(streamedResponse([10, 5]))),
    );
    const onDownload = vi.fn();

    await loadFfmpegCore(
      { load: () => Promise.resolve(true) } as unknown as FFmpeg,
      { onDownload },
    );

    expect(onDownload).toHaveBeenCalledTimes(4);
    expect(onDownload).toHaveBeenLastCalledWith(30);
  });

  it("retries a dropped stream past the cache and recounts its bytes", async () => {
    let wasmCalls = 0;
    const fetch = vi.fn((url: string) => {
      if (!url.endsWith(".wasm")) return Promise.resolve(streamedResponse([4]));
      wasmCalls += 1;
      if (wasmCalls > 1) return Promise.resolve(streamedResponse([6]));
      // First try streams some bytes, then the connection drops
      let reads = 0;
      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: () =>
              reads++ === 0
                ? Promise.resolve({ done: false, value: new Uint8Array(5) })
                : Promise.reject(new TypeError("network error")),
          }),
        },
      });
    });
    vi.stubGlobal("fetch", fetch);
    const onDownload = vi.fn();
    const onRetry = vi.fn();
    const load = vi.fn(() => Promise.resolve(true));

    await loadFfmpegCore(
      { load } as unknown as FFmpeg,
      { onDownload, onRetry },
      { retryDelayMs: 0 },
    );

    expect(onRetry).toHaveBeenCalledWith(2);
    expect(fetch).toHaveBeenLastCalledWith(
      `${FFMPEG_CORE_URL}/ffmpeg-core.wasm`,
      { cache: "no-store" },
    );
    expect(onDownload).toHaveBeenLastCalledWith(10);
    expect(load).toHaveBeenCalledOnce();
  });

  it("gives up after the last attempt and skips loading", async () => {
    const fetch = vi.fn((_url: string) =>
      Promise.resolve({ ok: false, status: 503 }),
    );
    vi.stubGlobal("fetch", fetch);
    const load = vi.fn();

    await expect(
      loadFfmpegCore({ load } as unknown as FFmpeg, {}, { retryDelayMs: 0 }),
    ).rejects.toThrow("Download failed (503)");
    // Both files download at once, the first to run out of tries ends the load
    const jsCalls = fetch.mock.calls.filter(([url]) => url.endsWith(".js"));
    expect(jsCalls).toHaveLength(DOWNLOAD_ATTEMPTS);
    expect(load).not.toHaveBeenCalled();
  });
});

describe("download progress", () => {
  it("adds up the pinned core sizes", () => {
    expect(CORE_TOTAL_BYTES).toBe(CORE_FILES[0]!.bytes + CORE_FILES[1]!.bytes);
  });

  it("holds the ratio under one until the engine starts", () => {
    expect(downloadRatio(CORE_TOTAL_BYTES / 2)).toBe(0.5);
    expect(downloadRatio(CORE_TOTAL_BYTES * 2)).toBe(0.99);
  });

  it("names the download, then the start step", () => {
    expect(downloadStatus(0)).toBe("Downloading engine...");
    expect(downloadStatus(CORE_TOTAL_BYTES)).toBe("Starting engine...");
  });

  it("counts the retries", () => {
    expect(retryStatus(2)).toBe("Connection dropped, retrying (2 of 3)...");
  });
});
