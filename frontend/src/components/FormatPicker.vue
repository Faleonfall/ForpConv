<script setup lang="ts">
import { ArrowRightLeft, ChevronDown } from "@lucide/vue";
import ClipRange from "./ClipRange.vue";
import { useFormatPicker } from "../composables/useFormatPicker";
import { type FormatChoice } from "../lib/formatConversion";
import { formatFileSize } from "../lib/ringtoneDisplay";

const props = defineProps<{
  file: File;
  // Null while unknown, false hides the audio targets
  hasAudio?: boolean | null;
  // Null while unknown, a known rate adds an Original option
  frameRate?: number | null;
}>();

const emit = defineEmits<{
  (e: "convert", choice: FormatChoice): void;
  (e: "cancel"): void;
}>();

const {
  groups,
  targetId,
  target,
  qualities,
  qualityId,
  qualityLabel,
  widths,
  widthId,
  canCompress,
  lossy,
  canTrim,
  imageUrl,
  imageFailed,
  sizeEstimate,
  handleClipChange,
  handleClipLength,
  handleImageError,
  handleConvert,
} = useFormatPicker(
  () => props.file,
  () => props.hasAudio ?? null,
  () => props.frameRate ?? null,
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
        Change File
      </button>
    </div>

    <div v-if="!canTrim && imageUrl && !imageFailed" class="picker-preview">
      <img
        :src="imageUrl"
        :alt="file.name"
        class="picker-image"
        @error="handleImageError"
      />
    </div>

    <ClipRange
      v-else-if="canTrim"
      :file="file"
      :target="target"
      @change="handleClipChange"
      @length="handleClipLength"
    />

    <div class="picker-grid">
      <div class="form-group">
        <label class="form-label" for="target-format">
          <span>Convert To</span>
        </label>
        <div class="form-select-wrap">
          <select id="target-format" v-model="targetId" class="form-select">
            <optgroup
              v-for="group in groups"
              :key="group.label"
              :label="group.label"
            >
              <option
                v-for="option in group.targets"
                :key="option.id"
                :value="option.id"
              >
                {{ option.label }}
              </option>
            </optgroup>
          </select>
          <ChevronDown class="form-select-chevron" :size="18" />
        </div>
      </div>

      <div v-if="qualities.length > 0" class="form-group">
        <label class="form-label" for="target-quality">
          <span>{{ qualityLabel }}</span>
        </label>
        <div class="form-select-wrap">
          <select id="target-quality" v-model="qualityId" class="form-select">
            <option
              v-for="quality in qualities"
              :key="quality.id"
              :value="quality.id"
            >
              {{ quality.label }}
            </option>
          </select>
          <ChevronDown class="form-select-chevron" :size="18" />
        </div>
      </div>

      <div v-if="widths.length > 0" class="form-group">
        <label class="form-label" for="target-width">
          <span>Width</span>
        </label>
        <div class="form-select-wrap">
          <select id="target-width" v-model="widthId" class="form-select">
            <option v-for="width in widths" :key="width.id" :value="width.id">
              {{ width.label }}
            </option>
          </select>
          <ChevronDown class="form-select-chevron" :size="18" />
        </div>
      </div>
    </div>

    <label v-if="canCompress" class="form-switch">
      <input v-model="lossy" type="checkbox" class="form-switch-input" />
      <span class="form-switch-track" aria-hidden="true"></span>
      <span class="form-switch-text">
        <span class="form-switch-label">Smaller file</span>
        <span class="form-switch-hint"
          >Lossy compression, adds slight noise</span
        >
      </span>
    </label>

    <p v-if="sizeEstimate" class="picker-estimate">{{ sizeEstimate }}</p>

    <button class="btn btn-primary btn-tall btn-wide" @click="handleConvert">
      <ArrowRightLeft :size="20" /> Convert
    </button>
  </div>
</template>
