<script setup lang="ts">
import { Sparkles, Music, Sun, Moon } from "@lucide/vue";
import { themeToggleTitle } from "../lib/ringtoneDisplay";
import { type ThemeChoice } from "../lib/themeStorage";

defineProps<{ themeChoice: ThemeChoice }>();
defineEmits<{ toggle: []; home: [] }>();
</script>

<template>
  <header class="header">
    <button
      type="button"
      class="header-logo"
      title="Back to start"
      @click="$emit('home')"
    >
      <span class="header-logo-icon">
        <Music :size="18" />
      </span>
      <span class="header-logo-text">forpConv</span>
    </button>
    <div class="header-actions">
      <div class="header-badge">
        <Sparkles class="header-badge-icon" :size="14" />
        <span>100% Client-Side</span>
      </div>
      <!-- Theme Switcher Button, A follows the system -->
      <button
        class="header-theme-toggle"
        :title="themeToggleTitle(themeChoice)"
        @click="$emit('toggle')"
      >
        <Sun v-if="themeChoice === 'light'" :size="18" />
        <Moon v-else-if="themeChoice === 'dark'" :size="18" />
        <span v-else class="header-theme-auto" aria-hidden="true">A</span>
      </button>
    </div>
  </header>
</template>
