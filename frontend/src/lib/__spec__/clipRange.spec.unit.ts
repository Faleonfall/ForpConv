import { describe, expect, it } from "vitest";
import {
  MAX_ANIMATION_SECONDS,
  clampClipRange,
  clipForConvert,
  clipLengthHint,
  clipLimitsFor,
  clipPreviewFailedText,
  defaultClipRange,
  filmstripTimes,
  frameArgs,
  isFullClip,
  moveClipEnd,
  moveClipStart,
  moveClipWindow,
  percentOf,
  timeAtPosition,
  trackStyleVars,
  trimArgs,
  type ClipLimits,
} from "../clipRange";
import { findTarget } from "../formatCatalog";

const GIF = clipLimitsFor(findTarget("video-gif"));
const FREE = clipLimitsFor(findTarget("mp4"));

describe("clipLimitsFor", () => {
  it("caps animated output only", () => {
    expect(GIF).toEqual({ maxSeconds: 30, defaultSeconds: 5 });
    expect(clipLimitsFor(findTarget("video-webp"))).toEqual(GIF);
    expect(clipLimitsFor(findTarget("webp"))).toEqual(FREE);
    expect(FREE).toEqual({ maxSeconds: null, defaultSeconds: null });
    expect(clipLimitsFor(undefined)).toEqual(FREE);
  });

  it("keeps a whole GIF under the cap by default", () => {
    const limits = clipLimitsFor(findTarget("video-gif"), true);

    expect(defaultClipRange(8, limits)).toEqual({ start: 0, end: 8 });
    expect(defaultClipRange(45, limits)).toEqual({ start: 0, end: 30 });
  });
});

describe("defaultClipRange", () => {
  it("starts a GIF on the first seconds", () => {
    expect(defaultClipRange(120, GIF)).toEqual({ start: 0, end: 5 });
    expect(defaultClipRange(3, GIF)).toEqual({ start: 0, end: 3 });
  });

  it("keeps the whole file for other formats", () => {
    expect(defaultClipRange(120, FREE)).toEqual({ start: 0, end: 120 });
  });
});

describe("clampClipRange", () => {
  it("cuts a long range down to the cap from the end", () => {
    expect(clampClipRange({ start: 10, end: 100 }, 120, GIF)).toEqual({
      start: 10,
      end: 40,
    });
  });

  it("keeps the range inside the file", () => {
    expect(clampClipRange({ start: -2, end: 200 }, 120, FREE)).toEqual({
      start: 0,
      end: 120,
    });
  });
});

describe("moveClipStart and moveClipEnd", () => {
  it("stops the start short of the end", () => {
    expect(moveClipStart({ start: 0, end: 5 }, 8, FREE)).toEqual({
      start: 4.5,
      end: 5,
    });
  });

  it("stops the start at the cap", () => {
    expect(moveClipStart({ start: 20, end: 50 }, 10, GIF)).toEqual({
      start: 20,
      end: 50,
    });
    expect(moveClipStart({ start: 2, end: 5 }, -3, GIF)).toEqual({
      start: 0,
      end: 5,
    });
  });

  it("stops the end at the cap and the file end", () => {
    expect(moveClipEnd({ start: 0, end: 5 }, 50, 60, GIF)).toEqual({
      start: 0,
      end: 30,
    });
    expect(moveClipEnd({ start: 0, end: 5 }, 90, 60, FREE)).toEqual({
      start: 0,
      end: 60,
    });
  });

  it("stops the end short of the start", () => {
    expect(moveClipEnd({ start: 10, end: 20 }, 4, 60, FREE)).toEqual({
      start: 10,
      end: 10.5,
    });
  });
});

describe("moveClipWindow", () => {
  it("slides the selection keeping its length", () => {
    expect(moveClipWindow({ start: 10, end: 15 }, 7, 60)).toEqual({
      start: 17,
      end: 22,
    });
  });

  it("stops at both file edges", () => {
    expect(moveClipWindow({ start: 10, end: 15 }, -40, 60)).toEqual({
      start: 0,
      end: 5,
    });
    expect(moveClipWindow({ start: 10, end: 15 }, 90, 60)).toEqual({
      start: 55,
      end: 60,
    });
  });
});

describe("track geometry", () => {
  it("maps a pointer to a time inside the file", () => {
    expect(timeAtPosition(150, 100, 200, 60)).toBe(15);
    expect(timeAtPosition(20, 100, 200, 60)).toBe(0);
    expect(timeAtPosition(400, 100, 200, 60)).toBe(60);
    expect(timeAtPosition(150, 100, 0, 60)).toBe(0);
  });

  it("exposes positions as percentages", () => {
    expect(trackStyleVars({ start: 15, end: 30 }, 45, 60)).toEqual({
      "--trim-start": "25%",
      "--trim-end": "50%",
      "--trim-playhead": "75%",
    });
    expect(percentOf(5, 0)).toBe(0);
  });

  it("spaces filmstrip frames across the clip", () => {
    expect(filmstripTimes(40, 4)).toEqual([5, 15, 25, 35]);
  });
});

describe("clipForConvert", () => {
  it("skips trimming for the whole file", () => {
    expect(isFullClip({ start: 0, end: 59.98 }, 60)).toBe(true);
    expect(clipForConvert({ start: 0, end: 60 }, 60, FREE)).toBeNull();
  });

  it("keeps a real selection", () => {
    expect(clipForConvert({ start: 2, end: 7 }, 60, GIF)).toEqual({
      start: 2,
      end: 7,
    });
  });

  it("still caps a GIF when the length is unknown", () => {
    expect(clipForConvert({ start: 0, end: 0 }, null, GIF)).toEqual({
      start: 0,
      end: MAX_ANIMATION_SECONDS,
    });
    expect(clipForConvert({ start: 0, end: 0 }, null, FREE)).toBeNull();
  });
});

describe("clip texts", () => {
  it("warns about long GIFs only", () => {
    expect(clipLengthHint(8, GIF)).toBe("");
    expect(clipLengthHint(12, GIF)).toContain("Long animations get large");
    expect(clipLengthHint(120, FREE)).toBe("");
  });

  it("says what converts without a preview", () => {
    const limits: ClipLimits = GIF;
    expect(clipPreviewFailedText(limits)).toContain("first 30 seconds");
    expect(clipPreviewFailedText(FREE)).toContain("whole file");
  });
});

describe("trimArgs", () => {
  it("seeks to the start and keeps the length", () => {
    expect(trimArgs({ start: 1.25, end: 6.5 })).toEqual([
      "-ss",
      "1.25",
      "-t",
      "5.25",
    ]);
  });

  it("adds nothing for the whole file", () => {
    expect(trimArgs(null)).toEqual([]);
  });

  it("seeks to a still frame, the first one needs no seek", () => {
    expect(frameArgs(2.5)).toEqual(["-ss", "2.5"]);
    expect(frameArgs(0)).toEqual([]);
    expect(frameArgs(null)).toEqual([]);
  });
});
