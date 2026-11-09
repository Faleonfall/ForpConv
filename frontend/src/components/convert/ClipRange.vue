<script setup lang="ts">
import { Play, Pause, AlertCircle } from "@lucide/vue";
import { useClipRange } from "../../composables/convert/useClipRange";
import {
  clipPreviewFailedText,
  type ClipRange as Clip,
} from "../../lib/convert/clipRange";
import { type TargetFormat } from "../../lib/convert/formatCatalog";
import { formatSeconds, formatTime } from "../../lib/shared/mediaDisplay";

const props = defineProps<{
  file: File;
  target: TargetFormat | undefined;
  // The file is a playable copy of a GIF, kept whole by default
  animatedSource?: boolean;
}>();

const emit = defineEmits<{
  (e: "change", clip: Clip | null): void;
  (e: "length", seconds: number | null): void;
  (e: "frame", time: number): void;
}>();

const {
  isVideo,
  isFrame,
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
  activeGrip,
  startDrag,
  handlePointerMove,
  endDrag,
  handleTrackPointerDown,
  handleKeydown,
  handleLoadedMetadata,
  handlePreviewError,
  handleSeeked,
  togglePlay,
  handlePlay,
  handlePause,
} = useClipRange(
  () => props.file,
  () => props.target,
  () => props.animatedSource === true,
  (clip) => emit("change", clip),
  (seconds) => emit("length", seconds),
  (time) => emit("frame", time),
);
</script>

<template>
  <div class="clip">
    <div v-if="mediaUrl && !previewFailed" class="clip-preview">
      <video
        v-if="isVideo"
        ref="clipMedia"
        :src="mediaUrl"
        class="clip-video"
        playsinline
        preload="metadata"
        @loadedmetadata="handleLoadedMetadata"
        @error="handlePreviewError"
        @seeked="handleSeeked"
        @play="handlePlay"
        @pause="handlePause"
      ></video>
      <audio
        v-else
        ref="clipMedia"
        :src="mediaUrl"
        preload="metadata"
        @loadedmetadata="handleLoadedMetadata"
        @error="handlePreviewError"
        @seeked="handleSeeked"
        @play="handlePlay"
        @pause="handlePause"
      ></audio>
    </div>

    <p v-if="previewFailed" class="clip-note">
      {{ clipPreviewFailedText(limits) }}
    </p>

    <template v-else-if="duration !== null">
      <!-- Editor style timeline: frames, dimmed outside the selection -->
      <div
        ref="trimTrack"
        class="trim-track"
        :class="{ 'trim-track-dragging': activeGrip !== null }"
        :style="trackStyle"
        @pointerdown="handleTrackPointerDown"
        @pointermove="handlePointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <div class="trim-filmstrip">
          <img
            v-for="(frame, index) in frames"
            :key="index"
            :src="frame"
            alt=""
            class="trim-frame"
            draggable="false"
          />
        </div>
        <template v-if="!isFrame">
          <div class="trim-shade trim-shade-start"></div>
          <div class="trim-shade trim-shade-end"></div>

          <div
            class="trim-window"
            :class="{ 'trim-window-active': activeGrip === 'window' }"
            @pointerdown.stop="startDrag('window', $event)"
          >
            <div
              class="trim-handle trim-handle-start"
              :class="{ 'trim-handle-active': activeGrip === 'start' }"
              role="slider"
              tabindex="0"
              aria-label="Trim start"
              :aria-valuemin="0"
              :aria-valuemax="duration"
              :aria-valuenow="range.start"
              :aria-valuetext="formatTime(range.start)"
              @pointerdown.stop="startDrag('start', $event)"
              @keydown="handleKeydown('start', $event)"
            ></div>
            <div
              class="trim-handle trim-handle-end"
              :class="{ 'trim-handle-active': activeGrip === 'end' }"
              role="slider"
              tabindex="0"
              aria-label="Trim end"
              :aria-valuemin="0"
              :aria-valuemax="duration"
              :aria-valuenow="range.end"
              :aria-valuetext="formatTime(range.end)"
              @pointerdown.stop="startDrag('end', $event)"
              @keydown="handleKeydown('end', $event)"
            ></div>
          </div>
        </template>

        <!-- Sits above the selection, so it scrubs even inside it -->
        <div
          class="trim-playhead"
          :class="{ 'trim-playhead-active': activeGrip === 'playhead' }"
          title="Drag to scrub"
          @pointerdown.stop="startDrag('playhead', $event)"
        ></div>
      </div>

      <p v-if="isFrame" class="trim-frame-time">
        Frame at {{ formatTime(playhead) }}
      </p>

      <div v-else class="trim-times">
        <span class="trim-time">{{ formatTime(range.start) }}</span>
        <div class="trim-center">
          <button
            class="trim-play"
            type="button"
            title="Play selection"
            @click="togglePlay"
          >
            <Pause v-if="isPlaying" :size="14" />
            <Play v-else :size="14" />
          </button>
          <span class="trim-length">{{ formatSeconds(length, 1) }}</span>
          <span v-if="limits.maxSeconds !== null" class="trim-cap">
            of max {{ formatSeconds(limits.maxSeconds) }}
          </span>
        </div>
        <span class="trim-time trim-time-end">{{ formatTime(range.end) }}</span>
      </div>

      <div v-if="hint" class="clip-hint">
        <AlertCircle :size="16" />
        <span>{{ hint }}</span>
      </div>
    </template>
  </div>
</template>
