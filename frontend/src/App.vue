<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { Loader2 } from "@lucide/vue";
import AppHeader from "./components/AppHeader.vue";
import AppFooter from "./components/AppFooter.vue";
import { useTheme } from "./composables/useTheme";
import { useRingtoneConverter } from "./composables/useRingtoneConverter";

const FileUpload = defineAsyncComponent(
  () => import("./components/FileUpload.vue"),
);
const RingtoneTrimmer = defineAsyncComponent(
  () => import("./components/RingtoneTrimmer.vue"),
);
const ResultDownload = defineAsyncComponent(
  () => import("./components/ResultDownload.vue"),
);

const { activeTheme, toggleTheme } = useTheme();

const {
  currentStep,
  selectedFile,
  generatedRingtoneBlob,
  ringtoneTitle,
  conversionProgress,
  conversionStatus,
  handleFileSelected,
  handleConversion,
  handleCancel,
  handleReset,
} = useRingtoneConverter();
</script>

<template>
  <!-- Header -->
  <AppHeader :active-theme="activeTheme" @toggle="toggleTheme" />

  <!-- Main Body Content -->
  <main class="app-main">
    <div v-if="currentStep === 'upload'" class="app-hero">
      <h1 class="app-hero-title">iPhone M4R Ringtone Maker</h1>
      <p class="app-hero-subtitle">
        Trim and convert audio or video files into M4R iPhone ringtones.
      </p>
    </div>

    <!-- Step 1: Loading FFmpeg Engine -->
    <div v-if="currentStep === 'loading'" class="card progress-container">
      <div class="progress-loader">
        <svg class="progress-loader-svg" viewBox="0 0 36 36">
          <circle class="progress-loader-bg" cx="18" cy="18" r="16"></circle>
          <!-- Animated indefinite loading circle -->
          <circle
            class="progress-loader-fill progress-loader-fill-pulse"
            cx="18"
            cy="18"
            r="16"
            stroke-dasharray="100"
            stroke-dashoffset="30"
          ></circle>
        </svg>
        <div class="progress-value">
          <Loader2 class="progress-spinner" :size="24" />
        </div>
      </div>
      <h2 class="progress-title">Initializing Engine</h2>
      <p class="progress-text">
        Loading WebAssembly transcode engine locally. This takes a few seconds
        on first launch...
      </p>
    </div>

    <!-- Step 2: Upload File -->
    <FileUpload
      v-else-if="currentStep === 'upload'"
      @file-selected="handleFileSelected"
    />

    <!-- Step 3: Trim & Edit Selection -->
    <RingtoneTrimmer
      v-else-if="currentStep === 'trim' && selectedFile"
      :file="selectedFile"
      @convert="handleConversion"
      @cancel="handleCancel"
    />

    <!-- Step 4: Transcoding Audio -->
    <div
      v-else-if="currentStep === 'converting'"
      class="card progress-container"
    >
      <div class="progress-loader">
        <svg class="progress-loader-svg" viewBox="0 0 36 36">
          <circle class="progress-loader-bg" cx="18" cy="18" r="16"></circle>
          <circle
            class="progress-loader-fill"
            cx="18"
            cy="18"
            r="16"
            stroke-dasharray="100"
            :stroke-dashoffset="100 - conversionProgress"
          ></circle>
          <defs>
            <linearGradient
              id="loaderGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop class="progress-gradient-start" offset="0%" />
              <stop class="progress-gradient-end" offset="100%" />
            </linearGradient>
          </defs>
        </svg>
        <div class="progress-value">{{ conversionProgress }}%</div>
      </div>
      <h2 class="progress-title">Creating Ringtone</h2>
      <p class="progress-text">
        {{ conversionStatus }}
      </p>
    </div>

    <!-- Step 5: Download Completed Ringtone -->
    <ResultDownload
      v-else-if="currentStep === 'download' && generatedRingtoneBlob"
      :blob="generatedRingtoneBlob"
      :title="ringtoneTitle"
      @reset="handleReset"
    />

    <!-- Inline Footer inside container -->
    <AppFooter />
  </main>
</template>
