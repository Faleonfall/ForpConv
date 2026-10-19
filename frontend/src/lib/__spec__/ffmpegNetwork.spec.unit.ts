import { type FFmpeg } from "@ffmpeg/ffmpeg";
import { describe, expect, it, vi } from "vitest";
import { FFMPEG_CORE_URL, loadFfmpegCore } from "../ffmpegNetwork";

const { toBlobURL } = vi.hoisted(() => ({
  toBlobURL: vi.fn((url: string, type: string) =>
    Promise.resolve(`blob:${type}:${url}`),
  ),
}));

vi.mock("@ffmpeg/util", () => ({ toBlobURL }));

describe("loadFfmpegCore", () => {
  it("loads the engine from the downloaded core and wasm", async () => {
    const load = vi.fn(() => Promise.resolve(true));

    await loadFfmpegCore({ load } as unknown as FFmpeg);

    expect(load).toHaveBeenCalledWith({
      coreURL: `blob:text/javascript:${FFMPEG_CORE_URL}/ffmpeg-core.js`,
      wasmURL: `blob:application/wasm:${FFMPEG_CORE_URL}/ffmpeg-core.wasm`,
    });
  });

  it("skips loading when a download fails", async () => {
    const load = vi.fn();
    toBlobURL.mockRejectedValueOnce(new Error("offline"));

    await expect(loadFfmpegCore({ load } as unknown as FFmpeg)).rejects.toThrow(
      "offline",
    );
    expect(load).not.toHaveBeenCalled();
  });
});
