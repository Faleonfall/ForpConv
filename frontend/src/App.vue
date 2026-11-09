<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { RotateCcw } from "@lucide/vue";
import AppHeader from "./components/app/AppHeader.vue";
import AppFooter from "./components/app/AppFooter.vue";
import ModeTabs from "./components/app/ModeTabs.vue";
import ProgressPanel from "./components/shared/ProgressPanel.vue";
// Eager, the first screen anyway, and a lazy wrapper would render empty
// while the tab transition animates it
import FileUpload from "./components/shared/FileUpload.vue";
import { useTheme } from "./composables/app/useTheme";
import { useAppMode } from "./composables/app/useAppMode";
import { useFfmpegEngine } from "./composables/engine/useFfmpegEngine";
import { useAppFlow } from "./composables/app/useAppFlow";
import {
  CONVERT_DOWNLOAD_COPY,
  RINGTONE_DOWNLOAD_COPY,
  engineTitle,
} from "./lib/app/appMode";

const RingtoneTrimmer = defineAsyncComponent(
  () => import("./components/ringtone/RingtoneTrimmer.vue"),
);
const FormatPicker = defineAsyncComponent(
  () => import("./components/convert/FormatPicker.vue"),
);
const ResultDownload = defineAsyncComponent(
  () => import("./components/shared/ResultDownload.vue"),
);

const { themeChoice, toggleTheme } = useTheme();
const { mode, direction, hasSwitched, setMode } = useAppMode();

const engine = useFfmpegEngine();
const { isReady, loadProgress, loadStatus, loadFailed, progress, status } =
  engine;
const {
  ringtone,
  converter,
  copy,
  step,
  flowFailed,
  progressTitle,
  uploadRejection,
  ringtoneName,
  handleFileSelected,
  handleBack,
  handleHome,
} = useAppFlow(mode, engine);
// Template refs unwrap only at the top level
const { selectedFile: ringtoneFile, generatedRingtoneBlob: ringtoneBlob } =
  ringtone;
const {
  selectedFile: convertFile,
  hasAudio: convertHasAudio,
  frameRate: convertFrameRate,
  timelineFile: convertTimeline,
  isPreparingTimeline: convertPreparingTimeline,
  convertedBlob,
  convertedTarget,
  convertedName,
} = converter;
</script>

<template>
  <!-- Header -->
  <AppHeader
    :theme-choice="themeChoice"
    @toggle="toggleTheme"
    @home="handleHome"
  />

  <!-- Main Body Content -->
  <main class="app-main">
    <div v-if="isReady && step === 'upload'" class="app-hero">
      <ModeTabs :mode="mode" @select="setMode" />
      <Transition :name="`mode-${direction}`">
        <div :key="mode" :class="{ 'mode-switched': hasSwitched }">
          <h1 class="app-hero-title">{{ copy.heroTitle }}</h1>
          <p class="app-hero-subtitle">{{ copy.heroSubtitle }}</p>
        </div>
      </Transition>
    </div>

    <!-- Loading FFmpeg Engine -->
    <ProgressPanel
      v-if="!isReady"
      :percent="loadProgress"
      :title="engineTitle(loadFailed)"
      :text="loadStatus"
      :failed="loadFailed"
    >
      <button
        v-if="loadFailed"
        class="btn btn-primary progress-retry"
        type="button"
        @click="engine.loadEngine"
      >
        <span class="btn-face"><RotateCcw :size="18" /> Retry</span>
      </button>
    </ProgressPanel>

    <!-- Upload File -->
    <Transition v-else-if="step === 'upload'" :name="`mode-${direction}`">
      <FileUpload
        :key="mode"
        :class="{ 'mode-switched': hasSwitched }"
        :kinds="copy.kinds"
        :subtitle="copy.uploadSubtitle"
        :rejection="uploadRejection"
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
      :timeline-file="convertTimeline"
      :preparing-timeline="convertPreparingTimeline"
      @convert="converter.handleConversion"
      @cancel="converter.handleCancel"
    />

    <!-- Transcoding -->
    <ProgressPanel
      v-else-if="step === 'converting'"
      :percent="progress"
      :title="progressTitle"
      :text="status"
      :failed="flowFailed"
    >
      <button
        v-if="flowFailed"
        class="btn btn-secondary progress-retry"
        type="button"
        @click="handleBack"
      >
        <span class="btn-face">{{ copy.backLabel }}</span>
      </button>
    </ProgressPanel>

    <!-- Ringtone: Download -->
    <ResultDownload
      v-else-if="mode === 'ringtone' && step === 'download' && ringtoneBlob"
      :blob="ringtoneBlob"
      :file-name="ringtoneName"
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
      :copy="CONVERT_DOWNLOAD_COPY"
      @reset="converter.handleReset"
    />

    <!-- Inline Footer inside container -->
    <AppFooter />
  </main>
</template>
