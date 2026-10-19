<script setup lang="ts">
import { UploadCloud, Music, Video, AlertCircle } from "@lucide/vue";
import { useFileUpload } from "../composables/useFileUpload";

const emit = defineEmits<{
  (e: "file-selected", file: File): void;
}>();

const { isDragOver, errorMessage, triggerFileSelect, onDrop, onFileChange } =
  useFileUpload((file) => emit("file-selected", file));
</script>

<template>
  <div class="card">
    <div
      class="upload-dropzone"
      :class="{ 'upload-dropzone-dragover': isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="onDrop"
      @click="triggerFileSelect"
    >
      <input
        ref="fileInput"
        type="file"
        accept="audio/*,video/*"
        hidden
        @change="onFileChange"
      />

      <div class="upload-icon">
        <UploadCloud :size="36" />
      </div>

      <h2 class="upload-title">Drop your audio or video file here</h2>
      <p class="upload-subtitle">
        Supports MP3, WAV, M4A, FLAC, MP4, MOV, and more
      </p>

      <button class="btn btn-primary" type="button">Choose File</button>
    </div>

    <!-- Supported Formats Badge Panel -->
    <div class="upload-formats">
      <div class="upload-format">
        <Music class="upload-format-audio" :size="16" />
        <span>Audio (MP3, M4A, WAV, FLAC)</span>
      </div>
      <div class="upload-format">
        <Video class="upload-format-video" :size="16" />
        <span>Video (MP4, MOV, MKV, WebM)</span>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="errorMessage" class="upload-error">
      <AlertCircle :size="18" />
      <span>{{ errorMessage }}</span>
    </div>
  </div>
</template>
