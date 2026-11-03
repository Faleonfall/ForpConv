<script setup lang="ts">
import {
  Download,
  Music,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  Pencil,
} from "@lucide/vue";
import { useFileRename } from "../composables/useFileRename";
import { useObjectUrl } from "../composables/useObjectUrl";
import { type DownloadCopy } from "../lib/appMode";
import { type MediaKind } from "../lib/mediaKind";
import { formatFileSize } from "../lib/ringtoneDisplay";

const props = defineProps<{
  blob: Blob;
  fileName: string;
  kind: MediaKind;
  copy: DownloadCopy;
}>();

defineEmits<{
  (e: "reset"): void;
}>();

const fileUrl = useObjectUrl(() => props.blob);
const { baseName, extension, downloadName } = useFileRename(
  () => props.fileName,
);
</script>

<template>
  <div class="card download-card">
    <!-- Success Badge -->
    <div class="download-hero">
      <div class="download-badge">
        <CheckCircle2 :size="32" />
      </div>
      <h2 class="download-title">{{ copy.heading }}</h2>
      <p class="download-text">{{ copy.text }}</p>
    </div>

    <!-- File Details Box -->
    <div class="download-details">
      <div class="download-file">
        <div class="download-file-icon">
          <Video v-if="kind === 'video'" :size="20" />
          <ImageIcon v-else-if="kind === 'image'" :size="20" />
          <Music v-else :size="20" />
        </div>
        <div class="download-file-info">
          <label class="download-rename">
            <input
              v-model="baseName"
              class="download-name-input"
              type="text"
              aria-label="File name"
              spellcheck="false"
              autocomplete="off"
            />
            <span v-if="extension" class="download-name-extension">
              .{{ extension }}
            </span>
            <Pencil class="download-rename-icon" :size="14" />
          </label>
          <div class="download-file-size">
            Size: {{ formatFileSize(blob.size) }}
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div v-if="fileUrl" class="download-preview">
        <div class="download-preview-label">{{ copy.previewLabel }}</div>
        <video
          v-if="kind === 'video'"
          :src="fileUrl"
          controls
          playsinline
          class="download-video"
        ></video>
        <img
          v-else-if="kind === 'image'"
          :src="fileUrl"
          :alt="downloadName"
          class="download-image"
        />
        <audio v-else :src="fileUrl" controls class="download-audio"></audio>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="download-actions">
      <!-- Standard HTML Download Link -->
      <a
        v-if="fileUrl"
        :href="fileUrl"
        :download="downloadName"
        class="btn btn-primary btn-tall btn-wide"
      >
        <Download :size="20" /> {{ copy.buttonLabel }}
      </a>
      <button class="btn btn-secondary btn-tall" @click="$emit('reset')">
        Convert Another File
      </button>
    </div>
  </div>
</template>
