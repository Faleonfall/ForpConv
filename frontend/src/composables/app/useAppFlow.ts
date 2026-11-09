import { computed, watch, type Ref } from "vue";
import { type FfmpegEngine } from "../engine/useFfmpegEngine";
import { useFormatConverter } from "../convert/useFormatConverter";
import { useLeaveWarning } from "./useLeaveWarning";
import { useRingtoneConverter } from "../ringtone/useRingtoneConverter";
import { MODE_COPY, canGoHome, type AppMode } from "../../lib/app/appMode";
import { ringtoneFileName } from "../../lib/ringtone/ringtoneConversion";

// Both flows share one engine, the tab picks which one the page shows
export function useAppFlow(mode: Ref<AppMode>, engine: FfmpegEngine) {
  const ringtone = useRingtoneConverter(engine);
  const converter = useFormatConverter(engine);

  const copy = computed(() => MODE_COPY[mode.value]);
  const activeFlow = computed(() =>
    mode.value === "ringtone" ? ringtone : converter,
  );
  const step = computed(() => activeFlow.value.currentStep.value);
  const flowFailed = computed(() => activeFlow.value.failed.value);
  const progressTitle = computed(() =>
    flowFailed.value ? copy.value.failedTitle : copy.value.progressTitle,
  );
  // Only the ringtone flow rejects files after the picker let them through
  const uploadRejection = computed(() =>
    mode.value === "ringtone" ? ringtone.uploadError.value : "",
  );
  const ringtoneName = computed(() =>
    ringtoneFileName(ringtone.ringtoneTitle.value),
  );

  // Either tab past its upload holds a file a reload would drop
  useLeaveWarning(
    () =>
      ringtone.currentStep.value !== "upload" ||
      converter.currentStep.value !== "upload",
  );

  // A rejection belongs to the pick that caused it, not to the next visit
  watch(mode, () => ringtone.clearUploadError());

  const handleFileSelected = (file: File): void => {
    void activeFlow.value.handleFileSelected(file);
  };

  const handleBack = (): void => {
    activeFlow.value.handleBack();
  };

  const handleHome = (): void => {
    const flow = activeFlow.value;
    if (canGoHome(flow.currentStep.value, flow.failed.value)) {
      flow.handleReset();
    }
  };

  return {
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
  };
}
