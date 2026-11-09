import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";
import ClipRange from "../ClipRange.vue";
import { findTarget } from "../../../lib/convert/formatCatalog";

const clip = new File(["x"], "clip.mp4", { type: "video/mp4" });
const gif = findTarget("video-gif");
const mp4 = findTarget("mp4");
// With a 60s clip on a 600px track, every 10px is one second
const TRACK_WIDTH = 600;

// The preview renders once the object URL exists after mount
function findVideo(container: Element): Promise<HTMLVideoElement> {
  return vi.waitFor(() => {
    const video = container.querySelector("video");
    if (!video) throw new Error("preview missing");
    return video;
  });
}

// jsdom never loads media or lays out, so report a length and a track size
async function loadPreview(container: Element, duration = 60) {
  const video = await findVideo(container);
  Object.defineProperty(video, "duration", { value: duration });
  await fireEvent(video, new Event("loadedmetadata"));
  const track = container.querySelector<HTMLElement>(".trim-track")!;
  track.getBoundingClientRect = () =>
    ({ left: 0, width: TRACK_WIDTH }) as DOMRect;
  return { video, track };
}

// Presses on a grip, moves along the track and lets go
async function drag(grip: Element, track: Element, fromX: number, toX: number) {
  await fireEvent.pointerDown(grip, {
    clientX: fromX,
    button: 0,
    pointerId: 1,
  });
  await fireEvent.pointerMove(track, { clientX: toX, pointerId: 1 });
  await fireEvent.pointerUp(track, { clientX: toX, pointerId: 1 });
}

function lastClip(emitted: ReturnType<typeof render>["emitted"]) {
  return emitted<[unknown]>("change").at(-1)?.[0];
}

describe("ClipRange", () => {
  it("selects the first five seconds for a GIF", async () => {
    const { container, emitted } = render(ClipRange, {
      props: { file: clip, target: gif },
    });

    await loadPreview(container);

    expect(screen.getByText("5.0s")).toBeInTheDocument();
    expect(screen.getByText("of max 30s")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuenow",
      "5",
    );
    expect(lastClip(emitted)).toEqual({ start: 0, end: 5 });
  });

  it("keeps the whole file for a video target", async () => {
    const { container, emitted } = render(ClipRange, {
      props: { file: clip, target: mp4 },
    });

    await loadPreview(container);

    expect(screen.queryByText(/max/)).not.toBeInTheDocument();
    expect(lastClip(emitted)).toBeNull();
  });

  it("stops the end handle at the GIF cap", async () => {
    const { container, emitted } = render(ClipRange, {
      props: { file: clip, target: gif },
    });
    const { track } = await loadPreview(container);

    await drag(
      screen.getByRole("slider", { name: "Trim end" }),
      track,
      50,
      400,
    );

    expect(lastClip(emitted)).toEqual({ start: 0, end: 30 });
    expect(screen.getByText(/Long animations get large/)).toBeInTheDocument();
  });

  it("slides the whole selection when dragged in the middle", async () => {
    const { container, emitted } = render(ClipRange, {
      props: { file: clip, target: gif },
    });
    const { track } = await loadPreview(container);

    await drag(container.querySelector(".trim-window")!, track, 20, 120);

    expect(lastClip(emitted)).toEqual({ start: 10, end: 15 });
  });

  it("nudges a handle with the arrow keys", async () => {
    const { container, emitted } = render(ClipRange, {
      props: { file: clip, target: gif },
    });
    await loadPreview(container);
    const start = screen.getByRole("slider", { name: "Trim start" });

    await fireEvent.keyDown(start, { key: "ArrowRight", shiftKey: true });
    await fireEvent.keyDown(start, { key: "ArrowRight" });

    expect(lastClip(emitted)).toEqual({ start: 1.1, end: 5 });
  });

  it("clamps a picked range when the target switches to GIF", async () => {
    const { container, emitted, rerender } = render(ClipRange, {
      props: { file: clip, target: mp4 },
    });
    const { track } = await loadPreview(container);
    await drag(
      screen.getByRole("slider", { name: "Trim start" }),
      track,
      0,
      100,
    );

    await rerender({ file: clip, target: gif });

    expect(lastClip(emitted)).toEqual({ start: 10, end: 40 });
  });
});

describe("ClipRange playhead", () => {
  it("moves the playhead where the track is pressed", async () => {
    const { container } = render(ClipRange, {
      props: { file: clip, target: mp4 },
    });
    const { video, track } = await loadPreview(container);

    await fireEvent.pointerDown(track, { clientX: 300, button: 0 });

    expect(video.currentTime).toBe(30);
    expect(track.style.getPropertyValue("--trim-playhead")).toBe("50%");
  });

  it("drags the playhead inside the selection without moving it", async () => {
    const { container, emitted } = render(ClipRange, {
      props: { file: clip, target: gif },
    });
    const { video, track } = await loadPreview(container);
    const playhead = container.querySelector(".trim-playhead")!;

    await drag(playhead, track, 0, 30);

    expect(video.currentTime).toBe(3);
    expect(lastClip(emitted)).toEqual({ start: 0, end: 5 });
  });

  it("keeps scrubbing while the track is held", async () => {
    const { container } = render(ClipRange, {
      props: { file: clip, target: mp4 },
    });
    const { video, track } = await loadPreview(container);

    await drag(track, track, 300, 420);
    // The second seek waits for the first to land
    expect(video.currentTime).toBe(30);
    expect(track.style.getPropertyValue("--trim-playhead")).toBe("70%");

    await fireEvent(video, new Event("seeked"));

    expect(video.currentTime).toBe(42);
  });

  it("jumps to the latest of many seeks once one lands", async () => {
    const { container } = render(ClipRange, {
      props: { file: clip, target: mp4 },
    });
    const { video, track } = await loadPreview(container);

    await fireEvent.pointerDown(track, {
      clientX: 100,
      button: 0,
      pointerId: 1,
    });
    await fireEvent.pointerMove(track, { clientX: 200, pointerId: 1 });
    await fireEvent.pointerMove(track, { clientX: 500, pointerId: 1 });
    await fireEvent(video, new Event("seeked"));

    expect(video.currentTime).toBe(50);
  });

  it("plays the selection from its start", async () => {
    const { container } = render(ClipRange, {
      props: { file: clip, target: gif },
    });
    const { video } = await loadPreview(container);
    const play = vi.spyOn(video, "play").mockResolvedValue();
    video.currentTime = 30;

    await fireEvent.click(screen.getByTitle("Play selection"));

    expect(video.currentTime).toBe(0);
    expect(play).toHaveBeenCalledOnce();
  });

  it("falls back to a capped clip when the preview fails", async () => {
    const { container, emitted } = render(ClipRange, {
      props: { file: clip, target: gif },
    });

    await fireEvent.error(await findVideo(container));

    expect(screen.getByText(/first 30 seconds/)).toBeInTheDocument();
    expect(lastClip(emitted)).toEqual({ start: 0, end: 30 });
  });
});
