import { describe, expect, it } from "vitest";
import { fileExtension, isHeicFile, mediaKindOf } from "../mediaKind";

describe("fileExtension", () => {
  it("returns the lowercase extension", () => {
    expect(fileExtension("Clip.Final.MP4")).toBe("mp4");
  });

  it("returns nothing for a name without a dot", () => {
    expect(fileExtension("clip")).toBe("");
  });
});

describe("mediaKindOf", () => {
  it("trusts audio and video mime types", () => {
    expect(mediaKindOf({ name: "x", type: "audio/mpeg" })).toBe("audio");
    expect(mediaKindOf({ name: "x", type: "video/mp4" })).toBe("video");
  });

  it("falls back to the extension", () => {
    expect(mediaKindOf({ name: "a.flac", type: "" })).toBe("audio");
    expect(mediaKindOf({ name: "a.mkv", type: "" })).toBe("video");
    expect(mediaKindOf({ name: "a.gif", type: "image/gif" })).toBe("image");
  });

  it("knows HEIC by mime type alone", () => {
    expect(mediaKindOf({ name: "photo", type: "image/heic" })).toBe("image");
  });

  it("rejects images the engine cannot read", () => {
    expect(mediaKindOf({ name: "logo.svg", type: "image/svg+xml" })).toBeNull();
    expect(mediaKindOf({ name: "notes.txt", type: "text/plain" })).toBeNull();
  });
});

describe("isHeicFile", () => {
  it("matches by extension or mime type", () => {
    expect(isHeicFile({ name: "IMG_1.HEIC", type: "" })).toBe(true);
    expect(isHeicFile({ name: "photo", type: "image/heif" })).toBe(true);
    expect(isHeicFile({ name: "photo.jpg", type: "image/jpeg" })).toBe(false);
  });
});
