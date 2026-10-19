<script setup lang="ts">
import { Sparkles, Music, Sun, Moon } from "@lucide/vue";
import { themeToggleTitle } from "../lib/ringtoneDisplay";
import { type Theme } from "../lib/themeStorage";

defineProps<{ activeTheme: Theme }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <header class="header">
    <div class="header-logo">
      <div class="header-logo-icon">
        <Music :size="18" />
      </div>
      <span class="header-logo-text">forpConv</span>
    </div>
    <div class="header-actions">
      <div class="header-badge">
        <Sparkles class="header-badge-icon" :size="14" />
        <span>100% Client-Side</span>
      </div>
      <!-- Theme Switcher Button -->
      <button
        class="header-theme-toggle"
        :title="themeToggleTitle(activeTheme)"
        @click="$emit('toggle')"
      >
        <Sun v-if="activeTheme === 'light'" :size="18" />
        <Moon v-else :size="18" />
      </button>
    </div>
  </header>
</template>
