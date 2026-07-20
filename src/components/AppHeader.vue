<script setup lang="ts">
import { Sparkles, Music, Sun, Moon } from "@lucide/vue";
import type { Theme } from "../composables/useTheme";

defineProps<{ activeTheme: Theme }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <header class="app-header">
    <div class="logo">
      <div class="logo-icon">
        <Music :size="18" />
      </div>
      <span class="logo-text">forpConv</span>
    </div>
    <div style="display: flex; align-items: center; gap: 16px">
      <div
        style="
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: var(--text-muted);
        "
      >
        <Sparkles :size="14" style="color: var(--accent)" />
        <span>100% Client-Side</span>
      </div>
      <!-- Theme Switcher Button -->
      <button
        class="theme-toggle-btn"
        :title="`Switch to ${activeTheme === 'dark' ? 'light' : 'dark'} theme`"
        @click="$emit('toggle')"
      >
        <Sun v-if="activeTheme === 'light'" :size="18" />
        <Moon v-else :size="18" />
      </button>
    </div>
  </header>
</template>
