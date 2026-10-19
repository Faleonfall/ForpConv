<script setup lang="ts">
import { Download, Music, CheckCircle2 } from "@lucide/vue";
import { useObjectUrl } from "../composables/useObjectUrl";
import { formatFileSize, ringtoneFileName } from "../lib/ringtoneDisplay";

const props = defineProps<{
  blob: Blob;
  title: string;
}>();

defineEmits<{
  (e: "reset"): void;
}>();

const audioUrl = useObjectUrl(() => props.blob);
</script>

<template>
  <div class="card download-card">
    <!-- Success Badge -->
    <div class="download-hero">
      <div class="download-badge">
        <CheckCircle2 :size="32" />
      </div>
      <h2 class="download-title">Ringtone Created!</h2>
      <p class="download-text">
        The M4R file is ready. Download and transfer it to the iPhone.
      </p>
    </div>

    <!-- Ringtone Details Box -->
    <div class="download-details">
      <div class="download-file">
        <div class="download-file-icon">
          <Music :size="20" />
        </div>
        <div class="download-file-info">
          <div class="download-file-name">
            {{ ringtoneFileName(title) }}
          </div>
          <div class="download-file-size">
            Size: {{ formatFileSize(blob.size) }}
          </div>
        </div>
      </div>

      <!-- Preview Player -->
      <div class="download-preview">
        <div class="download-preview-label">Preview Tone</div>
        <audio
          v-if="audioUrl"
          :src="audioUrl"
          controls
          class="download-audio"
        ></audio>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="download-actions">
      <!-- Standard HTML Download Link -->
      <a
        v-if="audioUrl"
        :href="audioUrl"
        :download="ringtoneFileName(title)"
        class="btn btn-primary btn-tall btn-wide"
      >
        <Download :size="20" /> Download Ringtone File
      </a>
      <button class="btn btn-secondary btn-tall" @click="$emit('reset')">
        Convert Another File
      </button>
    </div>
  </div>
</template>
