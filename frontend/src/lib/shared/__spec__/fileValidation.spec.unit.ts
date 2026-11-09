import { describe, expect, it } from "vitest";
import { kindListLabel, validateMediaFile } from "../fileValidation";
import { type MediaKind } from "../mediaKind";

const MB = 1024 * 1024;
const RINGTONE_KINDS: MediaKind[] = ["audio", "video"];
const ALL_KINDS: MediaKind[] = ["audio", "video", "image"];

describe("validateMediaFile", () => {
  it("accepts an audio file by type", () => {
    expect(
      validateMediaFile(
        { name: "clip", type: "audio/mpeg", size: MB },
        RINGTONE_KINDS,
      ),
    ).toBeNull();
  });

  it("accepts a known extension without a type", () => {
    expect(
      validateMediaFile(
        { name: "clip.MKV", type: "", size: MB },
        RINGTONE_KINDS,
      ),
    ).toBeNull();
  });

  it("rejects an unknown format", () => {
    expect(
      validateMediaFile(
        { name: "notes.txt", type: "text/plain", size: MB },
        RINGTONE_KINDS,
      ),
    ).toContain("Unsupported file format (.txt)");
  });

  it("rejects a file over 200MB", () => {
    expect(
      validateMediaFile(
        { name: "a.mp4", type: "video/mp4", size: 201 * MB },
        RINGTONE_KINDS,
      ),
    ).toContain("too large");
  });

  it("rejects a picture when only audio and video are allowed", () => {
    expect(
      validateMediaFile(
        { name: "photo.png", type: "image/png", size: MB },
        RINGTONE_KINDS,
      ),
    ).toBe(
      "Unsupported file format (.png). Please upload an audio or video file.",
    );
  });

  it("accepts a HEIC photo when images are allowed", () => {
    expect(
      validateMediaFile({ name: "IMG_1.HEIC", type: "", size: MB }, ALL_KINDS),
    ).toBeNull();
  });
});

describe("kindListLabel", () => {
  it("joins the kinds into a readable list", () => {
    expect(kindListLabel(["audio"])).toBe("audio");
    expect(kindListLabel(RINGTONE_KINDS)).toBe("audio or video");
    expect(kindListLabel(ALL_KINDS)).toBe("audio, video or image");
  });
});
