import { describe, expect, it } from "vitest";
import { validateMediaFile } from "../fileValidation";

const MB = 1024 * 1024;

describe("validateMediaFile", () => {
  it("accepts an audio file by type", () => {
    expect(
      validateMediaFile({ name: "clip", type: "audio/mpeg", size: MB }),
    ).toBeNull();
  });

  it("accepts a known extension without a type", () => {
    expect(validateMediaFile({ name: "clip.MKV", type: "", size: MB })).toBe(
      null,
    );
  });

  it("rejects an unknown format", () => {
    expect(
      validateMediaFile({ name: "notes.txt", type: "text/plain", size: MB }),
    ).toContain("Unsupported file format (.txt)");
  });

  it("rejects a file over 200MB", () => {
    expect(
      validateMediaFile({ name: "a.mp4", type: "video/mp4", size: 201 * MB }),
    ).toContain("too large");
  });
});
