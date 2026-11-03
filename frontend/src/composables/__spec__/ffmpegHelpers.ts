import { vi } from "vitest";

type LogHandler = (event: { message: string }) => void;

// In-memory FFmpeg that records calls and never loads the real core
export function createFfmpegFake() {
  const logHandlers: LogHandler[] = [];

  const ffmpeg = {
    on: vi.fn((event: string, handler: LogHandler) => {
      if (event === "log") logHandlers.push(handler);
    }),
    load: vi.fn(() => Promise.resolve(true)),
    writeFile: vi.fn(() => Promise.resolve(true)),
    exec: vi.fn(() => Promise.resolve(0)),
    readFile: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    deleteFile: vi.fn(() => Promise.resolve(true)),
    createDir: vi.fn(() => Promise.resolve(true)),
    mount: vi.fn(() => Promise.resolve(true)),
    unmount: vi.fn(() => Promise.resolve(true)),
    deleteDir: vi.fn(() => Promise.resolve(true)),
  };

  // Feeds a line as FFmpeg would print it, eg a stats line with time=
  const reportLog = (message: string) => {
    logHandlers.forEach((handler) => handler({ message }));
  };

  return { ffmpeg, reportLog };
}

export type FfmpegFake = ReturnType<typeof createFfmpegFake>;

// A fetch response that streams the given byte counts as chunks
export function streamedResponse(chunkSizes: number[]) {
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

// Serves the core download without the network, undone by unstubAllGlobals
export function stubCoreFetch() {
  const fetch = vi.fn(() => Promise.resolve(streamedResponse([16])));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
