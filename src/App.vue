<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { Sparkles, Loader2, Music, Sun, Moon } from "@lucide/vue";

const FileUpload = defineAsyncComponent(
  () => import("./components/FileUpload.vue"),
);
const RingtoneTrimmer = defineAsyncComponent(
  () => import("./components/RingtoneTrimmer.vue"),
);
const ResultDownload = defineAsyncComponent(
  () => import("./components/ResultDownload.vue"),
);

// Theme Switcher State
const activeTheme = ref<"dark" | "light">("dark");

const toggleTheme = (): void => {
  const newTheme = activeTheme.value === "dark" ? "light" : "dark";
  activeTheme.value = newTheme;
  document.documentElement.setAttribute("data-theme", newTheme);
};

// Application Workflow Steps: 'loading' | 'upload' | 'trim' | 'converting' | 'download'
const currentStep = ref<
  "loading" | "upload" | "trim" | "converting" | "download"
>("loading");

// Active States
const selectedFile = ref<File | null>(null);
const generatedRingtoneBlob = ref<Blob | null>(null);
const ringtoneTitle = ref("");

// Progress States
const conversionProgress = ref(0);
const conversionStatus = ref("Preparing files...");

const ffmpeg = new FFmpeg();

onMounted(async () => {
  // Check system prefers-color-scheme
  const systemPrefersLight = window.matchMedia(
    "(prefers-color-scheme: light)",
  ).matches;
  if (systemPrefersLight) {
    activeTheme.value = "light";
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    activeTheme.value = "dark";
    document.documentElement.setAttribute("data-theme", "dark");
  }

  try {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

    // Bind progress logger for initialization if available
    ffmpeg.on("log", ({ message }) => {
      // Look for load indicators or log initialization steps
      console.log("[FFmpeg Log]", message);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });

    currentStep.value = "upload";
  } catch (error) {
    console.error("Failed to load FFmpeg.wasm:", error);
    conversionStatus.value =
      "Failed to load processing engine. Make sure your browser supports WebAssembly.";
  }
});

// Event Handlers
const handleFileSelected = (file: File): void => {
  selectedFile.value = file;
  currentStep.value = "trim";
};

const handleConversion = async (params: {
  startTime: number;
  endTime: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  title: string;
}): Promise<void> => {
  if (!selectedFile.value) return;

  currentStep.value = "converting";
  conversionProgress.value = 0;
  conversionStatus.value = "Uploading file to virtual memory...";
  ringtoneTitle.value = params.title;

  try {
    const file = selectedFile.value;
    const ext = file.name.split(".").pop() || "mp3";
    const inputFileName = `input.${ext}`;
    const outputFileName = "output.m4a";

    // 1. Write the file to in-memory filesystem
    const fileData = await fetchFile(file);
    await ffmpeg.writeFile(inputFileName, fileData);

    // 2. Set up progress listener
    ffmpeg.on("progress", ({ progress }) => {
      conversionProgress.value = Math.min(100, Math.round(progress * 100));
      conversionStatus.value = `Converting audio... ${conversionProgress.value}%`;
    });

    // 3. Build filter graph
    const duration = params.endTime - params.startTime;
    const filters: string[] = [];

    if (params.volume !== 1.0) {
      filters.push(`volume=${params.volume}`);
    }
    if (params.fadeIn > 0) {
      filters.push(`afade=t=in:st=0:d=${params.fadeIn}`);
    }
    if (params.fadeOut > 0) {
      filters.push(
        `afade=t=out:st=${duration - params.fadeOut}:d=${params.fadeOut}`,
      );
    }

    // 4. Run FFmpeg command
    conversionStatus.value = "Initializing transcoder...";
    const ffmpegCmd = [
      "-i",
      inputFileName,
      "-ss",
      params.startTime.toString(),
      "-to",
      params.endTime.toString(),
    ];

    if (filters.length > 0) {
      ffmpegCmd.push("-af", filters.join(","));
    }

    ffmpegCmd.push(
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-vn", // Strip video tracks
      outputFileName,
    );

    await ffmpeg.exec(ffmpegCmd);

    // 5. Read output file from memory
    conversionStatus.value = "Finalizing ringtone...";
    const rawData = await ffmpeg.readFile(outputFileName);
    const dataBuffer =
      typeof rawData === "string" ? new TextEncoder().encode(rawData) : rawData;

    // Clean up memory
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    // 6. Create Downloadable Blob
    // .m4r is AAC audio in MP4 wrapper, standard MIME type is audio/mp4 or audio/x-m4r
    generatedRingtoneBlob.value = new Blob(
      [dataBuffer as unknown as BlobPart],
      { type: "audio/x-m4r" },
    );
    currentStep.value = "download";
  } catch (error) {
    console.error("Transcoding failed:", error);
    conversionStatus.value =
      "Transcoding failed. Please check your file formatting.";
    // Reset back to trim after error display
    setTimeout(() => {
      currentStep.value = "trim";
    }, 4000);
  }
};

const handleCancel = (): void => {
  selectedFile.value = null;
  currentStep.value = "upload";
};

const handleReset = (): void => {
  selectedFile.value = null;
  generatedRingtoneBlob.value = null;
  ringtoneTitle.value = "";
  currentStep.value = "upload";
};
</script>

<template>
  <!-- Header -->
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
        @click="toggleTheme"
      >
        <Sun v-if="activeTheme === 'light'" :size="18" />
        <Moon v-else :size="18" />
      </button>
    </div>
  </header>

  <!-- Main Body Content -->
  <main class="container">
    <div
      v-if="currentStep === 'upload'"
      style="margin-bottom: 30px; text-align: center"
    >
      <h1
        style="
          font-family: var(--font-display);
          font-size: 2.25rem;
          font-weight: 800;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        "
      >
        iPhone M4R Ringtone Maker
      </h1>
      <p
        style="
          color: var(--text-muted);
          font-size: 1.05rem;
          max-width: 500px;
          margin: 0 auto;
        "
      >
        Trim and convert audio or video files into M4R iPhone ringtones.
      </p>
    </div>

    <!-- Step 1: Loading FFmpeg Engine -->
    <div v-if="currentStep === 'loading'" class="glass-card progress-container">
      <div class="progress-loader">
        <svg class="progress-loader-svg" viewBox="0 0 36 36">
          <circle class="progress-loader-bg" cx="18" cy="18" r="16"></circle>
          <!-- Animated indefinite loading circle -->
          <circle
            class="progress-loader-fill animate-pulse"
            cx="18"
            cy="18"
            r="16"
            stroke-dasharray="100"
            stroke-dashoffset="30"
          ></circle>
        </svg>
        <div class="progress-value">
          <Loader2
            class="animate-spin"
            :size="24"
            style="color: var(--primary)"
          />
        </div>
      </div>
      <h2
        style="
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 8px;
        "
      >
        Initializing Engine
      </h2>
      <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 320px">
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
      class="glass-card progress-container"
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
              <stop offset="0%" stop-color="#6366f1" />
              <stop offset="100%" stop-color="#a855f7" />
            </linearGradient>
          </defs>
        </svg>
        <div class="progress-value">{{ conversionProgress }}%</div>
      </div>
      <h2
        style="
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 8px;
        "
      >
        Creating Ringtone
      </h2>
      <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 300px">
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
    <div class="app-footer-inline">
      <span>&copy; 2026 forpConv</span>
      <span class="footer-divider">•</span>
      <a
        href="https://github.com/Faleonfall/ForpConv"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-link"
      >
        GitHub
      </a>
      <span class="footer-divider">•</span>
      <span>Processed completely in-browser on your local machine.</span>
    </div>
  </main>
</template>
