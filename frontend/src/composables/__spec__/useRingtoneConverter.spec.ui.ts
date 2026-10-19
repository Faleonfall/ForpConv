import { render, screen } from "@testing-library/vue";
import { h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OUTPUT_FILE_NAME,
  buildFfmpegArgs,
  type ConvertParams,
} from "../../lib/ringtoneConversion";
import { useRingtoneConverter } from "../useRingtoneConverter";
import { createFfmpegFake, type FfmpegFake } from "./ffmpegHelpers";

let fake: FfmpegFake;

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: function FFmpeg() {
    return fake.ffmpeg;
  },
}));

vi.mock("@ffmpeg/util", () => ({
  toBlobURL: (url: string) => Promise.resolve(`blob:${url}`),
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

let converter: ReturnType<typeof useRingtoneConverter>;

const ConverterHost = {
  setup() {
    converter = useRingtoneConverter();
    return () =>
      h("div", [
        h("p", { "data-testid": "step" }, converter.currentStep.value),
        h("p", { "data-testid": "status" }, converter.conversionStatus.value),
      ]);
  },
};

async function renderReady() {
  render(ConverterHost);
  await vi.waitFor(() =>
    expect(screen.getByTestId("step")).toHaveTextContent("upload"),
  );
}

beforeEach(() => {
  fake = createFfmpegFake();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useRingtoneConverter steps", () => {
  it("loads the engine before offering the upload", async () => {
    render(ConverterHost);

    expect(screen.getByTestId("step")).toHaveTextContent("loading");
    await vi.waitFor(() =>
      expect(screen.getByTestId("step")).toHaveTextContent("upload"),
    );
    expect(fake.ffmpeg.load).toHaveBeenCalledOnce();
  });

  it("reports a failed engine load", async () => {
    fake.ffmpeg.load.mockRejectedValueOnce(new Error("no wasm"));
    render(ConverterHost);

    await vi.waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent(
        "Failed to load processing engine",
      ),
    );
    expect(screen.getByTestId("step")).toHaveTextContent("loading");
  });

  it("moves to trimming once a file is picked", async () => {
    await renderReady();

    converter.handleFileSelected(file);

    await vi.waitFor(() =>
      expect(screen.getByTestId("step")).toHaveTextContent("trim"),
    );
  });
});

describe("useRingtoneConverter conversion", () => {
  it("converts the selection into an m4r blob", async () => {
    await renderReady();
    converter.handleFileSelected(file);

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

  it("shows progress while converting", async () => {
    await renderReady();
    converter.handleFileSelected(file);
    fake.ffmpeg.exec.mockImplementationOnce(() => {
      fake.reportProgress(0.42);
      return Promise.resolve(0);
    });

    await converter.handleConversion(params);

    expect(converter.conversionProgress.value).toBe(42);
  });

  it("returns to trimming after a failed conversion", async () => {
    await renderReady();
    converter.handleFileSelected(file);
    fake.ffmpeg.exec.mockRejectedValueOnce(new Error("bad input"));
    vi.useFakeTimers();

    await converter.handleConversion(params);

    expect(converter.conversionStatus.value).toContain("Transcoding failed");
    expect(converter.currentStep.value).toBe("converting");
    vi.advanceTimersByTime(4000);
    expect(converter.currentStep.value).toBe("trim");
  });

  it("clears the result on reset", async () => {
    await renderReady();
    converter.handleFileSelected(file);
    await converter.handleConversion(params);

    converter.handleReset();

    expect(converter.currentStep.value).toBe("upload");
    expect(converter.selectedFile.value).toBeNull();
    expect(converter.generatedRingtoneBlob.value).toBeNull();
    expect(converter.ringtoneTitle.value).toBe("");
  });

  it("drops the file on cancel", async () => {
    await renderReady();
    converter.handleFileSelected(file);

    converter.handleCancel();

    expect(converter.currentStep.value).toBe("upload");
    expect(converter.selectedFile.value).toBeNull();
  });
});
