import { computed, ref, watch } from "vue";
import { joinFileName, splitFileName } from "../lib/fileName";

// Editable name of a result, the extension stays fixed to its format
export function useFileRename(getFileName: () => string) {
  const parts = computed(() => splitFileName(getFileName()));
  const baseName = ref(parts.value.base);
  const extension = computed(() => parts.value.extension);
  const downloadName = computed(() =>
    joinFileName(baseName.value, extension.value),
  );

  // A new result starts from its own suggested name
  watch(parts, (next) => {
    baseName.value = next.base;
  });

  return { baseName, extension, downloadName };
}
