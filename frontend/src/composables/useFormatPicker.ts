import { computed, ref, watch } from "vue";
import { type ClipRange } from "../lib/clipRange";
import { type SlabOption } from "../lib/slabSelect";
import {
  defaultQualityFor,
  defaultTargetFor,
  findTarget,
  isStillImage,
  qualitiesFor,
  targetGroupsFor,
} from "../lib/formatCatalog";
import {
  estimateOutputBytes,
  sizeEstimateLabel,
  type FormatChoice,
} from "../lib/formatConversion";
import { fileExtension, mediaKindOf } from "../lib/mediaKind";
import { useObjectUrl } from "./useObjectUrl";

export function useFormatPicker(
  getFile: () => File,
  getHasAudio: () => boolean | null,
  getFrameRate: () => number | null,
  getTimelineFile: () => File | null,
  onConvert: (choice: FormatChoice) => void,
) {
  const kind = computed(() => mediaKindOf(getFile()) ?? "audio");
  const extension = computed(() => fileExtension(getFile().name));
  // Audio targets stay until a probe finds the video silent
  const groups = computed(() =>
    targetGroupsFor(kind.value, extension.value, getHasAudio() !== false),
  );
  // One list for the select, each target tagged with its column when there
  // are several groups to tell apart
  const formatOptions = computed<SlabOption[]>(() =>
    groups.value.flatMap((group) =>
      group.targets.map((option) => ({
        id: option.id,
        label: option.label,
        ...(groups.value.length > 1 && { group: group.label }),
      })),
    ),
  );
  const targetId = ref(defaultTargetFor(kind.value, extension.value)?.id ?? "");
  const target = computed(() => findTarget(targetId.value));
  const qualities = computed(() =>
    target.value ? qualitiesFor(target.value, getFrameRate()) : [],
  );
  const defaultQualityId = computed(() =>
    target.value ? defaultQualityFor(target.value, getFrameRate()) : "",
  );
  const qualityId = ref(defaultQualityId.value);
  const qualityLabel = computed(() => target.value?.qualityLabel ?? "Quality");
  const widths = computed(() => target.value?.widths ?? []);
  const widthId = ref(target.value?.defaultWidthId ?? "");
  const canCompress = computed(() => target.value?.lossyCompression === true);
  // Off by default, the best quality comes first
  const lossy = ref(false);
  // Audio and video play as they are, a GIF through its playable copy once
  // FFmpeg made it, other images have no timeline
  const timelineFile = computed(() =>
    kind.value === "image" ? getTimelineFile() : getFile(),
  );
  const canTrim = computed(() => timelineFile.value !== null);
  const isAnimatedSource = computed(() => extension.value === "gif");
  // Images get a plain preview until then, a GIF animates in it by itself
  const imageUrl = useObjectUrl(getFile);
  const imageFailed = ref(false);
  const clip = ref<ClipRange | null>(null);
  const frameTime = ref<number | null>(null);
  const clipSeconds = ref<number | null>(null);
  const sizeEstimate = computed(() =>
    target.value
      ? sizeEstimateLabel(
          estimateOutputBytes(target.value, qualityId.value, clipSeconds.value),
        )
      : "",
  );

  // Each format has its own quality scale, so start from its default
  watch(target, (next) => {
    qualityId.value = defaultQualityId.value;
    widthId.value = next?.defaultWidthId ?? "";
  });

  // The probe reports the frame rate after the picker shows
  watch(getFrameRate, () => {
    qualityId.value = defaultQualityId.value;
  });

  // An audio pick made before the probe finished no longer exists
  watch(groups, (next) => {
    const offered = next.some((group) =>
      group.targets.some((option) => option.id === targetId.value),
    );
    if (!offered) {
      targetId.value = defaultTargetFor(kind.value, extension.value)?.id ?? "";
    }
  });

  const handleClipChange = (next: ClipRange | null): void => {
    clip.value = next;
  };

  const handleClipLength = (seconds: number | null): void => {
    clipSeconds.value = seconds;
  };

  const handleFrame = (time: number): void => {
    frameTime.value = time;
  };

  // Some browsers can't show HEIC, the picker works without the picture
  const handleImageError = (): void => {
    imageFailed.value = true;
  };

  const handleConvert = (): void => {
    if (!target.value) return;
    onConvert({
      targetId: targetId.value,
      qualityId: qualityId.value,
      widthId: widthId.value,
      lossy: canCompress.value && lossy.value,
      clip: canTrim.value ? clip.value : null,
      frameTime:
        canTrim.value && isStillImage(target.value) ? frameTime.value : null,
    });
  };

  return {
    kind,
    groups,
    formatOptions,
    targetId,
    target,
    qualities,
    qualityId,
    qualityLabel,
    widths,
    widthId,
    canCompress,
    lossy,
    timelineFile,
    canTrim,
    isAnimatedSource,
    imageUrl,
    imageFailed,
    sizeEstimate,
    handleClipChange,
    handleClipLength,
    handleFrame,
    handleImageError,
    handleConvert,
  };
}
