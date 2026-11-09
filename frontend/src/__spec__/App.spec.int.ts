import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.vue";
import {
  createWaveSurferFake,
  type WaveSurferFake,
} from "../components/ringtone/__spec__/waveSurferHelpers";
import {
  createFfmpegFake,
  stubCoreFetch,
  type FfmpegFake,
} from "../composables/engine/__spec__/ffmpegHelpers";
import { findTarget } from "../lib/convert/formatCatalog";
import { buildConvertArgs } from "../lib/convert/formatConversion";
import {
  OUTPUT_FILE_NAME,
  buildFfmpegArgs,
} from "../lib/ringtone/ringtoneConversion";
import { THEME_STORAGE_KEY } from "../lib/app/themeStorage";

let ffmpegFake: FfmpegFake;
let waveFake: WaveSurferFake;

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: function FFmpeg() {
    return ffmpegFake.ffmpeg;
  },
}));

vi.mock("@ffmpeg/util", () => ({
  fetchFile: () => Promise.resolve(new Uint8Array([9])),
}));

vi.mock("wavesurfer.js", () => ({
  default: { create: () => waveFake.waveSurfer },
}));

vi.mock("wavesurfer.js/dist/plugins/regions.js", () => ({
  default: { create: () => ({}) },
}));

const song = new File(["x"], "song.mp3", { type: "audio/mpeg" });

// Convert is the main tab, the ringtone maker opens from its hash
function renderRingtone() {
  history.replaceState(null, "", "/#ringtone");
  return render(App);
}

// Renders the ringtone maker, waits for the engine, picks a file and decodes it
async function openTrimmer(user: ReturnType<typeof userEvent.setup>) {
  const result = renderRingtone();
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
  stubCoreFetch();
  ffmpegFake = createFfmpegFake();
  waveFake = createWaveSurferFake();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.documentElement.removeAttribute("data-theme");
  history.replaceState(null, "", "/");
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

    await user.click(
      screen.getByRole("button", { name: /Create M4R Ringtone/ }),
    );

    expect(await screen.findByText("Ringtone Failed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to Trimming" }));
    expect(await screen.findByText("Customize Ringtone")).toBeInTheDocument();
  });

  it("returns to the upload from the logo", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await openTrimmer(user);

    await user.click(screen.getByTitle("Back to start"));

    expect(
      await screen.findByText("Drop your audio or video file here"),
    ).toBeInTheDocument();
  });

  it("keeps an unsupported file out of the trimmer", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = renderRingtone();
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

describe("App format conversion", () => {
  it("turns a video into a GIF from the Convert tab", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(App);
    await screen.findByText("Drop your audio, video or image file here");

    await user.upload(
      container.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(["x"], "Holiday.mp4", { type: "video/mp4" }),
    );
    await user.click(
      await screen.findByRole("button", { name: /^Convert To: / }),
    );
    await user.click(screen.getByRole("option", { name: "GIF (animated)" }));
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /^Convert$/ }));

    expect(await screen.findByText("File Converted!")).toBeInTheDocument();
    // jsdom loads no preview, so the GIF falls back to its cap
    expect(ffmpegFake.ffmpeg.exec).toHaveBeenCalledWith(
      buildConvertArgs(
        findTarget("video-gif")!,
        "30",
        "input.mp4",
        { start: 0, end: 30 },
        "800",
      ),
    );
    expect(
      await screen.findByRole("link", { name: /Download File/ }),
    ).toHaveAttribute("download", "Holiday.gif");
  });

  it("swaps the upload when switching tabs back and forth", async () => {
    const user = userEvent.setup();
    render(App);
    await screen.findByText("Drop your audio, video or image file here");
    expect(screen.getByRole("tab", { name: "Convert" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("tab", { name: "Ringtone" }));
    expect(
      await screen.findByText("Drop your audio or video file here"),
    ).toBeInTheDocument();
    expect(await screen.findByText("iPhone M4R Ringtone Maker")).toBeVisible();
    expect(window.location.hash).toBe("#ringtone");

    await user.click(screen.getByRole("tab", { name: "Convert" }));
    expect(
      await screen.findByText("Drop your audio, video or image file here"),
    ).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(
        screen.queryByText("Drop your audio or video file here"),
      ).not.toBeInTheDocument(),
    );
    expect(window.location.hash).toBe("");
  });

  it("opens on the ringtone maker from a link with its hash", async () => {
    renderRingtone();

    expect(
      await screen.findByText("Drop your audio or video file here"),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ringtone" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keeps the ringtone maker free of pictures", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = renderRingtone();
    await screen.findByText("Drop your audio or video file here");

    await user.upload(
      container.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(["x"], "photo.png", { type: "image/png" }),
    );

    expect(screen.getByText(/Unsupported file format/)).toBeInTheDocument();
  });
});

describe("App theme", () => {
  it("keeps the chosen theme across a reload through localStorage", async () => {
    const user = userEvent.setup();
    const first = render(App);

    // A first visit follows the system, then steps to dark and light
    await user.click(await screen.findByTitle("Switch to dark theme"));
    await user.click(screen.getByTitle("Switch to light theme"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    first.unmount();
    document.documentElement.removeAttribute("data-theme");
    render(App);

    expect(
      await screen.findByTitle("Switch to system theme"),
    ).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
