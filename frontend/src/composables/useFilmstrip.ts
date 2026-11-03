import { onBeforeUnmount, ref, watch, type Ref } from "vue";
import { FILMSTRIP_FRAMES, filmstripTimes } from "../lib/clipRange";

// Frame height in pixels, twice the track for sharp screens
const FRAME_HEIGHT = 112;
// A seek that never lands gives up instead of stalling the strip
const SEEK_TIMEOUT_MS = 3000;

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("seek timeout")),
      SEEK_TIMEOUT_MS,
    );
    video.addEventListener(
      "seeked",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    video.currentTime = time;
  });
}

function whenLoaded(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("load")), {
      once: true,
    });
  });
}

// Grabs frames across the clip from a hidden copy of the video, the way an
// editor timeline shows them. Leaves the strip empty if the browser cannot
// decode the file.
export function useFilmstrip(
  getUrl: () => string,
  duration: Ref<number | null>,
  enabled: () => boolean,
) {
  const frames = ref<string[]>([]);
  let cancelled = false;

  const capture = async (length: number): Promise<void> => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = getUrl();

    try {
      await whenLoaded(video);
      const width = Math.round(
        (video.videoWidth / video.videoHeight) * FRAME_HEIGHT,
      );
      const canvas = document.createElement("canvas");
      canvas.width = width || FRAME_HEIGHT;
      canvas.height = FRAME_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) return;

      for (const time of filmstripTimes(length, FILMSTRIP_FRAMES)) {
        if (cancelled) return;
        await seekTo(video, time);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.value = [...frames.value, canvas.toDataURL("image/jpeg", 0.6)];
      }
    } catch {
      // Undecodable or stalled, the track works without pictures
    } finally {
      video.removeAttribute("src");
      video.load();
    }
  };

  watch(duration, (length) => {
    if (length === null || !enabled() || frames.value.length > 0) return;
    void capture(length);
  });

  onBeforeUnmount(() => {
    cancelled = true;
  });

  return { frames };
}
