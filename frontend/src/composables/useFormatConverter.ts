import { ref } from "vue";
import { type FfmpegEngine } from "./useFfmpegEngine";
import { findTarget, type TargetFormat } from "../lib/formatCatalog";
import {
  buildConvertArgs,
  convertedFileName,
  outputFileName,
  type FormatChoice,
} from "../lib/formatConversion";
import { compressGif } from "../lib/gifCompress";
import { prepareEngineInput } from "../lib/heicDecode";
import { fileExtension, isHeicFile, mediaKindOf } from "../lib/mediaKind";

export type ConvertStep = "upload" | "pick" | "converting" | "download";

export function useFormatConverter(engine: FfmpegEngine) {
  const currentStep = ref<ConvertStep>("upload");

  const selectedFile = ref<File | null>(null);
  const convertedBlob = ref<Blob | null>(null);
  const convertedTarget = ref<TargetFormat | null>(null);
  const convertedName = ref("");
  // Null until a video's streams are read, or when they can't be
  const hasAudio = ref<boolean | null>(null);
  // Null until a video's or GIF's streams are read, or when they can't be
  const frameRate = ref<number | null>(null);

  const handleFileSelected = (file: File): void => {
    selectedFile.value = file;
    hasAudio.value = null;
    frameRate.value = null;
    currentStep.value = "pick";
    const isGif = fileExtension(file.name) === "gif";
    if (mediaKindOf(file) !== "video" && !isGif) return;
    void engine.probeStreams(file).then((streams) => {
      // A later pick wins over a slow probe
      if (selectedFile.value !== file) return;
      hasAudio.value = streams.hasAudio;
      frameRate.value = streams.frameRate;
    });
  };

  // The lossy pass is a bonus, a failure keeps the GIF FFmpeg made
  const shrinkResult = async (blob: Blob): Promise<Blob> => {
    engine.progress.value = 99;
    engine.status.value = "Shrinking GIF...";
    try {
      return await compressGif(blob);
    } catch (error) {
      console.error("GIF compression failed:", error);
      return blob;
    }
  };

  const handleConversion = async (choice: FormatChoice): Promise<void> => {
    const file = selectedFile.value;
    const target = findTarget(choice.targetId);
    if (!file || !target) return;

    currentStep.value = "converting";
    engine.progress.value = 0;

    try {
      if (isHeicFile(file)) engine.status.value = "Decoding HEIC photo...";
      const input = await prepareEngineInput(file);

      const blob = await engine.run({
        input: input.blob,
        inputName: input.name,
        args: buildConvertArgs(
          target,
          choice.qualityId,
          input.name,
          choice.clip,
          choice.widthId,
        ),
        outputName: outputFileName(target),
        mime: target.mime,
        progressLabel: "Converting...",
        outputSeconds: choice.clip ? choice.clip.end - choice.clip.start : null,
        readsFirst: target.extension === "gif",
      });
      convertedBlob.value =
        choice.lossy && target.lossyCompression
          ? await shrinkResult(blob)
          : blob;
      convertedTarget.value = target;
      convertedName.value = convertedFileName(file.name, target);
      currentStep.value = "download";
    } catch (error) {
      console.error("Conversion failed:", error);
      engine.status.value =
        "Conversion failed. This file may not convert to that format.";
      setTimeout(() => {
        currentStep.value = "pick";
      }, 4000);
    }
  };

  const handleCancel = (): void => {
    selectedFile.value = null;
    currentStep.value = "upload";
  };

  const handleReset = (): void => {
    selectedFile.value = null;
    convertedBlob.value = null;
    convertedTarget.value = null;
    convertedName.value = "";
    currentStep.value = "upload";
  };

  return {
    currentStep,
    selectedFile,
    convertedBlob,
    convertedTarget,
    convertedName,
    hasAudio,
    frameRate,
    handleFileSelected,
    handleConversion,
    handleCancel,
    handleReset,
  };
}
