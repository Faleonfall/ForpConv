import { ref, onMounted, onBeforeUnmount } from "vue";

// Object URL for a blob, revoked when the component unmounts
export function useObjectUrl(getBlob: () => Blob) {
  const url = ref("");

  onMounted(() => {
    url.value = URL.createObjectURL(getBlob());
  });

  onBeforeUnmount(() => {
    if (url.value) URL.revokeObjectURL(url.value);
  });

  return url;
}
