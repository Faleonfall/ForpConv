import { describe, expect, it } from "vitest";
import {
  frameRate,
  hasAudibleSound,
  hasAudioStream,
  maxVolume,
  probeArgs,
} from "../streamProbe";

const VIDEO = "  Stream #0:0[0x1](und): Video: hevc (Main), yuv420p, 3840x2160";
const AUDIO = "  Stream #0:1[0x2](und): Audio: aac (LC), 44100 Hz, stereo";
const SILENT_PEAK = "[Parsed_volumedetect_0 @ 0x1] max_volume: -inf dB";
const LOUD_PEAK = "[Parsed_volumedetect_0 @ 0x1] max_volume: -3.2 dB";

describe("probeArgs", () => {
  it("measures the first audio track of the mounted file", () => {
    expect(probeArgs("IMG_1.MOV")).toEqual([
      "-hide_banner",
      "-i",
      "/probe/IMG_1.MOV",
      "-map",
      "0:a:0",
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-",
    ]);
  });
});

describe("hasAudioStream", () => {
  it("finds an audio stream among the streams", () => {
    expect(hasAudioStream(["Input #0, mov", VIDEO, AUDIO])).toBe(true);
  });

  it("reports a video only file as silent", () => {
    expect(hasAudioStream(["Input #0, mov", VIDEO])).toBe(false);
  });

  it("can't tell from a log without streams", () => {
    expect(hasAudioStream(["/probe/x.mov: Invalid data found"])).toBeNull();
  });
});

describe("maxVolume", () => {
  it("reads the peak, minus infinity for pure silence", () => {
    expect(maxVolume([LOUD_PEAK])).toBe(-3.2);
    expect(maxVolume([SILENT_PEAK])).toBe(-Infinity);
    expect(maxVolume([AUDIO])).toBeNull();
  });
});

describe("hasAudibleSound", () => {
  it("keeps a track with sound", () => {
    expect(hasAudibleSound([VIDEO, AUDIO, LOUD_PEAK])).toBe(true);
  });

  it("drops a track of only silence", () => {
    expect(hasAudibleSound([VIDEO, AUDIO, SILENT_PEAK])).toBe(false);
    expect(hasAudibleSound([VIDEO, AUDIO, "max_volume: -91.0 dB"])).toBe(false);
  });

  it("keeps a track whose peak never got measured", () => {
    expect(hasAudibleSound([VIDEO, AUDIO])).toBe(true);
  });

  it("passes on a missing track or a failed probe", () => {
    expect(hasAudibleSound([VIDEO])).toBe(false);
    expect(hasAudibleSound([])).toBeNull();
  });
});

describe("frameRate", () => {
  it("reads the average rate of the video stream", () => {
    expect(frameRate([`${VIDEO}, 29.97 fps, 29.97 tbr, 90k tbn`, AUDIO])).toBe(
      29.97,
    );
  });

  it("falls back to tbr when the average is missing", () => {
    expect(frameRate([`${VIDEO}, 25 tbr, 100 tbn`])).toBe(25);
  });

  it("gives null without a rate or a video stream", () => {
    expect(frameRate([`${VIDEO}, 90k tbn`])).toBeNull();
    expect(frameRate([AUDIO])).toBeNull();
  });
});
