<script setup lang="ts">
import { Play, Pause, RotateCcw, Volume2, Scissors } from "@lucide/vue";
import { useRingtoneTrimmer } from "../composables/useRingtoneTrimmer";
import { type ConvertParams } from "../lib/ringtoneConversion";
import {
  formatPercent,
  formatSeconds,
  formatTime,
} from "../lib/ringtoneDisplay";

const props = defineProps<{
  file: File;
}>();

const emit = defineEmits<{
  (e: "convert", params: ConvertParams): void;
  (e: "cancel"): void;
}>();

const {
  vFocus,
  waveformContainer,
  videoRef,
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
} = useRingtoneTrimmer(
  () => props.file,
  (params) => emit("convert", params),
);
</script>

<template>
  <div class="card trimmer-card">
    <!-- Header -->
    <div class="trimmer-header">
      <h2 class="trimmer-title">Customize Ringtone</h2>
      <button class="btn btn-secondary btn-small" @click="$emit('cancel')">
        Change File
      </button>
    </div>

    <!-- Video Preview Box (Visible only for videos) -->
    <div v-if="isVideo" class="trimmer-video">
      <video
        ref="videoRef"
        :src="mediaUrl"
        muted
        playsinline
        preload="auto"
      ></video>
    </div>

    <!-- Waveform Visualizer -->
    <div class="trimmer-waveform-area">
      <div v-show="!isLoaded" class="trimmer-decoding">
        <div class="trimmer-decoding-inner">
          <svg class="trimmer-decoding-spinner" fill="none" viewBox="0 0 24 24">
            <circle
              class="trimmer-decoding-track"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="trimmer-decoding-head"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span class="trimmer-decoding-text">Decoding audio timeline...</span>
        </div>
      </div>

      <div v-show="isLoaded" class="trimmer-waveform">
        <div ref="waveformContainer"></div>
        <div class="trimmer-timeline">
          <span>00:00.0</span>

          <div class="trimmer-mini-controls">
            <button class="trimmer-play" title="Play/Pause" @click="togglePlay">
              <Pause v-if="isPlaying" :size="14" />
              <Play v-else class="trimmer-play-icon" :size="14" />
            </button>
            <button
              class="trimmer-reset"
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
      <div class="trimmer-stats">
        <div>
          <div class="trimmer-stat-label">Trim Start</div>
          <div class="trimmer-stat-value trimmer-stat-start">
            {{ formatTime(startTime) }}
          </div>
        </div>
        <div>
          <div class="trimmer-stat-label">Trim End</div>
          <div class="trimmer-stat-value trimmer-stat-end">
            {{ formatTime(endTime) }}
          </div>
        </div>
        <div>
          <div class="trimmer-stat-label">Ringtone Length</div>
          <div class="trimmer-stat-value trimmer-stat-length">
            {{ formatSeconds(selectionDuration, 1) }}
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

        <div class="trimmer-controls-grid">
          <!-- Volume Boost -->
          <div class="form-group">
            <label class="form-label" for="volume-boost">
              <span class="trimmer-label-icon">
                <Volume2 :size="16" /> Volume Boost
              </span>
              <span>{{ formatPercent(volumeBoost) }}</span>
            </label>
            <input
              id="volume-boost"
              v-model.number="volumeBoost"
              type="range"
              min="1.0"
              max="2.0"
              step="0.05"
              class="form-range"
            />
          </div>

          <!-- Fade Settings (Custom combined box) -->
          <div class="trimmer-fade-grid">
            <div class="form-group">
              <label class="form-label" for="fade-in">
                <span>Fade In</span>
                <span
                  v-if="!isEditingFadeIn"
                  class="trimmer-fade-value"
                  title="Click to type exact value"
                  @click="startEditingFadeIn"
                >
                  {{ formatSeconds(fadeInDuration) }}
                </span>
                <input
                  v-else
                  v-model.number="fadeInDuration"
                  v-focus
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  class="trimmer-fade-input"
                  @focus="selectOnFocus"
                  @blur="stopEditingFadeIn"
                  @keyup.enter="stopEditingFadeIn"
                />
              </label>
              <input
                id="fade-in"
                class="form-range"
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
                  class="trimmer-fade-value"
                  title="Click to type exact value"
                  @click="startEditingFadeOut"
                >
                  {{ formatSeconds(fadeOutDuration) }}
                </span>
                <input
                  v-else
                  v-model.number="fadeOutDuration"
                  v-focus
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  class="trimmer-fade-input"
                  @focus="selectOnFocus"
                  @blur="stopEditingFadeOut"
                  @keyup.enter="stopEditingFadeOut"
                />
              </label>
              <input
                id="fade-out"
                class="form-range"
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
        class="btn btn-primary btn-tall btn-wide"
        :disabled="selectionDuration <= 0"
        @click="handleConvert"
      >
        <Scissors :size="20" /> Create M4R Ringtone
      </button>
    </div>
  </div>
</template>
