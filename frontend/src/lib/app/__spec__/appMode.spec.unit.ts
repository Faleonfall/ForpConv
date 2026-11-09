import { describe, expect, it } from "vitest";
import {
  acceptFor,
  canGoHome,
  CONVERT_DOWNLOAD_COPY,
  engineTitle,
  hashForMode,
  modeFromHash,
  modeIndex,
  slideDirection,
  themeToggleTitle,
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

describe("canGoHome", () => {
  it("waits out a running conversion", () => {
    expect(canGoHome("converting", false)).toBe(false);
  });

  it("leaves a failed run or any other step", () => {
    expect(canGoHome("converting", true)).toBe(true);
    expect(canGoHome("pick", false)).toBe(true);
  });
});

describe("themeToggleTitle", () => {
  it("names the next theme", () => {
    expect(themeToggleTitle("dark")).toBe("Switch to light theme");
    expect(themeToggleTitle("light")).toBe("Switch to system theme");
    expect(themeToggleTitle("system")).toBe("Switch to dark theme");
  });
});

describe("engineTitle", () => {
  it("names a failed load", () => {
    expect(engineTitle(true)).toBe("Engine Failed to Load");
    expect(engineTitle(false)).toBe("Initializing Engine");
  });
});
