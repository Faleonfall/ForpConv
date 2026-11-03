import { describe, expect, it } from "vitest";
import {
  applyLogLine,
  createProgressState,
  formatClock,
  progressRatio,
  progressStatus,
  remainingSeconds,
} from "../ffmpegProgress";

function feed(lines: string[], total: number | null, readsFirst = false) {
  return lines.reduce(applyLogLine, createProgressState(total, readsFirst));
}

describe("applyLogLine", () => {
  it("fills an unknown total from the input duration", () => {
    expect(feed(["  Duration: 00:01:30.50, start: 0.0"], null).total).toBe(
      90.5,
    );
  });

  it("keeps a known total over the input duration", () => {
    expect(feed(["  Duration: 00:01:30.50, start: 0.0"], 5).total).toBe(5);
  });

  it("ignores a zero duration from a still image", () => {
    expect(
      feed(["  Duration: 00:00:00.00, start: 0.0"], null).total,
    ).toBeNull();
  });

  it("reads written time from stats lines and never goes back", () => {
    const state = feed(
      ["frame= 1 time=00:00:03.00 speed=1x", "frame= 1 time=00:00:02.00"],
      10,
    );
    expect(state.writtenSeconds).toBe(3);
  });

  it("skips stats without a time", () => {
    expect(feed(["size=N/A time=N/A bitrate=N/A"], 10).writtenSeconds).toBe(0);
  });

  it("reads palette frames from showinfo", () => {
    expect(
      feed(["[Parsed_showinfo_3 @ 0x1] n: 9 pts_time:2.5 dur:0.08"], 10, true)
        .readSeconds,
    ).toBe(2.5);
  });
});

describe("progressRatio", () => {
  it("is zero until the total is known", () => {
    expect(progressRatio(feed(["time=00:00:05.00"], null))).toBe(0);
  });

  it("follows the written time", () => {
    expect(progressRatio(feed(["time=00:00:05.00"], 20))).toBe(0.25);
  });

  it("splits reading and writing for a palette pass", () => {
    const read = feed(["pts_time:10"], 10, true);
    expect(progressRatio(read)).toBeCloseTo(0.7);
    expect(progressRatio(applyLogLine(read, "time=00:00:05.00"))).toBeCloseTo(
      0.85,
    );
  });

  it("holds under one until FFmpeg finishes", () => {
    expect(progressRatio(feed(["time=00:00:30.00"], 10))).toBe(0.99);
  });
});

describe("remainingSeconds", () => {
  it("waits for enough progress and time", () => {
    expect(remainingSeconds(10, 0.02)).toBeNull();
    expect(remainingSeconds(1, 0.5)).toBeNull();
  });

  it("extrapolates from the pace so far", () => {
    expect(remainingSeconds(10, 0.25)).toBe(30);
  });
});

describe("progress text", () => {
  it("formats a clock", () => {
    expect(formatClock(7.4)).toBe("0:07");
    expect(formatClock(65)).toBe("1:05");
  });

  it("adds the time left once it is known", () => {
    expect(progressStatus("Converting...", 25, 10, 30)).toBe(
      "Converting... 25% · 0:10 elapsed · about 0:30 left",
    );
    expect(progressStatus("Converting...", 1, 1, null)).toBe(
      "Converting... 1% · 0:01 elapsed",
    );
  });
});
