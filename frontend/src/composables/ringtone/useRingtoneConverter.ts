import { ref } from "vue";
import { type FfmpegEngine } from "../engine/useFfmpegEngine";
import {
  OUTPUT_FILE_NAME,
  RINGTONE_MIME_TYPE,
  buildFfmpegArgs,
  type ConvertParams,
  type WorkflowStep,
} from "../../lib/ringtone/ringtoneConversion";
import { inputFileName } from "../../lib/shared/fileName";
import {
  SILENT_VIDEO_MESSAGE,
  UPLOAD_ERROR_MS,
} from "../../lib/shared/fileValidation";
import { mediaKindOf } from "../../lib/shared/mediaKind";

export function useRingtoneConverter(engine: FfmpegEngine) {
  const currentStep = ref<WorkflowStep>("upload");
  // The last run stopped on an error and waits on the converting step
  const failed = ref(false);

  // Active states
  const selectedFile = ref<File | null>(null);
  const generatedRingtoneBlob = ref<Blob | null>(null);
  const ringtoneTitle = ref("");
  // Shown on the upload card when a pick can't become a ringtone
  const uploadError = ref("");

  // Bumped per pick, so a slow probe of an earlier file is ignored
  let pickCount = 0;
  let errorTimer: ReturnType<typeof setTimeout> | undefined;

  const clearUploadError = (): void => {
    clearTimeout(errorTimer);
    uploadError.value = "";
  };

  const showUploadError = (message: string): void => {
    clearUploadError();
    uploadError.value = message;
    errorTimer = setTimeout(clearUploadError, UPLOAD_ERROR_MS);
  };

  // A video without sound has nothing to ring, so it never reaches the trim
  const handleFileSelected = async (file: File): Promise<void> => {
    const pick = ++pickCount;
    clearUploadError();
    const isSilent =
      mediaKindOf(file) === "video" &&
      (await engine.probeStreams(file)).hasAudio === false;
    if (pick !== pickCount) return;
    if (isSilent) {
      showUploadError(SILENT_VIDEO_MESSAGE);
      return;
    }
    selectedFile.value = file;
    currentStep.value = "trim";
  };

  const handleConversion = async (params: ConvertParams): Promise<void> => {
    if (!selectedFile.value) return;

    currentStep.value = "converting";
    failed.value = false;
    ringtoneTitle.value = params.title;

    try {
      const file = selectedFile.value;
      const inputName = inputFileName(file.name);

      // .m4r is AAC audio in MP4 wrapper, standard MIME type is audio/mp4 or audio/x-m4r
      generatedRingtoneBlob.value = await engine.run({
        input: file,
        inputName,
        args: buildFfmpegArgs(params, inputName),
        outputName: OUTPUT_FILE_NAME,
        mime: RINGTONE_MIME_TYPE,
        progressLabel: "Converting audio...",
        outputSeconds: params.endTime - params.startTime,
        readsFirst: false,
      });
      currentStep.value = "download";
    } catch (error) {
      console.error("Transcoding failed:", error);
      engine.status.value = "Please check the file and try again.";
      failed.value = true;
    }
  };

  // Leaves a failed run with the file and trim still in place
  const handleBack = (): void => {
    failed.value = false;
    currentStep.value = "trim";
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
    uploadError,
    clearUploadError,
    handleFileSelected,
    handleConversion,
    handleCancel,
    handleReset,
    handleBack,
    failed,
  };
}
