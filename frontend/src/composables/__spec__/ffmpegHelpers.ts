import { vi } from "vitest";

type ProgressHandler = (event: { progress: number }) => void;

// In-memory FFmpeg that records calls and never loads the real core
export function createFfmpegFake() {
  const progressHandlers: ProgressHandler[] = [];

  const ffmpeg = {
    on: vi.fn((event: string, handler: ProgressHandler) => {
      if (event === "progress") progressHandlers.push(handler);
    }),
    load: vi.fn(() => Promise.resolve(true)),
    writeFile: vi.fn(() => Promise.resolve(true)),
    exec: vi.fn(() => Promise.resolve(0)),
    readFile: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    deleteFile: vi.fn(() => Promise.resolve(true)),
  };

  const reportProgress = (progress: number) => {
    progressHandlers.forEach((handler) => handler({ progress }));
  };

  return { ffmpeg, reportProgress };
}

export type FfmpegFake = ReturnType<typeof createFfmpegFake>;
