import { describe, expect, it } from "vitest";
import {
  clampFade,
  clampSelectionEnd,
  defaultRingtoneTitle,
  finalRingtoneTitle,
  initialSelectionEnd,
  previewGain,
  sliderFade,
  snapToSticky,
  waveformHeight,
  type GainInput,
} from "../ringtoneTrim";

const gain: GainInput = {
  time: 15,
  startTime: 10,
  endTime: 40,
  volume: 1.5,
  fadeIn: 0,
  fadeOut: 0,
  isPlaying: true,
};

describe("previewGain", () => {
  it("applies the volume inside the selection", () => {
    expect(previewGain(gain)).toBe(1.5);
  });

  it("scales through the fade in", () => {
    expect(previewGain({ ...gain, time: 11, fadeIn: 4 })).toBe(0.375);
  });

  it("scales through the fade out", () => {
    expect(previewGain({ ...gain, time: 38, fadeOut: 4 })).toBe(0.75);
  });

  it("silences playback outside the selection", () => {
    expect(previewGain({ ...gain, time: 5 })).toBe(0);
  });

  it("keeps the volume outside the selection while paused", () => {
    expect(previewGain({ ...gain, time: 5, isPlaying: false })).toBe(1.5);
  });
});

describe("snapToSticky", () => {
  it("snaps near a half second", () => {
    expect(snapToSticky(1.97, false)).toBe(2);
  });

  it("leaves values away from a step", () => {
    expect(snapToSticky(1.8, false)).toBe(1.8);
  });

  it("skips snapping while free movement is held", () => {
    expect(snapToSticky(1.97, true)).toBe(1.97);
  });
});

describe("sliderFade", () => {
  it("rounds to two digits after snapping", () => {
    expect(sliderFade(1.23456, true)).toBe(1.23);
  });
});

describe("clampFade", () => {
  it("clamps into the fade range", () => {
    expect(clampFade(-1)).toBe(0);
    expect(clampFade(9)).toBe(5);
    expect(clampFade(2.5)).toBe(2.5);
  });

  it("treats an empty value as zero", () => {
    expect(clampFade(NaN)).toBe(0);
  });
});

describe("selection bounds", () => {
  it("starts with at most thirty seconds", () => {
    expect(initialSelectionEnd(12)).toBe(12);
    expect(initialSelectionEnd(95)).toBe(30);
  });

  it("caps the emitted selection at thirty seconds", () => {
    expect(clampSelectionEnd(10, 45)).toBe(40);
    expect(clampSelectionEnd(10, 25)).toBe(25);
  });
});

describe("waveformHeight", () => {
  it("shrinks on shorter screens", () => {
    expect(waveformHeight(600)).toBe(80);
    expect(waveformHeight(800)).toBe(100);
    expect(waveformHeight(1000)).toBe(128);
  });
});

describe("ringtone titles", () => {
  it("drops the extension and unsafe characters", () => {
    expect(defaultRingtoneTitle("My Song (Live)!.mp3")).toBe("My Song Live");
  });

  it("falls back to ringtone for a blank title", () => {
    expect(finalRingtoneTitle("   ")).toBe("ringtone");
    expect(finalRingtoneTitle(" Tone ")).toBe("Tone");
  });
});
