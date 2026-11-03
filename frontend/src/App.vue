<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from "vue";
import { Loader2, RotateCcw } from "@lucide/vue";
import AppHeader from "./components/AppHeader.vue";
import AppFooter from "./components/AppFooter.vue";
import ModeTabs from "./components/ModeTabs.vue";
// Eager, the first screen anyway, and a lazy wrapper would render empty
// while the tab transition animates it
import FileUpload from "./components/FileUpload.vue";
import { useTheme } from "./composables/useTheme";
import { useAppMode } from "./composables/useAppMode";
import { useFfmpegEngine } from "./composables/useFfmpegEngine";
import { useRingtoneConverter } from "./composables/useRingtoneConverter";
import { useFormatConverter } from "./composables/useFormatConverter";
import {
  MODE_COPY,
  RINGTONE_DOWNLOAD_COPY,
  convertDownloadCopy,
} from "./lib/appMode";
import { ringtoneFileName } from "./lib/ringtoneDisplay";

const RingtoneTrimmer = defineAsyncComponent(
  () => import("./components/RingtoneTrimmer.vue"),
);
const FormatPicker = defineAsyncComponent(
  () => import("./components/FormatPicker.vue"),
);
const ResultDownload = defineAsyncComponent(
  () => import("./components/ResultDownload.vue"),
);

const { activeTheme, toggleTheme } = useTheme();
const { mode, direction, setMode } = useAppMode();

const engine = useFfmpegEngine();
const { isReady, loadProgress, loadStatus, loadFailed, progress, status } =
  engine;
const ringtone = useRingtoneConverter(engine);
const converter = useFormatConverter(engine);

const copy = computed(() => MODE_COPY[mode.value]);
const step = computed(() =>
  mode.value === "ringtone"
    ? ringtone.currentStep.value
    : converter.currentStep.value,
);
const ringtoneFile = ringtone.selectedFile;
const ringtoneBlob = ringtone.generatedRingtoneBlob;
const ringtoneTitle = ringtone.ringtoneTitle;
const ringtoneUploadError = ringtone.uploadError;
const convertFile = converter.selectedFile;
const convertHasAudio = converter.hasAudio;
const convertFrameRate = converter.frameRate;
const convertedBlob = converter.convertedBlob;
const convertedTarget = converter.convertedTarget;
const convertedName = converter.convertedName;

// A rejection belongs to the pick that caused it, not to the next visit
watch(mode, () => ringtone.clearUploadError());

const handleFileSelected = (file: File): void => {
  const flow = mode.value === "ringtone" ? ringtone : converter;
  void flow.handleFileSelected(file);
};
</script>

<template>
  <!-- Header -->
  <AppHeader :active-theme="activeTheme" @toggle="toggleTheme" />

  <!-- Main Body Content -->
  <main class="app-main">
    <div v-if="isReady && step === 'upload'" class="app-hero">
      <ModeTabs :mode="mode" @select="setMode" />
      <Transition :name="`mode-${direction}`" mode="out-in">
        <div :key="mode">
          <h1 class="app-hero-title">{{ copy.heroTitle }}</h1>
          <p class="app-hero-subtitle">{{ copy.heroSubtitle }}</p>
        </div>
      </Transition>
    </div>

    <!-- Loading FFmpeg Engine -->
    <div v-if="!isReady" class="card progress-container">
      <div class="progress-loader">
        <svg class="progress-loader-svg" viewBox="0 0 36 36">
          <circle class="progress-loader-bg" cx="18" cy="18" r="16"></circle>
          <circle
            class="progress-loader-fill"
            cx="18"
            cy="18"
            r="16"
            stroke-dasharray="100"
            :stroke-dashoffset="100 - loadProgress"
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
        <div class="progress-value">
          <Loader2
            v-if="loadProgress >= 99 && !loadFailed"
            class="progress-spinner"
            :size="24"
          />
          <template v-else>{{ loadProgress }}%</template>
        </div>
      </div>
      <h2 class="progress-title">
        {{ loadFailed ? "Engine Failed to Load" : "Initializing Engine" }}
      </h2>
      <p class="progress-text">{{ loadStatus }}</p>
      <button
        v-if="loadFailed"
        class="btn btn-primary progress-retry"
        type="button"
        @click="engine.loadEngine"
      >
        <RotateCcw :size="18" /> Retry
      </button>
    </div>

    <!-- Upload File -->
    <Transition
      v-else-if="step === 'upload'"
      :name="`mode-${direction}`"
      mode="out-in"
    >
      <FileUpload
        :key="mode"
        :kinds="copy.kinds"
        :subtitle="copy.uploadSubtitle"
        :rejection="mode === 'ringtone' ? ringtoneUploadError : ''"
        @file-selected="handleFileSelected"
      />
    </Transition>

    <!-- Ringtone: Trim & Edit Selection -->
    <RingtoneTrimmer
      v-else-if="mode === 'ringtone' && step === 'trim' && ringtoneFile"
      :file="ringtoneFile"
      @convert="ringtone.handleConversion"
      @cancel="ringtone.handleCancel"
    />

    <!-- Convert: Pick Target Format -->
    <FormatPicker
      v-else-if="mode === 'convert' && step === 'pick' && convertFile"
      :file="convertFile"
      :has-audio="convertHasAudio"
      :frame-rate="convertFrameRate"
      @convert="converter.handleConversion"
      @cancel="converter.handleCancel"
    />

    <!-- Transcoding -->
    <div v-else-if="step === 'converting'" class="card progress-container">
      <div class="progress-loader">
        <svg class="progress-loader-svg" viewBox="0 0 36 36">
          <circle class="progress-loader-bg" cx="18" cy="18" r="16"></circle>
          <circle
            class="progress-loader-fill"
            cx="18"
            cy="18"
            r="16"
            stroke-dasharray="100"
            :stroke-dashoffset="100 - progress"
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
        <div class="progress-value">{{ progress }}%</div>
      </div>
      <h2 class="progress-title">{{ copy.progressTitle }}</h2>
      <p class="progress-text">
        {{ status }}
      </p>
    </div>

    <!-- Ringtone: Download -->
    <ResultDownload
      v-else-if="mode === 'ringtone' && step === 'download' && ringtoneBlob"
      :blob="ringtoneBlob"
      :file-name="ringtoneFileName(ringtoneTitle)"
      kind="audio"
      :copy="RINGTONE_DOWNLOAD_COPY"
      @reset="ringtone.handleReset"
    />

    <!-- Convert: Download -->
    <ResultDownload
      v-else-if="
        mode === 'convert' &&
        step === 'download' &&
        convertedBlob &&
        convertedTarget
      "
      :blob="convertedBlob"
      :file-name="convertedName"
      :kind="convertedTarget.kind"
      :copy="convertDownloadCopy(convertedTarget)"
      @reset="converter.handleReset"
    />

    <!-- Inline Footer inside container -->
    <AppFooter />
  </main>
</template>
