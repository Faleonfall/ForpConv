import { describe, expect, it } from "vitest";
import {
  OUTPUT_FILE_NAME,
  buildAudioFilters,
  buildFfmpegArgs,
  inputFileName,
  progressPercent,
  type ConvertParams,
} from "../ringtoneConversion";

const params: ConvertParams = {
  startTime: 10,
  endTime: 40,
  volume: 1,
  fadeIn: 0,
  fadeOut: 0,
  title: "tone",
};

describe("inputFileName", () => {
  it("keeps the source extension", () => {
    expect(inputFileName("song.flac")).toBe("input.flac");
  });

  it("falls back to mp3 when the name ends with a dot", () => {
    expect(inputFileName("song.")).toBe("input.mp3");
  });
});

describe("buildAudioFilters", () => {
  it("returns no filters for untouched settings", () => {
    expect(buildAudioFilters(params)).toEqual([]);
  });

  it("adds volume and both fades", () => {
    expect(
      buildAudioFilters({ ...params, volume: 1.5, fadeIn: 2, fadeOut: 3 }),
    ).toEqual(["volume=1.5", "afade=t=in:st=0:d=2", "afade=t=out:st=27:d=3"]);
  });
});

describe("buildFfmpegArgs", () => {
  it("trims and encodes without a filter graph", () => {
    expect(buildFfmpegArgs(params, "input.mp3")).toEqual([
      "-i",
      "input.mp3",
      "-ss",
      "10",
      "-to",
      "40",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-vn",
      OUTPUT_FILE_NAME,
    ]);
  });

  it("joins filters into one audio filter argument", () => {
    const args = buildFfmpegArgs({ ...params, volume: 2, fadeIn: 1 }, "in.wav");
    const index = args.indexOf("-af");
    expect(args[index + 1]).toBe("volume=2,afade=t=in:st=0:d=1");
  });
});

describe("progressPercent", () => {
  it("rounds to a whole percent", () => {
    expect(progressPercent(0.426)).toBe(43);
  });

  it("caps at one hundred", () => {
    expect(progressPercent(1.2)).toBe(100);
  });
});
