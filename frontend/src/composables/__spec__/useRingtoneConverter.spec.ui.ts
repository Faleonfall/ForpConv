import { render, screen } from "@testing-library/vue";
import { h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SILENT_VIDEO_MESSAGE } from "../../lib/fileValidation";
import {
  OUTPUT_FILE_NAME,
  buildFfmpegArgs,
  type ConvertParams,
} from "../../lib/ringtoneConversion";
import { useFfmpegEngine } from "../useFfmpegEngine";
import { useRingtoneConverter } from "../useRingtoneConverter";
import {
  createFfmpegFake,
  stubCoreFetch,
  type FfmpegFake,
} from "./ffmpegHelpers";

let fake: FfmpegFake;

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: function FFmpeg() {
    return fake.ffmpeg;
  },
}));

vi.mock("@ffmpeg/util", () => ({
  fetchFile: () => Promise.resolve(new Uint8Array([9])),
}));

const params: ConvertParams = {
  startTime: 2,
  endTime: 22,
  volume: 1.2,
  fadeIn: 1,
  fadeOut: 0,
  title: "Alarm",
};

const file = new File(["x"], "song.wav", { type: "audio/wav" });

let engine: ReturnType<typeof useFfmpegEngine>;
let converter: ReturnType<typeof useRingtoneConverter>;

const ConverterHost = {
  setup() {
    engine = useFfmpegEngine();
    converter = useRingtoneConverter(engine);
    return () =>
      h("div", [
        h("p", { "data-testid": "ready" }, String(engine.isReady.value)),
        h("p", { "data-testid": "step" }, converter.currentStep.value),
      ]);
  },
};

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
});

describe("useRingtoneConverter steps", () => {
  it("starts at the upload", async () => {
    await renderReady();

    expect(screen.getByTestId("step")).toHaveTextContent("upload");
  });

  it("moves to trimming once a file is picked", async () => {
    await renderReady();

    await converter.handleFileSelected(file);

    await vi.waitFor(() =>
      expect(screen.getByTestId("step")).toHaveTextContent("trim"),
    );
  });

  it("turns away a video without sound", async () => {
    await renderReady();
    fake.ffmpeg.exec.mockImplementationOnce(() => {
      fake.reportLog("  Stream #0:0[0x1](und): Video: h264 (High), yuv420p");
      return Promise.resolve(1);
    });

    await converter.handleFileSelected(
      new File(["x"], "screen.mov", { type: "video/quicktime" }),
    );

    expect(converter.uploadError.value).toBe(SILENT_VIDEO_MESSAGE);
    expect(screen.getByTestId("step")).toHaveTextContent("upload");
  });

  it("hides the rejection after ten seconds", async () => {
    await renderReady();
    vi.useFakeTimers();
    fake.ffmpeg.exec.mockImplementationOnce(() => {
      fake.reportLog("  Stream #0:0[0x1](und): Video: h264 (High), yuv420p");
      return Promise.resolve(1);
    });
    await converter.handleFileSelected(
      new File(["x"], "screen.mov", { type: "video/quicktime" }),
    );

    vi.advanceTimersByTime(9_999);
    expect(converter.uploadError.value).toBe(SILENT_VIDEO_MESSAGE);
    vi.advanceTimersByTime(1);
    expect(converter.uploadError.value).toBe("");
  });

  it("lets a video in when its sound can't be checked", async () => {
    await renderReady();

    await converter.handleFileSelected(
      new File(["x"], "clip.mp4", { type: "video/mp4" }),
    );

    expect(converter.uploadError.value).toBe("");
    expect(screen.getByTestId("step")).toHaveTextContent("trim");
  });
});

describe("useRingtoneConverter conversion", () => {
  it("converts the selection into an m4r blob", async () => {
    await renderReady();
    await converter.handleFileSelected(file);

    await converter.handleConversion(params);

    expect(fake.ffmpeg.writeFile).toHaveBeenCalledWith(
      "input.wav",
      expect.any(Uint8Array),
    );
    expect(fake.ffmpeg.exec).toHaveBeenCalledWith(
      buildFfmpegArgs(params, "input.wav"),
    );
    expect(fake.ffmpeg.deleteFile).toHaveBeenCalledWith(OUTPUT_FILE_NAME);
    expect(converter.generatedRingtoneBlob.value?.type).toBe("audio/x-m4r");
    expect(converter.ringtoneTitle.value).toBe("Alarm");
    await vi.waitFor(() =>
      expect(screen.getByTestId("step")).toHaveTextContent("download"),
    );
  });

  it("measures progress against the selection length", async () => {
    await renderReady();
    await converter.handleFileSelected(file);
    let seen = 0;
    fake.ffmpeg.exec.mockImplementationOnce(() => {
      // Twenty second selection, five seconds written
      fake.reportLog("size=  80kB time=00:00:05.00 bitrate= 192kbits/s");
      seen = engine.progress.value;
      return Promise.resolve(0);
    });

    await converter.handleConversion(params);

    expect(seen).toBe(25);
  });

  it("holds a failed conversion until the user goes back", async () => {
    await renderReady();
    await converter.handleFileSelected(file);
    fake.ffmpeg.exec.mockRejectedValueOnce(new Error("bad input"));

    await converter.handleConversion(params);

    expect(engine.status.value).toBe("Please check the file and try again.");
    expect(converter.failed.value).toBe(true);
    expect(converter.currentStep.value).toBe("converting");

    converter.handleBack();

    expect(converter.failed.value).toBe(false);
    expect(converter.currentStep.value).toBe("trim");
  });

  it("clears the result on reset", async () => {
    await renderReady();
    await converter.handleFileSelected(file);
    await converter.handleConversion(params);

    converter.handleReset();

    expect(converter.currentStep.value).toBe("upload");
    expect(converter.selectedFile.value).toBeNull();
    expect(converter.generatedRingtoneBlob.value).toBeNull();
    expect(converter.ringtoneTitle.value).toBe("");
  });

  it("drops the file on cancel", async () => {
    await renderReady();
    await converter.handleFileSelected(file);

    converter.handleCancel();

    expect(converter.currentStep.value).toBe("upload");
    expect(converter.selectedFile.value).toBeNull();
  });
});
