import { render, screen } from "@testing-library/vue";
import { h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findTarget } from "../../lib/formatCatalog";
import { buildConvertArgs } from "../../lib/formatConversion";
import { useFfmpegEngine } from "../useFfmpegEngine";
import { useFormatConverter } from "../useFormatConverter";
import {
  createFfmpegFake,
  stubCoreFetch,
  type FfmpegFake,
} from "./ffmpegHelpers";

let fake: FfmpegFake;

const { heicTo } = vi.hoisted(() => ({
  heicTo: vi.fn(() => Promise.resolve(new Blob(["png"]))),
}));

vi.mock("heic-to", () => ({ heicTo }));

const { compressGif } = vi.hoisted(() => ({
  compressGif: vi.fn(() => Promise.resolve(new Blob(["small"]))),
}));

// The real pass runs gifsicle in a worker, which jsdom can't start
vi.mock("../../lib/gifCompress", () => ({ compressGif }));

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: function FFmpeg() {
    return fake.ffmpeg;
  },
}));

vi.mock("@ffmpeg/util", () => ({
  fetchFile: () => Promise.resolve(new Uint8Array([9])),
}));

const clip = new File(["x"], "Holiday.mp4", { type: "video/mp4" });

let engine: ReturnType<typeof useFfmpegEngine>;
let converter: ReturnType<typeof useFormatConverter>;

const ConverterHost = {
  setup() {
    engine = useFfmpegEngine();
    converter = useFormatConverter(engine);
    return () =>
      h("p", { "data-testid": "ready" }, String(engine.isReady.value));
  },
};

// Picks a video and waits until its stream probe has cleaned up
async function selectProbed(file: File) {
  converter.handleFileSelected(file);
  await vi.waitFor(() => expect(fake.ffmpeg.deleteDir).toHaveBeenCalled());
}

// Makes the next exec print the given stream lines, as a probe would see
function probeLogs(...lines: string[]) {
  fake.ffmpeg.exec.mockImplementationOnce(() => {
    lines.forEach((line) => fake.reportLog(line));
    return Promise.resolve(1);
  });
}

async function renderReady() {
  render(ConverterHost);
  await vi.waitFor(() =>
    expect(screen.getByTestId("ready")).toHaveTextContent("true"),
  );
}

beforeEach(() => {
  stubCoreFetch();
  fake = createFfmpegFake();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  heicTo.mockClear();
  compressGif.mockClear();
});

describe("useFormatConverter", () => {
  it("moves to the format picker once a file is picked", async () => {
    await renderReady();

    converter.handleFileSelected(clip);

    expect(converter.currentStep.value).toBe("pick");
  });

  it("reads a video's streams in place to find its sound", async () => {
    await renderReady();
    probeLogs(
      "  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 1920x1080",
      "  Stream #0:1[0x2](und): Audio: aac (LC), 48000 Hz, stereo",
    );

    await selectProbed(clip);

    expect(fake.ffmpeg.mount).toHaveBeenCalledWith(
      "WORKERFS",
      { files: [clip] },
      "/probe",
    );
    expect(fake.ffmpeg.writeFile).not.toHaveBeenCalled();
    expect(converter.hasAudio.value).toBe(true);
  });

  it("marks a video without an audio stream as silent", async () => {
    await renderReady();
    probeLogs("  Stream #0:0[0x1](und): Video: h264 (High), yuv420p");

    await selectProbed(clip);

    expect(converter.hasAudio.value).toBe(false);
  });

  it("marks a video whose audio track is pure silence as silent", async () => {
    await renderReady();
    probeLogs(
      "  Stream #0:0[0x1](und): Video: h264 (High), yuv420p",
      "  Stream #0:1[0x2](und): Audio: aac (LC), 48000 Hz, stereo",
      "[Parsed_volumedetect_0 @ 0x1] max_volume: -inf dB",
    );

    await selectProbed(clip);

    expect(converter.hasAudio.value).toBe(false);
  });

  it("reads a GIF's frame rate", async () => {
    await renderReady();
    const gif = new File(["x"], "loop.gif", { type: "image/gif" });
    probeLogs(
      "  Stream #0:0: Video: gif, bgra, 480x270, 12.50 fps, 12.50 tbr, 100 tbn",
    );

    await selectProbed(gif);

    expect(converter.frameRate.value).toBe(12.5);
  });

  it("keeps the sound unknown when the probe fails", async () => {
    await renderReady();
    fake.ffmpeg.mount.mockRejectedValueOnce(new Error("no WORKERFS"));

    await selectProbed(clip);

    expect(converter.hasAudio.value).toBeNull();
  });

  it("skips the probe for pictures", async () => {
    await renderReady();

    converter.handleFileSelected(
      new File(["x"], "a.png", { type: "image/png" }),
    );

    expect(fake.ffmpeg.mount).not.toHaveBeenCalled();
  });
});

describe("useFormatConverter conversion", () => {
  it("turns a video into a GIF named after the original", async () => {
    await renderReady();
    converter.handleFileSelected(clip);

    await converter.handleConversion({
      targetId: "video-gif",
      qualityId: "24",
      widthId: "640",
      lossy: false,
      clip: { start: 2, end: 7 },
    });

    expect(fake.ffmpeg.exec).toHaveBeenCalledWith(
      buildConvertArgs(
        findTarget("video-gif")!,
        "24",
        "input.mp4",
        { start: 2, end: 7 },
        "640",
      ),
    );
    expect(converter.convertedBlob.value?.type).toBe("image/gif");
    expect(converter.convertedName.value).toBe("Holiday.gif");
    expect(converter.convertedTarget.value?.kind).toBe("image");
    expect(converter.currentStep.value).toBe("download");
  });

  it("shrinks the GIF after FFmpeg when asked", async () => {
    await renderReady();
    converter.handleFileSelected(clip);

    await converter.handleConversion({
      targetId: "video-gif",
      qualityId: "30",
      widthId: "800",
      lossy: true,
      clip: { start: 0, end: 5 },
    });

    expect(compressGif).toHaveBeenCalledOnce();
    expect(await converter.convertedBlob.value?.text()).toBe("small");
    expect(converter.currentStep.value).toBe("download");
  });

  it("keeps FFmpeg's GIF when the lossy pass fails", async () => {
    await renderReady();
    converter.handleFileSelected(clip);
    compressGif.mockRejectedValueOnce(new Error("worker died"));

    await converter.handleConversion({
      targetId: "video-gif",
      qualityId: "30",
      widthId: "800",
      lossy: true,
      clip: { start: 0, end: 5 },
    });

    expect(converter.convertedBlob.value?.type).toBe("image/gif");
    expect(converter.currentStep.value).toBe("download");
  });

  it("decodes a HEIC photo before converting it", async () => {
    await renderReady();
    const photo = new File(["x"], "IMG_1.HEIC", { type: "" });
    converter.handleFileSelected(photo);

    await converter.handleConversion({
      targetId: "jpg",
      qualityId: "high",
      widthId: "",
      lossy: false,
      clip: null,
    });

    expect(heicTo).toHaveBeenCalledOnce();
    expect(fake.ffmpeg.writeFile).toHaveBeenCalledWith(
      "input.png",
      expect.any(Uint8Array),
    );
    expect(converter.convertedName.value).toBe("IMG_1.jpg");
  });
});

describe("useFormatConverter failure and reset", () => {
  it("returns to the picker after a failed conversion", async () => {
    await renderReady();
    await selectProbed(clip);
    fake.ffmpeg.exec.mockRejectedValueOnce(new Error("bad input"));
    vi.useFakeTimers();

    await converter.handleConversion({
      targetId: "webm",
      qualityId: "low",
      widthId: "",
      lossy: false,
      clip: null,
    });

    expect(engine.status.value).toContain("Conversion failed");
    vi.advanceTimersByTime(4000);
    expect(converter.currentStep.value).toBe("pick");
  });

  it("clears everything on reset", async () => {
    await renderReady();
    converter.handleFileSelected(clip);
    await converter.handleConversion({
      targetId: "mp3",
      qualityId: "192k",
      widthId: "",
      lossy: false,
      clip: null,
    });

    converter.handleReset();

    expect(converter.currentStep.value).toBe("upload");
    expect(converter.selectedFile.value).toBeNull();
    expect(converter.convertedBlob.value).toBeNull();
    expect(converter.convertedTarget.value).toBeNull();
  });
});
