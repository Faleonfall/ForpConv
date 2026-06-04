<script setup lang="ts">
import { ref } from "vue";
import { UploadCloud, Music, Video, AlertCircle } from "@lucide/vue";

const emit = defineEmits<{
  (e: "file-selected", file: File): void;
}>();

const isDragOver = ref(false);
const errorMessage = ref("");

const allowedExtensions = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "flac",
  "ogg",
  "mp4",
  "mov",
  "webm",
  "mkv",
  "avi",
];

const checkAndEmitFile = (file: File | undefined): void => {
  if (!file) return;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isAudio = file.type.startsWith("audio/");
  const isVideo = file.type.startsWith("video/");

  if (!isAudio && !isVideo && !allowedExtensions.includes(extension)) {
    errorMessage.value = `Unsupported file format (.${extension}). Please upload an audio or video file.`;
    return;
  }

  // Maximum file size of 200MB to avoid browser memory crash
  if (file.size > 200 * 1024 * 1024) {
    errorMessage.value =
      "File is too large (max 200MB). Please select a smaller file.";
    return;
  }

  errorMessage.value = "";
  emit("file-selected", file);
};

const fileInput = ref<HTMLInputElement | null>(null);
const triggerFileSelect = (): void => {
  fileInput.value?.click();
};

const onDrop = (event: DragEvent): void => {
  isDragOver.value = false;
  const file = event.dataTransfer?.files[0];
  checkAndEmitFile(file);
};

const onFileChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  checkAndEmitFile(file);
};
</script>

<template>
  <div class="glass-card">
    <div
      class="dropzone"
      :class="{ dragover: isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="onDrop"
      @click="triggerFileSelect"
    >
      <input
        ref="fileInput"
        type="file"
        accept="audio/*,video/*"
        style="display: none"
        @change="onFileChange"
      />

      <div class="upload-icon-container">
        <UploadCloud :size="36" />
      </div>

      <h2 class="upload-title">Drop your audio or video file here</h2>
      <p class="upload-subtitle">
        Supports MP3, WAV, M4A, FLAC, MP4, MOV, and more
      </p>

      <button class="btn btn-primary" type="button">Choose File</button>
    </div>

    <!-- Supported Formats Badge Panel -->
    <div
      style="
        display: flex;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
        flex-wrap: wrap;
      "
    >
      <div
        style="
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
          font-size: 0.85rem;
        "
      >
        <Music :size="16" style="color: var(--primary)" />
        <span>Audio (MP3, M4A, WAV, FLAC)</span>
      </div>
      <div
        style="
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
          font-size: 0.85rem;
        "
      >
        <Video :size="16" style="color: var(--accent)" />
        <span>Video (MP4, MOV, MKV, WebM)</span>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="errorMessage"
      class="warning-alert"
      style="border-color: var(--error); color: #f87171"
    >
      <AlertCircle :size="18" />
      <span>{{ errorMessage }}</span>
    </div>
  </div>
</template>
