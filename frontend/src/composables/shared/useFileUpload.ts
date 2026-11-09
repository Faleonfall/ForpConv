import { onBeforeUnmount, ref, useTemplateRef } from "vue";
import {
  UPLOAD_ERROR_MS,
  validateMediaFile,
} from "../../lib/shared/fileValidation";
import { type MediaKind } from "../../lib/shared/mediaKind";

export function useFileUpload(
  getKinds: () => MediaKind[],
  onFileSelected: (file: File) => void,
) {
  const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
  const isDragOver = ref(false);
  const errorMessage = ref("");

  let errorTimer: ReturnType<typeof setTimeout> | undefined;

  const clearError = (): void => {
    clearTimeout(errorTimer);
    errorMessage.value = "";
  };

  const checkAndEmitFile = (file: File | undefined): void => {
    if (!file) return;

    clearError();
    const error = validateMediaFile(file, getKinds());
    if (error) {
      errorMessage.value = error;
      errorTimer = setTimeout(clearError, UPLOAD_ERROR_MS);
      return;
    }

    onFileSelected(file);
  };

  onBeforeUnmount(() => clearTimeout(errorTimer));

  const triggerFileSelect = (): void => {
    fileInput.value?.click();
  };

  const onDrop = (event: DragEvent): void => {
    isDragOver.value = false;
    checkAndEmitFile(event.dataTransfer?.files[0]);
  };

  const onFileChange = (event: Event): void => {
    checkAndEmitFile((event.target as HTMLInputElement).files?.[0]);
  };

  return {
    isDragOver,
    errorMessage,
    triggerFileSelect,
    onDrop,
    onFileChange,
  };
}
