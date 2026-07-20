import { ref, onMounted } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

export type WorkflowStep =
  "loading" | "upload" | "trim" | "converting" | "download";

export interface ConvertParams {
  startTime: number;
  endTime: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  title: string;
}

export function useRingtoneConverter() {
  const currentStep = ref<WorkflowStep>("loading");

  // Active states
  const selectedFile = ref<File | null>(null);
  const generatedRingtoneBlob = ref<Blob | null>(null);
  const ringtoneTitle = ref("");

  // Progress states
  const conversionProgress = ref(0);
  const conversionStatus = ref("Preparing files...");

  const ffmpeg = new FFmpeg();

  onMounted(async () => {
    try {
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

      // Bind progress logger for initialization if available
      ffmpeg.on("log", ({ message }) => {
        // Look for load indicators or log initialization steps
        console.log("[FFmpeg Log]", message);
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript",
        ),
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

  const handleFileSelected = (file: File): void => {
    selectedFile.value = file;
    currentStep.value = "trim";
  };

  const handleConversion = async (params: ConvertParams): Promise<void> => {
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
        typeof rawData === "string"
          ? new TextEncoder().encode(rawData)
          : rawData;

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

  return {
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
  };
}
