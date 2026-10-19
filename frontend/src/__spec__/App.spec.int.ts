import { fireEvent, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.vue";
import {
  createWaveSurferFake,
  type WaveSurferFake,
} from "../components/__spec__/waveSurferHelpers";
import {
  createFfmpegFake,
  type FfmpegFake,
} from "../composables/__spec__/ffmpegHelpers";
import { OUTPUT_FILE_NAME, buildFfmpegArgs } from "../lib/ringtoneConversion";
import { THEME_STORAGE_KEY } from "../lib/themeStorage";

let ffmpegFake: FfmpegFake;
let waveFake: WaveSurferFake;

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: function FFmpeg() {
    return ffmpegFake.ffmpeg;
  },
}));

vi.mock("@ffmpeg/util", () => ({
  toBlobURL: (url: string) => Promise.resolve(`blob:${url}`),
  fetchFile: () => Promise.resolve(new Uint8Array([9])),
}));

vi.mock("wavesurfer.js", () => ({
  default: { create: () => waveFake.waveSurfer },
}));

vi.mock("wavesurfer.js/dist/plugins/regions.js", () => ({
  default: { create: () => ({}) },
}));

const song = new File(["x"], "song.mp3", { type: "audio/mpeg" });

// Renders the app, waits for the engine, picks a file and decodes it
async function openTrimmer(user: ReturnType<typeof userEvent.setup>) {
  const result = render(App);
  await screen.findByText("Drop your audio or video file here");
  await user.upload(
    result.container.querySelector<HTMLInputElement>('input[type="file"]')!,
    song,
  );
  await screen.findByText("Customize Ringtone");
  waveFake.emit("decode");
  await nextTick();
  return result;
}

beforeEach(() => {
  ffmpegFake = createFfmpegFake();
  waveFake = createWaveSurferFake();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.documentElement.removeAttribute("data-theme");
});

describe("App ringtone conversion", () => {
  it("turns the trimmer settings into one ffmpeg run and a download", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await openTrimmer(user);

    waveFake.moveRegion(5, 25);
    await fireEvent.update(screen.getByLabelText(/Volume Boost/), "1.5");
    const title = screen.getByLabelText("Ringtone Filename");
    await user.clear(title);
    await user.type(title, "Alarm");
    await user.click(
      screen.getByRole("button", { name: /Create M4R Ringtone/ }),
    );

    expect(await screen.findByText("Ringtone Created!")).toBeInTheDocument();
    expect(ffmpegFake.ffmpeg.writeFile).toHaveBeenCalledWith(
      "input.mp3",
      expect.any(Uint8Array),
    );
    expect(ffmpegFake.ffmpeg.exec).toHaveBeenCalledWith(
      buildFfmpegArgs(
        {
          startTime: 5,
          endTime: 25,
          volume: 1.5,
          fadeIn: 0,
          fadeOut: 0,
          title: "Alarm",
        },
        "input.mp3",
      ),
    );
    expect(ffmpegFake.ffmpeg.deleteFile).toHaveBeenCalledWith("input.mp3");
    expect(ffmpegFake.ffmpeg.deleteFile).toHaveBeenCalledWith(OUTPUT_FILE_NAME);
    expect(
      await screen.findByRole("link", { name: /Download Ringtone File/ }),
    ).toHaveAttribute("download", "Alarm.m4r");
  });

  it("starts over from the upload after a download", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await openTrimmer(user);
    await user.click(
      screen.getByRole("button", { name: /Create M4R Ringtone/ }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Convert Another File" }),
    );

    expect(
      await screen.findByText("Drop your audio or video file here"),
    ).toBeInTheDocument();
  });

  it("reports a failed conversion and returns to the trimmer", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await openTrimmer(user);
    ffmpegFake.ffmpeg.exec.mockRejectedValueOnce(new Error("bad input"));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await user.click(
      screen.getByRole("button", { name: /Create M4R Ringtone/ }),
    );

    expect(await screen.findByText(/Transcoding failed/)).toBeInTheDocument();
    vi.advanceTimersByTime(4000);
    expect(await screen.findByText("Customize Ringtone")).toBeInTheDocument();
  });

  it("keeps an unsupported file out of the trimmer", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(App);
    await screen.findByText("Drop your audio or video file here");

    await user.upload(
      container.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(["x"], "notes.txt", { type: "text/plain" }),
    );

    expect(screen.getByText(/Unsupported file format/)).toBeInTheDocument();
    expect(screen.queryByText("Customize Ringtone")).not.toBeInTheDocument();
    expect(ffmpegFake.ffmpeg.writeFile).not.toHaveBeenCalled();
  });
});

describe("App theme", () => {
  it("keeps the chosen theme across a reload through localStorage", async () => {
    const user = userEvent.setup();
    const first = render(App);

    await user.click(await screen.findByTitle("Switch to light theme"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    first.unmount();
    document.documentElement.removeAttribute("data-theme");
    render(App);

    expect(
      await screen.findByTitle("Switch to dark theme"),
    ).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
