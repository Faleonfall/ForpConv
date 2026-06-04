<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { Download, Music, CheckCircle2 } from "@lucide/vue";

const props = defineProps<{
  blob: Blob;
  title: string;
}>();

defineEmits<{
  (e: "reset"): void;
}>();

const audioUrl = ref("");

// Size formatting
const formattedSize = ref("");

onMounted(() => {
  audioUrl.value = URL.createObjectURL(props.blob);

  // Format bytes
  const bytes = props.blob.size;
  if (bytes < 1024 * 1024) {
    formattedSize.value = `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    formattedSize.value = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
});

onBeforeUnmount(() => {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value);
  }
});
</script>

<template>
  <div class="glass-card download-card">
    <!-- Success Badge -->
    <div
      style="
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;
      "
    >
      <div
        style="
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--success);
        "
      >
        <CheckCircle2 :size="32" />
      </div>
      <h2
        style="
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 700;
        "
      >
        Ringtone Created!
      </h2>
      <p style="color: var(--text-muted); font-size: 0.95rem">
        The M4R file is ready. Download and transfer it to the iPhone.
      </p>
    </div>

    <!-- Ringtone Details Box -->
    <div
      style="
        background: rgba(0, 0, 0, 0.15);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      "
    >
      <div style="display: flex; align-items: center; gap: 16px">
        <div
          style="
            width: 48px;
            height: 48px;
            border-radius: var(--radius-sm);
            background: var(--gradient-main);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
          "
        >
          <Music :size="20" />
        </div>
        <div style="overflow: hidden; flex-grow: 1">
          <div
            style="
              font-family: var(--font-display);
              font-weight: 700;
              font-size: 1.1rem;
              text-overflow: ellipsis;
              overflow: hidden;
              white-space: nowrap;
            "
          >
            {{ title }}.m4r
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted)">
            Size: {{ formattedSize }}
          </div>
        </div>
      </div>

      <!-- Preview Player -->
      <div style="display: flex; flex-direction: column; gap: 6px">
        <div
          style="
            font-size: 0.75rem;
            color: var(--text-dim);
            text-transform: uppercase;
            font-weight: 600;
          "
        >
          Preview Tone
        </div>
        <audio
          v-if="audioUrl"
          :src="audioUrl"
          controls
          style="
            width: 100%;
            border-radius: 8px;
            filter: invert(0.9) hue-rotate(180deg);
          "
        ></audio>
      </div>
    </div>

    <!-- Action Buttons -->
    <div style="display: flex; flex-direction: column; gap: 12px">
      <!-- Standard HTML Download Link -->
      <a
        v-if="audioUrl"
        :href="audioUrl"
        :download="`${title}.m4r`"
        class="btn btn-primary"
        style="text-decoration: none; height: 52px; font-size: 1.05rem"
      >
        <Download :size="20" /> Download Ringtone File
      </a>
      <button
        class="btn btn-secondary"
        style="height: 52px"
        @click="$emit('reset')"
      >
        Convert Another File
      </button>
    </div>
  </div>
</template>
