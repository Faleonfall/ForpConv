import { fireEvent, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FormatPicker from "../FormatPicker.vue";

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

    await user.selectOptions(screen.getByLabelText("Convert To"), "video-gif");
    await user.selectOptions(screen.getByLabelText("Frame Rate"), "15");
    await user.selectOptions(screen.getByLabelText("Width"), "480");
    await user.click(screen.getByRole("button", { name: /^Convert$/ }));

    expect(emitted("convert")).toEqual([
      [
        {
          targetId: "video-gif",
          qualityId: "15",
          widthId: "480",
          lossy: false,
          clip: { start: 0, end: 5 },
        },
      ],
    ]);
  });
});

describe("FormatPicker animated output", () => {
  it("offers GIF frame rates and widths up to 30 fps and 800px", async () => {
    const user = userEvent.setup();
    render(FormatPicker, { props: { file: clip } });

    await user.selectOptions(screen.getByLabelText("Convert To"), "video-gif");

    expect(screen.getByLabelText("Frame Rate")).toHaveValue("30");
    expect(screen.getByLabelText("Width")).toHaveValue("800");
    expect(screen.queryByLabelText("Quality")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Convert To"), "mp4");

    expect(screen.queryByLabelText("Width")).not.toBeInTheDocument();
  });

  it("asks for a smaller GIF only when the switch is on", async () => {
    const user = userEvent.setup();
    const { emitted } = render(FormatPicker, { props: { file: clip } });

    expect(
      screen.queryByRole("checkbox", { name: /Smaller file/ }),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Convert To"), "video-gif");
    const smaller = screen.getByRole("checkbox", { name: /Smaller file/ });
    expect(smaller).not.toBeChecked();

    await user.click(smaller);
    await user.click(screen.getByRole("button", { name: /^Convert$/ }));

    expect(emitted<[{ lossy: boolean }]>("convert")[0]?.[0].lossy).toBe(true);
  });

  it("caps a GIF without a preview at thirty seconds", async () => {
    const user = userEvent.setup();
    const { emitted } = render(FormatPicker, { props: { file: clip } });

    await user.selectOptions(screen.getByLabelText("Convert To"), "video-gif");
    await user.click(screen.getByRole("button", { name: /^Convert$/ }));

    expect(emitted("convert")).toEqual([
      [
        {
          targetId: "video-gif",
          qualityId: "30",
          widthId: "800",
          lossy: false,
          clip: { start: 0, end: 30 },
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

    await user.selectOptions(screen.getByLabelText("Quality"), "128k");
    await user.selectOptions(screen.getByLabelText("Convert To"), "opus");

    expect(screen.getByLabelText("Quality")).toHaveValue("320k");
  });

  it("leaves an audio pick once the video turns out silent", async () => {
    const user = userEvent.setup();
    const { rerender } = render(FormatPicker, {
      props: { file: clip, hasAudio: null },
    });
    await user.selectOptions(screen.getByLabelText("Convert To"), "mp3");

    await rerender({ file: clip, hasAudio: false });

    expect(
      screen.queryByRole("option", { name: "MP3" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Convert To")).toHaveValue("mp4");
  });

  it("hides quality for a lossless format", async () => {
    const user = userEvent.setup();
    const song = new File(["x"], "song.mp3", { type: "audio/mpeg" });
    render(FormatPicker, { props: { file: song } });

    await user.selectOptions(screen.getByLabelText("Convert To"), "flac");

    expect(screen.queryByLabelText("Quality")).not.toBeInTheDocument();
  });

  it("estimates the size only for steady bitrate formats", async () => {
    const user = userEvent.setup();
    const song = new File(["x"], "song.wav", { type: "audio/wav" });
    const { container } = render(FormatPicker, { props: { file: song } });
    await loadPreview(container, 60);

    expect(
      screen.getByText("Estimated size: about 2.29 MB"),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Convert To"), "opus");

    expect(screen.queryByText(/Estimated size/)).not.toBeInTheDocument();
  });
});

describe("FormatPicker image input", () => {
  it("offers video formats and no trim for an animated GIF", () => {
    const gif = new File(["x"], "anim.gif", { type: "image/gif" });
    render(FormatPicker, { props: { file: gif } });

    expect(screen.getByRole("option", { name: "MP4 (H.264)" })).toBeVisible();
    expect(
      screen.queryByRole("slider", { name: "Trim start" }),
    ).not.toBeInTheDocument();
  });

  it("switches a GIF to its own frame rate once the probe reads it", async () => {
    const user = userEvent.setup();
    const gif = new File(["x"], "anim.gif", { type: "image/gif" });
    const { rerender } = render(FormatPicker, { props: { file: gif } });
    await user.selectOptions(screen.getByLabelText("Convert To"), "video-webp");

    expect(screen.getByLabelText("Frame Rate")).toHaveValue("30");

    await rerender({ file: gif, frameRate: 12.5 });

    expect(screen.getByLabelText("Frame Rate")).toHaveValue("original");
    expect(
      screen.getByRole("option", { name: "Original (12.5 fps)" }),
    ).toBeInTheDocument();
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
