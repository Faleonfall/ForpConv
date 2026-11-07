<script setup lang="ts">
import { APP_MODES, MODE_COPY, modeIndex, type AppMode } from "../lib/appMode";
import { useDropSwitch } from "../composables/useDropSwitch";

const props = defineProps<{ mode: AppMode }>();
defineEmits<{ select: [mode: AppMode] }>();

const { hasMoved } = useDropSwitch(() => props.mode);
</script>

<template>
  <div
    class="drop-switch tabs"
    :class="{
      'drop-switch-end': modeIndex(mode) === 1,
      'drop-switch-moved': hasMoved,
    }"
    role="tablist"
    aria-label="Tool"
  >
    <span class="drop-switch-drop tabs-indicator" aria-hidden="true"></span>
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
