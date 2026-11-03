import { describe, expect, it, vi } from "vitest";
import { DECODED_HEIC_NAME, prepareEngineInput } from "../heicDecode";

const { heicTo } = vi.hoisted(() => ({
  heicTo: vi.fn(() => Promise.resolve(new Blob(["png"]))),
}));

vi.mock("heic-to", () => ({ heicTo }));

describe("prepareEngineInput", () => {
  it("passes a regular file through", async () => {
    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });

    expect(await prepareEngineInput(file)).toEqual({
      blob: file,
      name: "input.mp4",
    });
    expect(heicTo).not.toHaveBeenCalled();
  });

  it("decodes a HEIC photo to PNG first", async () => {
    const file = new File(["x"], "IMG_1.HEIC", { type: "" });

    const input = await prepareEngineInput(file);

    expect(heicTo).toHaveBeenCalledWith({ blob: file, type: "image/png" });
    expect(input.name).toBe(DECODED_HEIC_NAME);
  });
});
