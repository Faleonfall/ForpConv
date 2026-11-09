<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";

defineProps<{
  // 0 to 100
  percent: number;
  title: string;
  text: string;
  // The work stopped on an error, a warning takes the count's place and the
  // bar turns into a thin red line
  failed?: boolean;
}>();
</script>

<template>
  <div class="card progress-container" :class="{ 'progress-failed': failed }">
    <div v-if="failed" class="progress-alert">
      <TriangleAlert :size="34" />
    </div>
    <div v-else class="progress-value">{{ percent }}<span>%</span></div>
    <div
      class="progress-bar"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="progress-bar-fill"
        :style="{ '--progress': percent / 100 }"
      ></div>
    </div>
    <h2 class="progress-title">{{ title }}</h2>
    <p class="progress-text">{{ text }}</p>
    <slot />
  </div>
</template>
