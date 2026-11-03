import { ref, useTemplateRef, type Ref } from "vue";
import {
  TRIM_BIG_STEP_SECONDS,
  TRIM_STEP_SECONDS,
  moveClipEnd,
  moveClipStart,
  moveClipWindow,
  timeAtPosition,
  type ClipLimits,
  type ClipRange,
} from "../lib/clipRange";

const STEP_KEYS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
};

export type TrimGrip = "start" | "end" | "window" | "playhead";

interface DragOrigin {
  grip: TrimGrip;
  time: number;
  range: ClipRange;
}

// Pointer and keyboard control of one timeline with two handles, a
// draggable selection between them and a playhead to scrub
export function useTrimTrack(options: {
  range: Ref<ClipRange>;
  duration: Ref<number | null>;
  limits: Ref<ClipLimits>;
  // A new range from the user, and the time the preview should show
  onTrim: (next: ClipRange, previewTime: number) => void;
  onSeek: (time: number) => void;
}) {
  const track = useTemplateRef<HTMLElement>("trimTrack");
  const activeGrip = ref<TrimGrip | null>(null);
  let origin: DragOrigin | null = null;

  const timeAt = (clientX: number): number => {
    const rect = track.value?.getBoundingClientRect();
    if (!rect || options.duration.value === null) return 0;
    return timeAtPosition(
      clientX,
      rect.left,
      rect.width,
      options.duration.value,
    );
  };

  const applyGrip = (grip: TrimGrip, base: ClipRange, time: number): void => {
    const duration = options.duration.value;
    if (duration === null) return;
    const limits = options.limits.value;

    if (grip === "playhead") {
      options.onSeek(time);
    } else if (grip === "start") {
      const next = moveClipStart(base, time, limits);
      options.onTrim(next, next.start);
    } else if (grip === "end") {
      const next = moveClipEnd(base, time, duration, limits);
      options.onTrim(next, next.end);
    } else {
      const next = moveClipWindow(base, time, duration);
      options.onTrim(next, next.start);
    }
  };

  const startDrag = (grip: TrimGrip, e: PointerEvent): void => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    activeGrip.value = grip;
    origin = { grip, time: timeAt(e.clientX), range: options.range.value };
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (!origin) return;
    const time = timeAt(e.clientX);
    // The window moves by how far the pointer travelled, handles follow it
    const target = origin.grip === "window" ? time - origin.time : time;
    applyGrip(origin.grip, origin.range, target);
  };

  const endDrag = (): void => {
    origin = null;
    activeGrip.value = null;
  };

  // A press on the bare track moves the playhead there and keeps scrubbing
  // while the pointer is held
  const handleTrackPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    options.onSeek(timeAt(e.clientX));
    startDrag("playhead", e);
  };

  const handleKeydown = (grip: "start" | "end", e: KeyboardEvent): void => {
    const direction = STEP_KEYS[e.key];
    if (direction === undefined) return;
    e.preventDefault();
    const step = e.shiftKey ? TRIM_BIG_STEP_SECONDS : TRIM_STEP_SECONDS;
    const current = options.range.value;
    const from = grip === "start" ? current.start : current.end;
    applyGrip(grip, current, from + direction * step);
  };

  return {
    activeGrip,
    startDrag,
    handlePointerMove,
    endDrag,
    handleTrackPointerDown,
    handleKeydown,
  };
}
