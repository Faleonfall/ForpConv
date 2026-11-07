<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from "vue";
import { RotateCcw } from "@lucide/vue";
import AppHeader from "./components/AppHeader.vue";
import AppFooter from "./components/AppFooter.vue";
import ModeTabs from "./components/ModeTabs.vue";
import ProgressPanel from "./components/ProgressPanel.vue";
// Eager, the first screen anyway, and a lazy wrapper would render empty
// while the tab transition animates it
import FileUpload from "./components/FileUpload.vue";
import { useTheme } from "./composables/useTheme";
import { useAppMode } from "./composables/useAppMode";
import { useFfmpegEngine } from "./composables/useFfmpegEngine";
import { useRingtoneConverter } from "./composables/useRingtoneConverter";
import { useFormatConverter } from "./composables/useFormatConverter";
import { useLeaveWarning } from "./composables/useLeaveWarning";
import {
  CONVERT_DOWNLOAD_COPY,
  MODE_COPY,
  RINGTONE_DOWNLOAD_COPY,
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

const { themeChoice, toggleTheme } = useTheme();
const { mode, direction, setMode } = useAppMode();

const engine = useFfmpegEngine();
const { isReady, loadProgress, loadStatus, loadFailed, progress, status } =
  engine;
const ringtone = useRingtoneConverter(engine);
const converter = useFormatConverter(engine);
// Either tab past its upload holds a file a reload would drop
useLeaveWarning(
  () =>
    ringtone.currentStep.value !== "upload" ||
    converter.currentStep.value !== "upload",
);

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
const convertTimeline = converter.timelineFile;
const convertPreparingTimeline = converter.isPreparingTimeline;
const convertedBlob = converter.convertedBlob;
const convertedTarget = converter.convertedTarget;
const convertedName = converter.convertedName;

// A rejection belongs to the pick that caused it, not to the next visit
watch(mode, () => ringtone.clearUploadError());

const activeFlow = () => (mode.value === "ringtone" ? ringtone : converter);

const handleFileSelected = (file: File): void => {
  void activeFlow().handleFileSelected(file);
};

const flowFailed = computed(() => activeFlow().failed.value);

// The logo drops the open file and returns to upload, a running conversion
// can't be stopped halfway so it finishes first
const handleHome = (): void => {
  const flow = activeFlow();
  if (flow.currentStep.value !== "converting" || flow.failed.value) {
    flow.handleReset();
  }
};
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
      <Transition :name="`mode-${direction}`" mode="out-in">
        <div :key="mode">
          <h1 class="app-hero-title">{{ copy.heroTitle }}</h1>
          <p class="app-hero-subtitle">{{ copy.heroSubtitle }}</p>
        </div>
      </Transition>
    </div>

    <!-- Loading FFmpeg Engine -->
    <ProgressPanel
      v-if="!isReady"
      :percent="loadProgress"
      :title="loadFailed ? 'Engine Failed to Load' : 'Initializing Engine'"
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
      :timeline-file="convertTimeline"
      :preparing-timeline="convertPreparingTimeline"
      @convert="converter.handleConversion"
      @cancel="converter.handleCancel"
    />

    <!-- Transcoding -->
    <ProgressPanel
      v-else-if="step === 'converting'"
      :percent="progress"
      :title="flowFailed ? copy.failedTitle : copy.progressTitle"
      :text="status"
      :failed="flowFailed"
    >
      <button
        v-if="flowFailed"
        class="btn btn-secondary progress-retry"
        type="button"
        @click="activeFlow().handleBack()"
      >
        <span class="btn-face">{{ copy.backLabel }}</span>
      </button>
    </ProgressPanel>

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
      :copy="CONVERT_DOWNLOAD_COPY"
      @reset="converter.handleReset"
    />

    <!-- Inline Footer inside container -->
    <AppFooter />
  </main>
</template>
