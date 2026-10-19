import {
  ref,
  onMounted,
  onBeforeUnmount,
  computed,
  watch,
  useTemplateRef,
} from "vue";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, {
  type Region,
} from "wavesurfer.js/dist/plugins/regions.js";
import { type ConvertParams } from "../lib/ringtoneConversion";
import {
  MAX_RINGTONE_SECONDS,
  clampFade,
  clampSelectionEnd,
  defaultRingtoneTitle,
  finalRingtoneTitle,
  initialSelectionEnd,
  previewGain,
  sliderFade,
  waveformHeight,
} from "../lib/ringtoneTrim";

// Custom directive for safe focus targeting on dynamic elements
const vFocus = {
  mounted: (el: HTMLElement) => el.focus(),
};

function readToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export function useRingtoneTrimmer(
  getFile: () => File,
  onConvert: (params: ConvertParams) => void,
) {
  const waveformContainer = useTemplateRef<HTMLDivElement>("waveformContainer");
  const videoRef = useTemplateRef<HTMLVideoElement>("videoRef");
  const isPlaying = ref(false);
  const isLoaded = ref(false);
  const duration = ref(0);

  // Selection Range
  const startTime = ref(0);
  const endTime = ref(0);

  // Custom Effects Params
  const volumeBoost = ref(1.0); // Multiplier: 1.0 (100%) to 2.0 (200%)
  const fadeInDuration = ref(0); // 0s to 5s
  const fadeOutDuration = ref(0); // 0s to 5s
  const ringtoneTitle = ref("");

  const isShiftActive = ref(false);
  const isEditingFadeIn = ref(false);
  const isEditingFadeOut = ref(false);

  // Object URL for local preview
  const mediaUrl = ref("");
  const isVideo = computed(() => getFile().type.startsWith("video/"));
  const selectionDuration = computed(() =>
    Math.max(0, endTime.value - startTime.value),
  );

  // Web Audio Context refs for real-time preview of Volume & Fades
  let audioCtx: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let sourceNode: MediaElementAudioSourceNode | null = null;

  // Wavesurfer references
  let wavesurfer: WaveSurfer | null = null;
  let regionsPlugin: ReturnType<typeof RegionsPlugin.create> | null = null;
  let activeRegion: Region | null = null;

  const initAudioEffects = (): void => {
    if (audioCtx || !wavesurfer) return;
    const mediaEl = wavesurfer.getMediaElement();
    if (!mediaEl) return;

    try {
      audioCtx = new (
        window.AudioContext ||
        (
          window as unknown as Window & {
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext
      )();
      gainNode = audioCtx.createGain();
      sourceNode = audioCtx.createMediaElementSource(mediaEl);
      sourceNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);
    } catch (err) {
      console.error("Web Audio initialization failed:", err);
    }
  };

  const updateRealtimeGain = (): void => {
    if (!gainNode || !wavesurfer) return;
    gainNode.gain.value = previewGain({
      time: wavesurfer.getCurrentTime(),
      startTime: startTime.value,
      endTime: endTime.value,
      volume: volumeBoost.value,
      fadeIn: fadeInDuration.value,
      fadeOut: fadeOutDuration.value,
      isPlaying: isPlaying.value,
    });
  };

  const handleDecode = (): void => {
    isLoaded.value = true;
    if (!wavesurfer) return;

    duration.value = wavesurfer.getDuration();
    endTime.value = initialSelectionEnd(duration.value);

    // Add trim region
    activeRegion =
      regionsPlugin?.addRegion({
        id: "trim-region",
        start: 0,
        end: endTime.value,
        color: readToken("--color-wave-region"),
        drag: true,
        resize: true,
        maxLength: MAX_RINGTONE_SECONDS,
      }) ?? null;

    // Listen to region movement
    const region = activeRegion;
    region?.on("update", () => {
      startTime.value = region.start;
      endTime.value = region.end;
    });
  };

  const handleTimeUpdate = (time: number): void => {
    if (videoRef.value && Math.abs(videoRef.value.currentTime - time) > 0.1) {
      videoRef.value.currentTime = time;
    }

    // Keep playback inside the region during preview
    if (isPlaying.value && time >= endTime.value) {
      wavesurfer?.setTime(startTime.value);
    }

    updateRealtimeGain();
  };

  const initWaveSurfer = (container: HTMLDivElement): void => {
    const file = getFile();
    ringtoneTitle.value = defaultRingtoneTitle(file.name);
    mediaUrl.value = URL.createObjectURL(file);

    wavesurfer = WaveSurfer.create({
      container,
      waveColor: readToken("--color-wave"),
      progressColor: readToken("--color-wave-progress"),
      cursorColor: readToken("--color-wave-cursor"),
      height: waveformHeight(window.innerHeight),
      barWidth: 2,
      barGap: 3,
      barRadius: 2,
    });

    regionsPlugin = wavesurfer.registerPlugin(RegionsPlugin.create());
    void wavesurfer.load(mediaUrl.value);

    wavesurfer.on("decode", handleDecode);
    wavesurfer.on("timeupdate", handleTimeUpdate);

    wavesurfer.on("play", () => {
      isPlaying.value = true;
      void videoRef.value?.play();
      updateRealtimeGain();
    });

    wavesurfer.on("pause", () => {
      isPlaying.value = false;
      videoRef.value?.pause();
      updateRealtimeGain();
    });
  };

  const togglePlay = (): void => {
    if (!wavesurfer) return;

    initAudioEffects();
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }

    if (wavesurfer.isPlaying()) {
      wavesurfer.pause();
      return;
    }

    // If playhead is outside the region, jump back to start of region
    const current = wavesurfer.getCurrentTime();
    if (current < startTime.value || current >= endTime.value) {
      wavesurfer.setTime(startTime.value);
    }
    void wavesurfer.play();
  };

  const resetSelection = (): void => {
    if (!activeRegion || !wavesurfer) return;
    const end = initialSelectionEnd(duration.value);
    activeRegion.setOptions({ start: 0, end });
    startTime.value = 0;
    endTime.value = end;
    wavesurfer.setTime(0);
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Shift") isShiftActive.value = true;
  };

  const handleKeyUp = (e: KeyboardEvent): void => {
    if (e.key === "Shift") isShiftActive.value = false;
  };

  const sliderValue = (e: Event): number =>
    sliderFade(
      parseFloat((e.target as HTMLInputElement).value),
      isShiftActive.value,
    );

  const handleFadeInInput = (e: Event): void => {
    fadeInDuration.value = sliderValue(e);
  };

  const handleFadeOutInput = (e: Event): void => {
    fadeOutDuration.value = sliderValue(e);
  };

  const startEditingFadeIn = (): void => {
    isEditingFadeIn.value = true;
  };

  const stopEditingFadeIn = (): void => {
    isEditingFadeIn.value = false;
    fadeInDuration.value = clampFade(fadeInDuration.value);
  };

  const startEditingFadeOut = (): void => {
    isEditingFadeOut.value = true;
  };

  const stopEditingFadeOut = (): void => {
    isEditingFadeOut.value = false;
    fadeOutDuration.value = clampFade(fadeOutDuration.value);
  };

  const selectOnFocus = (e: Event): void => {
    (e.target as HTMLInputElement | null)?.select();
  };

  const handleConvert = (): void => {
    onConvert({
      startTime: startTime.value,
      endTime: clampSelectionEnd(startTime.value, endTime.value),
      volume: volumeBoost.value,
      fadeIn: fadeInDuration.value,
      fadeOut: fadeOutDuration.value,
      title: finalRingtoneTitle(ringtoneTitle.value),
    });
  };

  // React to volume/fade updates while paused/adjusting
  watch([volumeBoost, fadeInDuration, fadeOutDuration], updateRealtimeGain);

  onMounted(() => {
    if (waveformContainer.value) initWaveSurfer(waveformContainer.value);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
  });

  onBeforeUnmount(() => {
    wavesurfer?.destroy();
    if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
    if (audioCtx) void audioCtx.close();
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  });

  return {
    vFocus,
    isPlaying,
    isLoaded,
    duration,
    startTime,
    endTime,
    volumeBoost,
    fadeInDuration,
    fadeOutDuration,
    ringtoneTitle,
    isEditingFadeIn,
    isEditingFadeOut,
    mediaUrl,
    isVideo,
    selectionDuration,
    togglePlay,
    resetSelection,
    handleFadeInInput,
    handleFadeOutInput,
    startEditingFadeIn,
    stopEditingFadeIn,
    startEditingFadeOut,
    stopEditingFadeOut,
    selectOnFocus,
    handleConvert,
  };
}
