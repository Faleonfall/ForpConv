<script setup lang="ts">
import {
  UploadCloud,
  Music,
  Video,
  Image as ImageIcon,
  AlertCircle,
} from "@lucide/vue";
import { useFileUpload } from "../../composables/shared/useFileUpload";
import {
  acceptFor,
  uploadBadgeLabel,
  uploadTitle,
} from "../../lib/app/appMode";
import { type MediaKind } from "../../lib/shared/mediaKind";

const props = defineProps<{
  kinds: MediaKind[];
  subtitle: string;
  // Rejection from the flow after the file passed validation
  rejection?: string;
}>();

const emit = defineEmits<{
  (e: "file-selected", file: File): void;
}>();

const { isDragOver, errorMessage, triggerFileSelect, onDrop, onFileChange } =
  useFileUpload(
    () => props.kinds,
    (file) => emit("file-selected", file),
  );
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
        :accept="acceptFor(kinds)"
        hidden
        @change="onFileChange"
      />

      <div class="upload-icon">
        <UploadCloud :size="36" />
      </div>

      <h2 class="upload-title">{{ uploadTitle(kinds) }}</h2>
      <p class="upload-subtitle">{{ subtitle }}</p>

      <button class="btn btn-primary" type="button">
        <span class="btn-face">Choose File</span>
      </button>
    </div>

    <!-- Supported Formats Badge Panel -->
    <div class="upload-formats">
      <div v-if="kinds.includes('audio')" class="upload-format">
        <Music class="upload-format-audio" :size="16" />
        <span>{{ uploadBadgeLabel("audio") }}</span>
      </div>
      <div v-if="kinds.includes('video')" class="upload-format">
        <Video class="upload-format-video" :size="16" />
        <span>{{ uploadBadgeLabel("video") }}</span>
      </div>
      <div v-if="kinds.includes('image')" class="upload-format">
        <ImageIcon class="upload-format-image" :size="16" />
        <span>{{ uploadBadgeLabel("image") }}</span>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="errorMessage || rejection" class="upload-error">
      <AlertCircle :size="18" />
      <span>{{ errorMessage || rejection }}</span>
    </div>
  </div>
</template>
