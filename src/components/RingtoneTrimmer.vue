<script setup lang="ts">
/* eslint-disable max-lines */
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { Play, Pause, RotateCcw, Volume2, Scissors } from "@lucide/vue";

const props = defineProps<{
  file: File;
}>();

const emit = defineEmits<{
  (
    e: "convert",
    params: {
      startTime: number;
      endTime: number;
      volume: number;
      fadeIn: number;
      fadeOut: number;
      title: string;
    },
  ): void;
  (e: "cancel"): void;
}>();

// Refs
const waveformContainer = ref<HTMLDivElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);
const isPlaying = ref(false);
const isLoaded = ref(false);
const duration = ref(0);
const currentTime = ref(0);

// Selection Range
const startTime = ref(0);
const endTime = ref(0);

// Custom Effects Params
const volumeBoost = ref(1.0); // Multiplier: 1.0 (100%) to 2.0 (200%)
const fadeInDuration = ref(0); // 0s to 5s
const fadeOutDuration = ref(0); // 0s to 5s
const ringtoneTitle = ref("");

// Web Audio Context refs for real-time preview of Volume & Fades
let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;

const initAudioEffects = () => {
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

const updateRealtimeGain = () => {
  if (!gainNode || !wavesurfer) return;
  const time = wavesurfer.getCurrentTime();
  let currentGain = volumeBoost.value;

  // Fade In: from selection start to fade-in duration
  const timeIntoSelection = time - startTime.value;
  if (
    fadeInDuration.value > 0 &&
    timeIntoSelection >= 0 &&
    timeIntoSelection < fadeInDuration.value
  ) {
    const ratio = timeIntoSelection / fadeInDuration.value;
    currentGain *= ratio;
  }

  // Fade Out: from fade-out start to selection end
  const timeRemaining = endTime.value - time;
  if (
    fadeOutDuration.value > 0 &&
    timeRemaining >= 0 &&
    timeRemaining < fadeOutDuration.value
  ) {
    const ratio = timeRemaining / fadeOutDuration.value;
    currentGain *= ratio;
  }

  // Clamp to silence if outside the selection region during preview
  if (time < startTime.value || time > endTime.value) {
    if (isPlaying.value) {
      currentGain = 0;
    }
  }

  gainNode.gain.value = currentGain;
};

// React to volume/fade updates while paused/adjusting
watch([volumeBoost, fadeInDuration, fadeOutDuration], () => {
  updateRealtimeGain();
});

// Wavesurfer references
let wavesurfer: WaveSurfer | null = null;
let regionsPlugin: RegionsPlugin | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeRegion: any = null;

// Object URLs for local preview
const mediaUrl = ref("");
const isVideo = computed(() => props.file.type.startsWith("video/"));

// Compute active selection duration
const selectionDuration = computed(() => {
  return Math.max(0, endTime.value - startTime.value);
});

// Format time utility: MM:SS.S
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return "00:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  const minsStr = mins.toString().padStart(2, "0");
  const secsStr = secs.toString().padStart(2, "0");
  return `${minsStr}:${secsStr}.${ms}`;
};

// Initialize wavesurfer and handle media loading
onMounted(() => {
  if (!waveformContainer.value) return;

  // Set default title
  const fileNameWithoutExt = props.file.name.substring(
    0,
    props.file.name.lastIndexOf("."),
  );
  ringtoneTitle.value = fileNameWithoutExt.replace(/[^a-zA-Z0-9_\-\s]/g, "");

  mediaUrl.value = URL.createObjectURL(props.file);

  // Create WaveSurfer instance
  const screenHeight = window.innerHeight;
  const waveHeight = screenHeight < 700 ? 80 : screenHeight < 850 ? 100 : 128;

  wavesurfer = WaveSurfer.create({
    container: waveformContainer.value,
    waveColor: "#4f46e5",
    progressColor: "#a855f7",
    cursorColor: "#c084fc",
    height: waveHeight,
    barWidth: 2,
    barGap: 3,
    barRadius: 2,
  });

  // Register Regions plugin
  regionsPlugin = wavesurfer.registerPlugin(RegionsPlugin.create());

  // Load the file/blob
  void wavesurfer.load(mediaUrl.value);

  // Event handlers
  wavesurfer.on("decode", () => {
    isLoaded.value = true;
    if (!wavesurfer) return;

    duration.value = wavesurfer.getDuration();
    endTime.value = Math.min(30, duration.value);

    // Add trim region
    const region = regionsPlugin?.addRegion({
      id: "trim-region",
      start: 0,
      end: endTime.value,
      color: "rgba(168, 85, 247, 0.15)",
      drag: true,
      resize: true,
      maxLength: 30, // Cap at 30s (GarageBand and carrier limits)
    });

    activeRegion = region ?? null;

    // Listen to region movement
    if (activeRegion) {
      const reg = activeRegion;
      reg.on("update", () => {
        startTime.value = reg.start;
        endTime.value = reg.end;
      });
    }
  });

  wavesurfer.on("timeupdate", (time) => {
    currentTime.value = time;
    if (videoRef.value) {
      if (Math.abs(videoRef.value.currentTime - time) > 0.1) {
        videoRef.value.currentTime = time;
      }
    }

    // Keep playback inside the region during preview
    if (isPlaying.value && time >= endTime.value) {
      wavesurfer?.setTime(startTime.value);
    }

    // Update real-time audio gain and fades
    updateRealtimeGain();
  });

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
});

onBeforeUnmount(() => {
  if (wavesurfer) {
    wavesurfer.destroy();
  }
  if (mediaUrl.value) {
    URL.revokeObjectURL(mediaUrl.value);
  }
  if (audioCtx) {
    void audioCtx.close();
  }
});

// Control actions
const togglePlay = (): void => {
  if (!wavesurfer) return;

  initAudioEffects();
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume();
  }

  if (wavesurfer.isPlaying()) {
    wavesurfer.pause();
  } else {
    // If playhead is outside the region, jump back to start of region
    const current = wavesurfer.getCurrentTime();
    if (current < startTime.value || current >= endTime.value) {
      wavesurfer.setTime(startTime.value);
    }
    void wavesurfer.play();
  }
};

const resetSelection = (): void => {
  if (!activeRegion || !wavesurfer) return;
  activeRegion.setOptions({
    start: 0,
    end: Math.min(30, duration.value),
  });
  startTime.value = 0;
  endTime.value = Math.min(30, duration.value);
  wavesurfer.setTime(0);
};

const isShiftActive = ref(false);
const isEditingFadeIn = ref(false);
const isEditingFadeOut = ref(false);

// Custom directive for safe focus targeting on dynamic elements
const vFocus = {
  mounted: (el: HTMLElement) => el.focus(),
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Shift") {
    isShiftActive.value = true;
  }
};

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === "Shift") {
    isShiftActive.value = false;
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
});

const snapToSticky = (val: number): number => {
  if (isShiftActive.value) {
    return val;
  }
  const step = 0.5;
  const tolerance = 0.04;
  const nearest = Math.round(val / step) * step;
  if (Math.abs(val - nearest) < tolerance) {
    return nearest;
  }
  return val;
};

const handleFadeInInput = (e: Event): void => {
  const val = parseFloat((e.target as HTMLInputElement).value);
  fadeInDuration.value = parseFloat(snapToSticky(val).toFixed(2));
};

const handleFadeOutInput = (e: Event): void => {
  const val = parseFloat((e.target as HTMLInputElement).value);
  fadeOutDuration.value = parseFloat(snapToSticky(val).toFixed(2));
};

const startEditingFadeIn = () => {
  isEditingFadeIn.value = true;
};

const stopEditingFadeIn = () => {
  isEditingFadeIn.value = false;
  fadeInDuration.value = Math.max(
    0,
    Math.min(5, parseFloat((fadeInDuration.value || 0).toString()) || 0),
  );
};

const startEditingFadeOut = () => {
  isEditingFadeOut.value = true;
};

const stopEditingFadeOut = () => {
  isEditingFadeOut.value = false;
  fadeOutDuration.value = Math.max(
    0,
    Math.min(5, parseFloat((fadeOutDuration.value || 0).toString()) || 0),
  );
};

const selectOnFocus = (e: Event): void => {
  const target = e.target as HTMLInputElement | null;
  if (target) {
    target.select();
  }
};

const handleConvert = (): void => {
  // Strict failsafe: enforce maximum duration of 30 seconds
  let finalEndTime = endTime.value;
  if (finalEndTime - startTime.value > 30) {
    finalEndTime = startTime.value + 30;
  }

  emit("convert", {
    startTime: startTime.value,
    endTime: finalEndTime,
    volume: volumeBoost.value,
    fadeIn: fadeInDuration.value,
    fadeOut: fadeOutDuration.value,
    title: ringtoneTitle.value.trim() || "ringtone",
  });
};
</script>

<template>
  <div class="glass-card trimmer-card">
    <!-- Header -->
    <div
      style="display: flex; justify-content: space-between; align-items: center"
    >
      <h2
        style="
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 700;
        "
      >
        Customize Ringtone
      </h2>
      <button
        class="btn btn-secondary"
        style="padding: 8px 16px; font-size: 0.85rem"
        @click="$emit('cancel')"
      >
        Change File
      </button>
    </div>

    <!-- Video Preview Box (Visible only for videos) -->
    <div v-if="isVideo" class="video-container">
      <video
        ref="videoRef"
        :src="mediaUrl"
        muted
        playsinline
        preload="auto"
      ></video>
    </div>

    <!-- Waveform Visualizer -->
    <div style="display: flex; flex-direction: column; gap: 8px">
      <div
        v-show="!isLoaded"
        style="
          height: 128px;
          display: flex;
          align-items: center;
          justify-content: center;
        "
      >
        <div
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          "
        >
          <svg
            class="animate-spin"
            style="width: 32px; height: 32px; color: var(--primary)"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              style="opacity: 0.25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              style="opacity: 0.75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span style="font-size: 0.9rem; color: var(--text-muted)"
            >Decoding audio timeline...</span
          >
        </div>
      </div>

      <div v-show="isLoaded" class="waveform-container">
        <div ref="waveformContainer"></div>
        <div class="waveform-timeline">
          <span>00:00.0</span>

          <div class="waveform-mini-controls">
            <button
              class="btn-mini-play"
              title="Play/Pause"
              @click="togglePlay"
            >
              <Pause v-if="isPlaying" :size="14" />
              <Play v-else :size="14" style="margin-left: 1px" />
            </button>
            <button
              class="btn-mini-reset"
              title="Reset Selection"
              @click="resetSelection"
            >
              <RotateCcw :size="12" />
            </button>
          </div>

          <span>Duration: {{ formatTime(duration) }}</span>
        </div>
      </div>
    </div>

    <!-- Controls Panel -->
    <div v-if="isLoaded" class="trimmer-controls-panel">
      <!-- Selection Details -->
      <div
        style="
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.15);
          border-radius: var(--radius-sm);
          text-align: center;
        "
      >
        <div>
          <div
            style="
              font-size: 0.75rem;
              color: var(--text-muted);
              margin-bottom: 4px;
            "
          >
            Trim Start
          </div>
          <div
            style="
              font-family: var(--font-display);
              font-weight: 700;
              color: var(--primary);
            "
          >
            {{ formatTime(startTime) }}
          </div>
        </div>
        <div>
          <div
            style="
              font-size: 0.75rem;
              color: var(--text-muted);
              margin-bottom: 4px;
            "
          >
            Trim End
          </div>
          <div
            style="
              font-family: var(--font-display);
              font-weight: 700;
              color: var(--accent);
            "
          >
            {{ formatTime(endTime) }}
          </div>
        </div>
        <div>
          <div
            style="
              font-size: 0.75rem;
              color: var(--text-muted);
              margin-bottom: 4px;
            "
          >
            Ringtone Length
          </div>
          <div
            style="
              font-family: var(--font-display);
              font-weight: 700;
              color: #10b981;
            "
          >
            {{ selectionDuration.toFixed(1) }}s
          </div>
        </div>
      </div>

      <!-- Ringtone Settings Forms -->
      <div class="trimmer-settings-form">
        <div class="form-group">
          <label class="form-label" for="ringtone-title">
            <span>Ringtone Filename</span>
          </label>
          <input
            id="ringtone-title"
            v-model="ringtoneTitle"
            type="text"
            class="form-input"
            placeholder="e.g. My Custom Tone"
          />
        </div>

        <div class="controls-grid">
          <!-- Volume Boost -->
          <div class="form-group">
            <label class="form-label" for="volume-boost">
              <span style="display: flex; align-items: center; gap: 6px">
                <Volume2 :size="16" /> Volume Boost
              </span>
              <span>{{ Math.round(volumeBoost * 100) }}%</span>
            </label>
            <input
              id="volume-boost"
              v-model.number="volumeBoost"
              type="range"
              min="1.0"
              max="2.0"
              step="0.05"
              class="range-slider"
            />
          </div>

          <!-- Fade Settings (Custom combined box) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
            <div class="form-group">
              <label class="form-label" for="fade-in">
                <span>Fade In</span>
                <span
                  v-if="!isEditingFadeIn"
                  style="
                    cursor: pointer;
                    border-bottom: 1px dotted var(--color-text-soft);
                  "
                  title="Click to type exact value"
                  @click="startEditingFadeIn"
                >
                  {{ fadeInDuration }}s
                </span>
                <input
                  v-else
                  v-focus
                  v-model.number="fadeInDuration"
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  class="mini-number-input"
                  @focus="selectOnFocus"
                  @blur="stopEditingFadeIn"
                  @keyup.enter="stopEditingFadeIn"
                />
              </label>
              <input
                id="fade-in"
                class="range-slider"
                type="range"
                min="0"
                max="5"
                step="0.01"
                :value="fadeInDuration"
                @input="handleFadeInInput"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="fade-out">
                <span>Fade Out</span>
                <span
                  v-if="!isEditingFadeOut"
                  style="
                    cursor: pointer;
                    border-bottom: 1px dotted var(--color-text-soft);
                  "
                  title="Click to type exact value"
                  @click="startEditingFadeOut"
                >
                  {{ fadeOutDuration }}s
                </span>
                <input
                  v-else
                  v-focus
                  v-model.number="fadeOutDuration"
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  class="mini-number-input"
                  @focus="selectOnFocus"
                  @blur="stopEditingFadeOut"
                  @keyup.enter="stopEditingFadeOut"
                />
              </label>
              <input
                id="fade-out"
                class="range-slider"
                type="range"
                min="0"
                max="5"
                step="0.01"
                :value="fadeOutDuration"
                @input="handleFadeOutInput"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <button
        class="btn btn-primary"
        style="width: 100%; height: 52px; font-size: 1.05rem"
        :disabled="selectionDuration <= 0"
        @click="handleConvert"
      >
        <Scissors :size="20" /> Create M4R Ringtone
      </button>
    </div>
  </div>
</template>
