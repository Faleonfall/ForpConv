import { describe, expect, it } from "vitest";
import {
  acceptFor,
  CONVERT_DOWNLOAD_COPY,
  hashForMode,
  modeFromHash,
  modeIndex,
  slideDirection,
  uploadTitle,
} from "../appMode";

describe("modeFromHash and hashForMode", () => {
  it("round trips both modes", () => {
    expect(modeFromHash(hashForMode("convert"))).toBe("convert");
    expect(modeFromHash(hashForMode("ringtone"))).toBe("ringtone");
  });

  it("falls back to the converter on the bare address", () => {
    expect(hashForMode("convert")).toBe("");
    expect(modeFromHash("")).toBe("convert");
    expect(modeFromHash("#other")).toBe("convert");
  });
});

describe("slideDirection", () => {
  it("follows the tab order", () => {
    expect(slideDirection("convert", "ringtone")).toBe("forward");
    expect(slideDirection("ringtone", "convert")).toBe("back");
    expect(modeIndex("ringtone")).toBe(1);
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

describe("CONVERT_DOWNLOAD_COPY", () => {
  it("leaves the line under the heading out", () => {
    expect(CONVERT_DOWNLOAD_COPY.text).toBeUndefined();
  });
});
