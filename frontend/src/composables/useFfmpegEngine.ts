import { ref, onMounted } from "vue";
import { FFmpeg, type FFFSType } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import {
  downloadRatio,
  downloadStatus,
  loadFfmpegCore,
  retryStatus,
} from "../lib/ffmpegNetwork";
import {
  applyLogLine,
  createProgressState,
  progressRatio,
  progressStatus,
  remainingSeconds,
  type ProgressState,
} from "../lib/ffmpegProgress";
import {
  PROBE_DIR,
  UNKNOWN_STREAMS,
  probeArgs,
  readStreams,
  type StreamInfo,
} from "../lib/streamProbe";
import { FfmpegExitError } from "../lib/ffmpegExitError";

const LOAD_FAILED_STATUS =
  "Failed to load processing engine. Check the connection and try again.";

export interface EngineJob {
  input: Blob;
  inputName: string;
  args: string[];
  outputName: string;
  mime: string;
  // Prefix for the progress status, eg "Converting audio..."
  progressLabel: string;
  // Length of the output, null to take the input duration from the log
  outputSeconds: number | null;
  // GIF palette pass reads the whole input before writing
  readsFirst: boolean;
}

// One FFmpeg instance shared by every flow, so the core downloads once
export function useFfmpegEngine() {
  const isReady = ref(false);
  // Core download, separate from the per-job progress below
  const loadProgress = ref(0);
  const loadStatus = ref("Preparing engine...");
  const loadFailed = ref(false);
  const progress = ref(0);
  const status = ref("Preparing files...");

  const ffmpeg = new FFmpeg();
  // Set only while a job runs
  let tracker: ProgressState | null = null;
  let progressLabel = "";
  let startedAt = 0;
  // Collects the log only while a probe runs
  let probeLines: string[] | null = null;

  // ffmpeg.wasm measures its own progress against the full input, which is
  // wrong for trims and stalls on the GIF palette pass, so read the log
  const trackLogLine = (message: string): void => {
    if (!tracker) return;
    tracker = applyLogLine(tracker, message);

    const ratio = progressRatio(tracker);
    const percent = Math.max(progress.value, Math.round(ratio * 100));
    const elapsed = (performance.now() - startedAt) / 1000;
    progress.value = percent;
    status.value = progressStatus(
      progressLabel,
      percent,
      elapsed,
      remainingSeconds(elapsed, percent / 100),
    );
  };

  // Downloads and starts the core, safe to call again after a failure
  const loadEngine = async (): Promise<void> => {
    if (isReady.value) return;
    loadFailed.value = false;
    loadProgress.value = 0;
    loadStatus.value = downloadStatus(0);

    try {
      await loadFfmpegCore(ffmpeg, {
        onDownload: (received) => {
          loadProgress.value = Math.round(downloadRatio(received) * 100);
          loadStatus.value = downloadStatus(received);
        },
        onRetry: (attempt) => {
          loadStatus.value = retryStatus(attempt);
        },
      });

      loadProgress.value = 100;
      isReady.value = true;
    } catch (error) {
      console.error("Failed to load FFmpeg.wasm:", error);
      loadFailed.value = true;
      loadStatus.value = LOAD_FAILED_STATUS;
    }
  };

  // A wasm fault leaves the core broken for every later job, so a fresh one
  // replaces it before the failed job reports back. The log listener stays
  // on the instance across the swap.
  const restartCore = async (): Promise<void> => {
    ffmpeg.terminate();
    try {
      await loadFfmpegCore(ffmpeg);
    } catch (error) {
      console.error("Failed to restart FFmpeg.wasm:", error);
      isReady.value = false;
      loadFailed.value = true;
      loadStatus.value = LOAD_FAILED_STATUS;
    }
  };

  onMounted(() => {
    ffmpeg.on("log", ({ message }) => {
      console.log("[FFmpeg Log]", message);
      probeLines?.push(message);
      trackLogLine(message);
    });
    void loadEngine();
  });

  // Reads the file where it lies, without a copy into memory, for whether it
  // has a track with actual sound and how many frames a second it plays
  const probeStreams = async (file: File): Promise<StreamInfo> => {
    probeLines = [];
    let crashed = false;
    try {
      await ffmpeg.createDir(PROBE_DIR);
      // The enum lives in the runtime package, its value is the plain name
      await ffmpeg.mount("WORKERFS" as FFFSType, { files: [file] }, PROBE_DIR);
      // Exits nonzero without an audio track, the log still lists the
      // streams. It resolves on any exit, so a rejection is a wasm fault.
      await ffmpeg.exec(probeArgs(file.name)).catch((error: unknown) => {
        crashed = true;
        throw error;
      });
      return readStreams(probeLines);
    } catch (error) {
      console.error("Stream probe failed:", error);
      return UNKNOWN_STREAMS;
    } finally {
      probeLines = null;
      if (crashed) {
        await restartCore();
      } else {
        await ffmpeg.unmount(PROBE_DIR).catch(() => false);
        await ffmpeg.deleteDir(PROBE_DIR).catch(() => false);
      }
    }
  };

  // Writes the input to the in-memory filesystem, runs FFmpeg and reads the
  // output back as a blob, removing both files either way
  const runJob = async (job: EngineJob): Promise<Blob> => {
    progress.value = 0;
    progressLabel = job.progressLabel;
    status.value = "Uploading file to virtual memory...";

    try {
      await ffmpeg.writeFile(job.inputName, await fetchFile(job.input));

      status.value = "Initializing transcoder...";
      tracker = createProgressState(job.outputSeconds, job.readsFirst);
      startedAt = performance.now();
      const exitCode = await ffmpeg.exec(job.args);
      tracker = null;
      if (exitCode !== 0) throw new FfmpegExitError(exitCode);

      progress.value = 100;
      status.value = "Finalizing file...";
      const rawData = await ffmpeg.readFile(job.outputName);
      const dataBuffer =
        typeof rawData === "string"
          ? new TextEncoder().encode(rawData)
          : rawData;

      return new Blob([dataBuffer as unknown as BlobPart], { type: job.mime });
    } finally {
      tracker = null;
      await Promise.allSettled([
        ffmpeg.deleteFile(job.inputName),
        ffmpeg.deleteFile(job.outputName),
      ]);
    }
  };

  // The job still fails after a fault, the next one gets a working core
  const run = async (job: EngineJob): Promise<Blob> => {
    try {
      return await runJob(job);
    } catch (error) {
      if (!(error instanceof FfmpegExitError)) await restartCore();
      throw error;
    }
  };

  return {
    isReady,
    loadProgress,
    loadStatus,
    loadFailed,
    progress,
    status,
    loadEngine,
    probeStreams,
    run,
  };
}

export type FfmpegEngine = ReturnType<typeof useFfmpegEngine>;
