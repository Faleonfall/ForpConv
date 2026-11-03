<script setup lang="ts">
import { APP_MODES, MODE_COPY, modeIndex, type AppMode } from "../lib/appMode";

defineProps<{ mode: AppMode }>();
defineEmits<{ select: [mode: AppMode] }>();
</script>

<template>
  <div
    class="tabs"
    role="tablist"
    aria-label="Tool"
    :style="{ '--tab-count': APP_MODES.length, '--tab-index': modeIndex(mode) }"
  >
    <span class="tabs-indicator" aria-hidden="true"></span>
    <button
      v-for="option in APP_MODES"
      :key="option"
      type="button"
      role="tab"
      class="tabs-tab"
      :class="{ 'tabs-tab-active': option === mode }"
      :aria-selected="option === mode"
      @click="$emit('select', option)"
    >
      {{ MODE_COPY[option].tabLabel }}
    </button>
  </div>
</template>
