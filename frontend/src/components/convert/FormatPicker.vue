<script setup lang="ts">
import { ArrowRightLeft } from "@lucide/vue";
import ClipRange from "./ClipRange.vue";
import QualitySwitch from "./QualitySwitch.vue";
import SlabSelect from "../shared/SlabSelect.vue";
import { useFormatPicker } from "../../composables/convert/useFormatPicker";
import { type FormatChoice } from "../../lib/convert/formatConversion";
import { formatFileSize } from "../../lib/shared/mediaDisplay";

const props = defineProps<{
  file: File;
  // Null while unknown, false hides the audio targets
  hasAudio?: boolean | null;
  // Null while unknown, a known rate adds an Original option
  frameRate?: number | null;
  // Playable copy of a GIF for the timeline, null until it's made
  timelineFile?: File | null;
  preparingTimeline?: boolean;
}>();

const emit = defineEmits<{
  (e: "convert", choice: FormatChoice): void;
  (e: "cancel"): void;
}>();

const {
  formatOptions,
  targetId,
  target,
  qualities,
  qualityId,
  qualityLabel,
  widths,
  widthId,
  canCompress,
  lossy,
  timelineFile,
  isAnimatedSource,
  imageUrl,
  imageFailed,
  sizeEstimate,
  handleClipChange,
  handleClipLength,
  handleFrame,
  handleImageError,
  handleConvert,
} = useFormatPicker(
  () => props.file,
  () => props.hasAudio ?? null,
  () => props.frameRate ?? null,
  () => props.timelineFile ?? null,
  (choice) => emit("convert", choice),
);
</script>

<template>
  <div class="card picker-card">
    <div class="picker-header">
      <div class="picker-file">
        <h2 class="picker-file-name">{{ file.name }}</h2>
        <div class="picker-file-size">{{ formatFileSize(file.size) }}</div>
      </div>
      <button class="btn btn-secondary btn-small" @click="$emit('cancel')">
        <span class="btn-face">Change File</span>
      </button>
    </div>

    <ClipRange
      v-if="timelineFile"
      :file="timelineFile"
      :target="target"
      :animated-source="isAnimatedSource"
      @change="handleClipChange"
      @length="handleClipLength"
      @frame="handleFrame"
    />

    <div v-else-if="imageUrl && !imageFailed" class="picker-preview">
      <img
        :src="imageUrl"
        :alt="file.name"
        class="picker-image"
        @error="handleImageError"
      />
      <p v-if="preparingTimeline" class="picker-note">Preparing timeline...</p>
    </div>

    <!-- A cell that comes or goes grows or shrinks, the others follow -->
    <TransitionGroup tag="div" name="picker-cell" class="picker-grid">
      <SlabSelect
        key="target"
        v-model="targetId"
        label="Convert To"
        :options="formatOptions"
      />
      <SlabSelect
        v-if="qualities.length > 0"
        key="quality"
        v-model="qualityId"
        :label="qualityLabel"
        :options="qualities"
      />
      <SlabSelect
        v-if="widths.length > 0"
        key="width"
        v-model="widthId"
        label="Width"
        :options="widths"
      />
    </TransitionGroup>

    <p v-if="sizeEstimate" class="picker-estimate">{{ sizeEstimate }}</p>

    <div class="picker-actions">
      <button
        class="btn btn-primary btn-tall picker-convert"
        @click="handleConvert"
      >
        <span class="btn-face"> <ArrowRightLeft :size="20" /> Convert </span>
      </button>
      <QualitySwitch v-if="canCompress" v-model="lossy" />
    </div>
  </div>
</template>
