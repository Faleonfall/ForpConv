import { describe, expect, it } from "vitest";
import {
  acceptFor,
  convertDownloadCopy,
  hashForMode,
  modeFromHash,
  modeIndex,
  slideDirection,
  uploadTitle,
} from "../appMode";
import { findTarget } from "../formatCatalog";

describe("modeFromHash and hashForMode", () => {
  it("round trips both modes", () => {
    expect(modeFromHash(hashForMode("convert"))).toBe("convert");
    expect(modeFromHash(hashForMode("ringtone"))).toBe("ringtone");
  });

  it("falls back to the ringtone maker", () => {
    expect(modeFromHash("")).toBe("ringtone");
    expect(modeFromHash("#other")).toBe("ringtone");
  });
});

describe("slideDirection", () => {
  it("follows the tab order", () => {
    expect(slideDirection("ringtone", "convert")).toBe("forward");
    expect(slideDirection("convert", "ringtone")).toBe("back");
    expect(modeIndex("convert")).toBe(1);
  });
});

describe("upload labels", () => {
  it("names the allowed kinds", () => {
    expect(uploadTitle(["audio", "video"])).toBe(
      "Drop your audio or video file here",
    );
  });

  it("adds HEIC to the accept list with images", () => {
    expect(acceptFor(["audio", "video"])).toBe("audio/*,video/*");
    expect(acceptFor(["image"])).toBe("image/*,.heic,.heif");
  });
});

describe("convertDownloadCopy", () => {
  it("names the output format", () => {
    expect(convertDownloadCopy(findTarget("webp")!).text).toBe(
      "The WEBP file is ready to download.",
    );
  });
});
