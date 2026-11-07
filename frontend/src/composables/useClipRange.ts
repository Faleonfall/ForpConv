import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import { useFilmstrip } from "./useFilmstrip";
import { useTrimTrack } from "./useTrimTrack";
import {
  clampClipRange,
  clipForConvert,
  clipLengthHint,
  clipLimitsFor,
  defaultClipRange,
  trackStyleVars,
  type ClipRange,
} from "../lib/clipRange";
import { type TargetFormat } from "../lib/formatCatalog";

export function useClipRange(
  getFile: () => File,
  getTarget: () => TargetFormat | undefined,
  isVideo: () => boolean,
  isAnimatedSource: () => boolean,
  onChange: (clip: ClipRange | null) => void,
  onLength: (seconds: number | null) => void,
  onFrame: (time: number) => void,
) {
  const media = useTemplateRef<HTMLMediaElement>("clipMedia");
  const mediaUrl = ref("");
  // Null until the preview reports a finite length
  const duration = ref<number | null>(null);
  const previewFailed = ref(false);
  const isPlaying = ref(false);
  const playhead = ref(0);
  const range = ref<ClipRange>({ start: 0, end: 0 });
  // Once the user moves a handle, a format switch only clamps their range
  const isTouched = ref(false);

  const limits = computed(() => clipLimitsFor(getTarget(), isAnimatedSource()));
  const length = computed(() => range.value.end - range.value.start);
  const hint = computed(() => clipLengthHint(length.value, limits.value));
  const clip = computed(() =>
    clipForConvert(range.value, duration.value, limits.value),
  );
  const trackStyle = computed(() =>
    trackStyleVars(range.value, playhead.value, duration.value ?? 0),
  );

  let frameRequest = 0;
  // A new seek cancels the one in flight, so a drag would show no frame
  // until it stops. One seek runs at a time, the latest wanted time waits.
  let isSeeking = false;
  let pendingSeek: number | null = null;

  const seekMedia = (time: number): void => {
    const el = media.value;
    if (!el) return;
    if (isSeeking) {
      pendingSeek = time;
      return;
    }
    isSeeking = true;
    el.currentTime = time;
  };

  const handleSeeked = (): void => {
    isSeeking = false;
    if (pendingSeek === null) return;
    const next = pendingSeek;
    pendingSeek = null;
    seekMedia(next);
  };

  // The playhead moves at once, the frame follows as fast as it decodes
  const seekTo = (time: number): void => {
    playhead.value = time;
    seekMedia(time);
  };

  const trimTrack = useTrimTrack({
    range,
    duration,
    limits,
    onTrim: (next, previewTime) => {
      isTouched.value = true;
      range.value = next;
      seekTo(previewTime);
    },
    onSeek: seekTo,
  });

  const { frames } = useFilmstrip(() => mediaUrl.value, duration, isVideo);

  const handleLoadedMetadata = (): void => {
    const value = media.value?.duration ?? NaN;
    if (!Number.isFinite(value) || value <= 0) {
      previewFailed.value = true;
      return;
    }
    duration.value = value;
    range.value = defaultClipRange(value, limits.value);
  };

  const handlePreviewError = (): void => {
    previewFailed.value = true;
    isSeeking = false;
    pendingSeek = null;
  };

  // Follows playback every frame so the playhead glides, and stops at the
  // end handle so the preview shows exactly what converts
  const followPlayback = (): void => {
    const el = media.value;
    if (!el || !isPlaying.value) return;
    playhead.value = el.currentTime;
    if (el.currentTime >= range.value.end) {
      el.pause();
      return;
    }
    frameRequest = requestAnimationFrame(followPlayback);
  };

  const togglePlay = (): void => {
    const el = media.value;
    if (!el) return;
    if (isPlaying.value) {
      el.pause();
      return;
    }
    const time = el.currentTime;
    if (time < range.value.start || time >= range.value.end) {
      seekTo(range.value.start);
    }
    void el.play();
  };

  const handlePlay = (): void => {
    isPlaying.value = true;
    frameRequest = requestAnimationFrame(followPlayback);
  };

  const handlePause = (): void => {
    isPlaying.value = false;
    cancelAnimationFrame(frameRequest);
  };

  watch(limits, (next) => {
    if (duration.value === null) return;
    range.value = isTouched.value
      ? clampClipRange(range.value, duration.value, next)
      : defaultClipRange(duration.value, next);
  });

  watch(clip, (next) => onChange(next), { immediate: true });
  // Selected seconds, null while the preview has no length
  watch(
    () => (duration.value === null ? null : length.value),
    (next) => onLength(next),
    { immediate: true },
  );
  // A still image is taken where the playhead stands
  watch(playhead, (next) => onFrame(next), { immediate: true });

  onMounted(() => {
    mediaUrl.value = URL.createObjectURL(getFile());
  });

  onBeforeUnmount(() => {
    cancelAnimationFrame(frameRequest);
    if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
  });

  return {
    mediaUrl,
    duration,
    previewFailed,
    isPlaying,
    playhead,
    range,
    limits,
    length,
    hint,
    trackStyle,
    frames,
    ...trimTrack,
    handleLoadedMetadata,
    handlePreviewError,
    handleSeeked,
    togglePlay,
    handlePlay,
    handlePause,
  };
}
