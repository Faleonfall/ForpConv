import { fireEvent, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FormatPicker from "../FormatPicker.vue";

type User = ReturnType<typeof userEvent.setup>;

const clip = new File(["x"], "clip.mov", { type: "video/quicktime" });

// jsdom never loads media, so report a length by hand once the preview
// renders after mount
async function loadPreview(container: Element, duration: number) {
  const media = await vi.waitFor(() => {
    const found = container.querySelector("video, audio");
    if (!found) throw new Error("preview missing");
    return found;
  });
  Object.defineProperty(media, "duration", { value: duration });
  await fireEvent(media, new Event("loadedmetadata"));
}

// A select cell is a button named after its label and the current pick
function cell(label: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${label}: `) });
}

function queryCell(label: string): HTMLElement | null {
  return screen.queryByRole("button", { name: new RegExp(`^${label}: `) });
}

function pickedIn(label: string): string {
  return (cell(label).getAttribute("aria-label") ?? "").slice(label.length + 2);
}

// Opens a select and clicks one option in its panel
async function choose(user: User, label: string, option: string) {
  await user.click(cell(label));
  await user.click(screen.getByRole("option", { name: option }));
}

describe("FormatPicker", () => {
  it("starts on a new format at its best quality", async () => {
    const user = userEvent.setup();
    const { container, emitted } = render(FormatPicker, {
      props: { file: clip },
    });
    await loadPreview(container, 60);

    expect(screen.getByText("clip.mov")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Convert$/ }));

    expect(emitted("convert")).toEqual([
      [
        {
          targetId: "mp4",
          qualityId: "high",
          widthId: "",
          lossy: false,
          clip: null,
          frameTime: null,
        },
      ],
    ]);
  });

  it("turns the first seconds of a video into a GIF", async () => {
    const user = userEvent.setup();
    const { container, emitted } = render(FormatPicker, {
      props: { file: clip },
    });
    await loadPreview(container, 60);

    await choose(user, "Convert To", "GIF (animated)");
    await choose(user, "Frame Rate", "15 fps");
    await choose(user, "Width", "480 px");
    await user.click(screen.getByRole("button", { name: /^Convert$/ }));

    expect(emitted("convert")).toEqual([
      [
        {
          targetId: "video-gif",
          qualityId: "15",
          widthId: "480",
          lossy: false,
          clip: { start: 0, end: 5 },
          frameTime: null,
        },
      ],
    ]);
  });
});

describe("FormatPicker timeline", () => {
  it("picks a moment instead of a range for a still image", async () => {
    const user = userEvent.setup();
    const { container, emitted } = render(FormatPicker, {
      props: { file: clip },
    });
    await loadPreview(container, 60);

    await choose(user, "Convert To", "PNG");

    expect(
      screen.queryByRole("slider", { name: "Trim start" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Frame at/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Convert$/ }));
    expect(emitted("convert")).toEqual([
      [expect.objectContaining({ targetId: "png", frameTime: 0 })],
    ]);
  });

  it("trims a GIF on its playable copy, whole by default", async () => {
    const user = userEvent.setup();
    const gif = new File(["x"], "anim.gif", { type: "image/gif" });
    const timeline = new File(["x"], "timeline.mp4", { type: "video/mp4" });
    const { container, emitted } = render(FormatPicker, {
      props: { file: gif, timelineFile: timeline },
    });
    await choose(user, "Convert To", "GIF (animated)");
    await loadPreview(container, 8);

    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "8",
    );

    await user.click(screen.getByRole("button", { name: /^Convert$/ }));
    expect(emitted("convert")).toEqual([
      [expect.objectContaining({ targetId: "video-gif", clip: null })],
    ]);
  });

  it("notes the timeline while the GIF copy renders", async () => {
    const gif = new File(["x"], "anim.gif", { type: "image/gif" });
    render(FormatPicker, { props: { file: gif, preparingTimeline: true } });

    expect(
      await screen.findByText("Preparing timeline..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "anim.gif" })).toBeInTheDocument();
  });
});

describe("FormatPicker animated output", () => {
  it("offers GIF frame rates and widths up to 30 fps and 800px", async () => {
    const user = userEvent.setup();
    render(FormatPicker, { props: { file: clip } });

    await choose(user, "Convert To", "GIF (animated)");

    expect(pickedIn("Frame Rate")).toBe("30 fps");
    expect(pickedIn("Width")).toBe("800 px");
    expect(queryCell("Quality")).not.toBeInTheDocument();

    await choose(user, "Convert To", "MP4 (H.264)");

    expect(queryCell("Width")).not.toBeInTheDocument();
  });

  it("asks for a smaller GIF only when the switch is on", async () => {
    const user = userEvent.setup();
    const { emitted } = render(FormatPicker, { props: { file: clip } });

    expect(
      screen.queryByRole("radio", { name: "Smaller" }),
    ).not.toBeInTheDocument();
    await choose(user, "Convert To", "GIF (animated)");
    expect(screen.getByRole("radio", { name: "Best" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Smaller" }));
    await user.click(screen.getByRole("button", { name: /^Convert$/ }));

    expect(emitted<[{ lossy: boolean }]>("convert")[0]?.[0].lossy).toBe(true);
  });

  it("caps a GIF without a preview at thirty seconds", async () => {
    const user = userEvent.setup();
    const { emitted } = render(FormatPicker, { props: { file: clip } });

    await choose(user, "Convert To", "GIF (animated)");
    await user.click(screen.getByRole("button", { name: /^Convert$/ }));

    expect(emitted("convert")).toEqual([
      [
        {
          targetId: "video-gif",
          qualityId: "30",
          widthId: "800",
          lossy: false,
          clip: { start: 0, end: 30 },
          frameTime: null,
        },
      ],
    ]);
  });
});

describe("FormatPicker options", () => {
  it("resets the quality to the new format's default", async () => {
    const user = userEvent.setup();
    const song = new File(["x"], "song.wav", { type: "audio/wav" });
    render(FormatPicker, { props: { file: song } });

    await choose(user, "Quality", "128 kbps");
    await choose(user, "Convert To", "Opus");

    expect(pickedIn("Quality")).toBe("320 kbps");
  });

  it("leaves an audio pick once the video turns out silent", async () => {
    const user = userEvent.setup();
    const { rerender } = render(FormatPicker, {
      props: { file: clip, hasAudio: null },
    });
    await choose(user, "Convert To", "MP3");

    await rerender({ file: clip, hasAudio: false });

    expect(pickedIn("Convert To")).toBe("MP4 (H.264)");
    await user.click(cell("Convert To"));
    expect(
      screen.queryByRole("option", { name: "MP3" }),
    ).not.toBeInTheDocument();
  });

  it("hides quality for a lossless format", async () => {
    const user = userEvent.setup();
    const song = new File(["x"], "song.mp3", { type: "audio/mpeg" });
    render(FormatPicker, { props: { file: song } });

    await choose(user, "Convert To", "FLAC (lossless)");

    expect(queryCell("Quality")).not.toBeInTheDocument();
  });

  it("estimates the size only for steady bitrate formats", async () => {
    const user = userEvent.setup();
    const song = new File(["x"], "song.wav", { type: "audio/wav" });
    const { container } = render(FormatPicker, { props: { file: song } });
    await loadPreview(container, 60);

    expect(
      screen.getByText("Estimated size: about 2.29 MB"),
    ).toBeInTheDocument();

    await choose(user, "Convert To", "FLAC (lossless)");

    expect(screen.queryByText(/Estimated size/)).not.toBeInTheDocument();
  });
});

describe("FormatPicker image input", () => {
  it("offers video formats and no trim for an animated GIF", async () => {
    const user = userEvent.setup();
    const gif = new File(["x"], "anim.gif", { type: "image/gif" });
    render(FormatPicker, { props: { file: gif } });

    await user.click(cell("Convert To"));

    expect(
      screen.getByRole("option", { name: "MP4 (H.264)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("slider", { name: "Trim start" }),
    ).not.toBeInTheDocument();
  });

  it("switches a GIF to its own frame rate once the probe reads it", async () => {
    const user = userEvent.setup();
    const gif = new File(["x"], "anim.gif", { type: "image/gif" });
    const { rerender } = render(FormatPicker, { props: { file: gif } });
    await choose(user, "Convert To", "WebP (animated)");

    expect(pickedIn("Frame Rate")).toBe("30 fps");

    await rerender({ file: gif, frameRate: 12.5 });

    expect(pickedIn("Frame Rate")).toBe("Original (12.5 fps)");
    await user.click(cell("Frame Rate"));
    expect(
      screen.queryByRole("option", { name: "15 fps" }),
    ).not.toBeInTheDocument();
  });

  it("previews an image and hides it when the browser can't show it", async () => {
    const heic = new File(["x"], "photo.heic", { type: "image/heic" });
    render(FormatPicker, { props: { file: heic } });

    const image = await screen.findByRole("img", { name: "photo.heic" });
    expect(image.getAttribute("src")).toMatch(/^blob:/);

    await fireEvent.error(image);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("emits cancel to change the file", async () => {
    const user = userEvent.setup();
    const { emitted } = render(FormatPicker, { props: { file: clip } });

    await user.click(screen.getByRole("button", { name: "Change File" }));

    expect(emitted("cancel")).toHaveLength(1);
  });
});
