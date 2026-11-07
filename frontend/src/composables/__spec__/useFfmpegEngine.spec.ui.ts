import { render, screen } from "@testing-library/vue";
import { h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CORE_FILES } from "../../lib/ffmpegNetwork";
import { useFfmpegEngine, type EngineJob } from "../useFfmpegEngine";
import {
  createFfmpegFake,
  streamedResponse,
  stubCoreFetch,
  type FfmpegFake,
} from "./ffmpegHelpers";

let fake: FfmpegFake;
let coreFetch: ReturnType<typeof stubCoreFetch>;

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: function FFmpeg() {
    return fake.ffmpeg;
  },
}));

vi.mock("@ffmpeg/util", () => ({
  fetchFile: () => Promise.resolve(new Uint8Array([9])),
}));

const job: EngineJob = {
  input: new Blob(["x"]),
  inputName: "input.wav",
  args: ["-i", "input.wav", "output.mp3"],
  outputName: "output.mp3",
  mime: "audio/mpeg",
  progressLabel: "Converting...",
  outputSeconds: 10,
  readsFirst: false,
};

let engine: ReturnType<typeof useFfmpegEngine>;

const EngineHost = {
  setup() {
    engine = useFfmpegEngine();
    return () =>
      h("div", [
        h("p", { "data-testid": "ready" }, String(engine.isReady.value)),
        h("p", { "data-testid": "status" }, engine.status.value),
        h("p", { "data-testid": "load" }, engine.loadStatus.value),
      ]);
  },
};

async function renderReady() {
  render(EngineHost);
  await vi.waitFor(() =>
    expect(screen.getByTestId("ready")).toHaveTextContent("true"),
  );
}

beforeEach(() => {
  coreFetch = stubCoreFetch();
  fake = createFfmpegFake();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useFfmpegEngine loading", () => {
  it("loads the core once on mount", async () => {
    render(EngineHost);

    expect(screen.getByTestId("ready")).toHaveTextContent("false");
    await vi.waitFor(() =>
      expect(screen.getByTestId("ready")).toHaveTextContent("true"),
    );
    expect(fake.ffmpeg.load).toHaveBeenCalledOnce();
  });

  it("fills the load bar as the core streams in", async () => {
    // Half the wasm arrives, then the rest after the check below
    const [js, wasm] = CORE_FILES.map((file) => file.bytes);
    let releaseWasm = () => {};
    coreFetch.mockImplementation(((url: string) =>
      url.endsWith(".wasm")
        ? new Promise((resolve) => {
            releaseWasm = () =>
              resolve(streamedResponse([wasm! / 2, wasm! / 2]));
          })
        : Promise.resolve(streamedResponse([js!]))) as never);
    render(EngineHost);

    await vi.waitFor(() =>
      expect(screen.getByTestId("load")).toHaveTextContent(
        /^Downloading engine\.\.\.$/,
      ),
    );
    expect(engine.loadProgress.value).toBe(0);

    releaseWasm();

    await vi.waitFor(() =>
      expect(screen.getByTestId("ready")).toHaveTextContent("true"),
    );
    expect(engine.loadProgress.value).toBe(100);
  });

  it("reports a failed load", async () => {
    fake.ffmpeg.load.mockRejectedValueOnce(new Error("no wasm"));
    render(EngineHost);

    await vi.waitFor(() =>
      expect(screen.getByTestId("load")).toHaveTextContent(
        "Failed to load processing engine",
      ),
    );
    expect(engine.loadFailed.value).toBe(true);
    expect(screen.getByTestId("ready")).toHaveTextContent("false");
  });
});

describe("useFfmpegEngine run", () => {
  it("runs one job into a typed blob and cleans up", async () => {
    await renderReady();

    const blob = await engine.run(job);

    expect(fake.ffmpeg.writeFile).toHaveBeenCalledWith(
      "input.wav",
      expect.any(Uint8Array),
    );
    expect(fake.ffmpeg.exec).toHaveBeenCalledWith(job.args);
    expect(fake.ffmpeg.deleteFile).toHaveBeenCalledWith("input.wav");
    expect(fake.ffmpeg.deleteFile).toHaveBeenCalledWith("output.mp3");
    expect(blob.type).toBe("audio/mpeg");
  });

  it("measures progress against the output length from the log", async () => {
    await renderReady();
    fake.ffmpeg.exec.mockImplementationOnce(() => {
      // The input is a minute long, the job only writes ten seconds
      fake.reportLog("  Duration: 00:01:00.00, start: 0.000000");
      fake.reportLog("size=  12kB time=00:00:04.20 bitrate= 128kbits/s");
      expect(engine.progress.value).toBe(42);
      expect(engine.status.value).toMatch(
        /^Converting\.\.\.\s42% · 0:0\d\selapsed/,
      );
      return Promise.resolve(0);
    });

    await engine.run(job);

    expect(engine.progress.value).toBe(100);
  });

  it("takes the input duration when the output length is unknown", async () => {
    await renderReady();
    fake.ffmpeg.exec.mockImplementationOnce(() => {
      fake.reportLog("  Duration: 00:00:20.00, start: 0.000000");
      fake.reportLog("frame=  120 time=00:00:05.00 speed=1x");
      expect(engine.progress.value).toBe(25);
      return Promise.resolve(0);
    });

    await engine.run({ ...job, outputSeconds: null });
  });

  it("counts the GIF palette read before any frame is written", async () => {
    await renderReady();
    fake.ffmpeg.exec.mockImplementationOnce(() => {
      fake.reportLog("[Parsed_showinfo_3 @ 0x1] n:  60 pts_time:5 duration:1");
      expect(engine.progress.value).toBe(35);
      return Promise.resolve(0);
    });

    await engine.run({ ...job, readsFirst: true });
  });

  it("ignores the log outside a job", async () => {
    await renderReady();

    fake.reportLog("frame=  120 time=00:00:05.00 speed=1x");

    expect(engine.progress.value).toBe(0);
  });

  it("fails on a nonzero exit and still cleans up", async () => {
    await renderReady();
    fake.ffmpeg.exec.mockResolvedValueOnce(1);

    await expect(engine.run(job)).rejects.toThrow("FFmpeg exited with 1");
    expect(fake.ffmpeg.readFile).not.toHaveBeenCalled();
    expect(fake.ffmpeg.deleteFile).toHaveBeenCalledWith("input.wav");
    expect(fake.ffmpeg.terminate).not.toHaveBeenCalled();
  });
});

describe("useFfmpegEngine crash recovery", () => {
  const fault = new Error("RuntimeError: memory access out of bounds");

  it("swaps in a fresh core after a job faults", async () => {
    await renderReady();
    fake.ffmpeg.exec.mockRejectedValueOnce(fault);

    await expect(engine.run(job)).rejects.toBe(fault);

    expect(fake.ffmpeg.terminate).toHaveBeenCalledOnce();
    expect(fake.ffmpeg.load).toHaveBeenCalledTimes(2);
    await expect(engine.run(job)).resolves.toBeInstanceOf(Blob);
  });

  it("swaps in a fresh core after a probe faults", async () => {
    await renderReady();
    fake.ffmpeg.exec.mockRejectedValueOnce(fault);

    await expect(
      engine.probeStreams(new File(["x"], "clip.mp4")),
    ).resolves.toEqual({ hasAudio: null, frameRate: null });

    expect(fake.ffmpeg.terminate).toHaveBeenCalledOnce();
    expect(fake.ffmpeg.unmount).not.toHaveBeenCalled();
    expect(fake.ffmpeg.load).toHaveBeenCalledTimes(2);
  });

  it("offers a retry when the fresh core fails to load", async () => {
    await renderReady();
    fake.ffmpeg.exec.mockRejectedValueOnce(fault);
    fake.ffmpeg.load.mockRejectedValueOnce(new Error("offline"));

    await expect(engine.run(job)).rejects.toBe(fault);

    expect(engine.loadFailed.value).toBe(true);
    expect(screen.getByTestId("ready")).toHaveTextContent("false");
  });
});
