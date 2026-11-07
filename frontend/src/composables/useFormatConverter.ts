import { ref } from "vue";
import { type FfmpegEngine } from "./useFfmpegEngine";
import { findTarget, type TargetFormat } from "../lib/formatCatalog";
import {
  buildConvertArgs,
  convertedFileName,
  outputFileName,
  TIMELINE_NAME,
  timelineArgs,
  type FormatChoice,
} from "../lib/formatConversion";
import { inputFileName } from "../lib/ringtoneConversion";
import { compressGif } from "../lib/gifCompress";
import { prepareEngineInput } from "../lib/heicDecode";
import { fileExtension, isHeicFile, mediaKindOf } from "../lib/mediaKind";

export type ConvertStep = "upload" | "pick" | "converting" | "download";

export function useFormatConverter(engine: FfmpegEngine) {
  const currentStep = ref<ConvertStep>("upload");
  // The last run stopped on an error and waits on the converting step
  const failed = ref(false);

  const selectedFile = ref<File | null>(null);
  const convertedBlob = ref<Blob | null>(null);
  const convertedTarget = ref<TargetFormat | null>(null);
  const convertedName = ref("");
  // Null until a video's streams are read, or when they can't be
  const hasAudio = ref<boolean | null>(null);
  // Null until a video's or GIF's streams are read, or when they can't be
  const frameRate = ref<number | null>(null);
  // Playable copy of a GIF for the trim timeline, null until it's made
  const timelineFile = ref<File | null>(null);
  const isPreparingTimeline = ref(false);
  // Pending stream reads and the timeline render, a conversion waits for it
  // so two FFmpeg jobs never share the engine
  let pendingPrep: Promise<void> = Promise.resolve();

  // FFmpeg reads the GIF once into a video the browser can seek
  const prepareTimeline = async (file: File): Promise<void> => {
    try {
      const inputName = inputFileName(file.name);
      const blob = await engine.run({
        input: file,
        inputName,
        args: timelineArgs(inputName),
        outputName: TIMELINE_NAME,
        mime: "video/mp4",
        progressLabel: "Preparing timeline...",
        outputSeconds: null,
        readsFirst: false,
      });
      if (selectedFile.value !== file) return;
      timelineFile.value = new File([blob], TIMELINE_NAME, {
        type: "video/mp4",
      });
    } catch (error) {
      console.error("GIF timeline failed:", error);
    } finally {
      if (selectedFile.value === file) isPreparingTimeline.value = false;
    }
  };

  const inspectFile = async (file: File, isGif: boolean): Promise<void> => {
    const streams = await engine.probeStreams(file);
    // A later pick wins over a slow probe
    if (selectedFile.value !== file) return;
    hasAudio.value = streams.hasAudio;
    frameRate.value = streams.frameRate;
    if (isGif) await prepareTimeline(file);
  };

  const handleFileSelected = (file: File): void => {
    selectedFile.value = file;
    hasAudio.value = null;
    frameRate.value = null;
    timelineFile.value = null;
    currentStep.value = "pick";
    const isGif = fileExtension(file.name) === "gif";
    isPreparingTimeline.value = isGif;
    if (mediaKindOf(file) !== "video" && !isGif) return;
    pendingPrep = pendingPrep.then(() => inspectFile(file, isGif));
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
    failed.value = false;
    engine.progress.value = 0;

    try {
      await pendingPrep;
      engine.progress.value = 0;
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
          choice.frameTime,
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
      engine.status.value = "This file may not convert to that format.";
      failed.value = true;
    }
  };

  // Leaves a failed run with the file and picks still in place
  const handleBack = (): void => {
    failed.value = false;
    currentStep.value = "pick";
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
    timelineFile,
    isPreparingTimeline,
    handleFileSelected,
    handleConversion,
    handleCancel,
    handleReset,
    handleBack,
    failed,
  };
}
