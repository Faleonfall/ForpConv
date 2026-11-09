import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  formatPercent,
  formatSeconds,
  formatTime,
} from "../mediaDisplay";

describe("formatTime", () => {
  it("formats minutes, seconds and tenths", () => {
    expect(formatTime(75.38)).toBe("01:15.3");
  });

  it("falls back to zero for invalid input", () => {
    expect(formatTime(NaN)).toBe("00:00.0");
    expect(formatTime(Infinity)).toBe("00:00.0");
  });
});

describe("formatFileSize", () => {
  it("uses KB below one megabyte", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("uses MB from one megabyte", () => {
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.00 MB");
  });
});

describe("formatPercent", () => {
  it("rounds a ratio to a percent", () => {
    expect(formatPercent(1.25)).toBe("125%");
  });
});

describe("formatSeconds", () => {
  it("keeps the raw value without digits", () => {
    expect(formatSeconds(2.5)).toBe("2.5s");
  });

  it("fixes the given digits", () => {
    expect(formatSeconds(29.96, 1)).toBe("30.0s");
  });
});
