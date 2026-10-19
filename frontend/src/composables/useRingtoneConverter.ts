import { ref, onMounted } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { loadFfmpegCore } from "../lib/ffmpegNetwork";
import {
  OUTPUT_FILE_NAME,
  RINGTONE_MIME_TYPE,
  buildFfmpegArgs,
  inputFileName,
  progressPercent,
  type ConvertParams,
  type WorkflowStep,
} from "../lib/ringtoneConversion";

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
      // Bind progress logger for initialization if available
      ffmpeg.on("log", ({ message }) => {
        // Look for load indicators or log initialization steps
        console.log("[FFmpeg Log]", message);
      });

      await loadFfmpegCore(ffmpeg);

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
      const inputName = inputFileName(file.name);

      // 1. Write the file to in-memory filesystem
      const fileData = await fetchFile(file);
      await ffmpeg.writeFile(inputName, fileData);

      // 2. Set up progress listener
      ffmpeg.on("progress", ({ progress }) => {
        conversionProgress.value = progressPercent(progress);
        conversionStatus.value = `Converting audio... ${conversionProgress.value}%`;
      });

      // 3. Run FFmpeg command
      conversionStatus.value = "Initializing transcoder...";
      await ffmpeg.exec(buildFfmpegArgs(params, inputName));

      // 4. Read output file from memory
      conversionStatus.value = "Finalizing ringtone...";
      const rawData = await ffmpeg.readFile(OUTPUT_FILE_NAME);
      const dataBuffer =
        typeof rawData === "string"
          ? new TextEncoder().encode(rawData)
          : rawData;

      // Clean up memory
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(OUTPUT_FILE_NAME);

      // 5. Create Downloadable Blob
      // .m4r is AAC audio in MP4 wrapper, standard MIME type is audio/mp4 or audio/x-m4r
      generatedRingtoneBlob.value = new Blob(
        [dataBuffer as unknown as BlobPart],
        { type: RINGTONE_MIME_TYPE },
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
