import { ref } from "vue";
import { validateMediaFile } from "../lib/fileValidation";

export function useFileUpload(onFileSelected: (file: File) => void) {
  const fileInput = ref<HTMLInputElement | null>(null);
  const isDragOver = ref(false);
  const errorMessage = ref("");

  const checkAndEmitFile = (file: File | undefined): void => {
    if (!file) return;

    const error = validateMediaFile(file);
    if (error) {
      errorMessage.value = error;
      return;
    }

    errorMessage.value = "";
    onFileSelected(file);
  };

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
    fileInput,
    isDragOver,
    errorMessage,
    triggerFileSelect,
    onDrop,
    onFileChange,
  };
}
