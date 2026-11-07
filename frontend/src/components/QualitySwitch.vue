<script setup lang="ts">
import { ref, useId } from "vue";

defineProps<{ modelValue: boolean }>();

const emit = defineEmits<{
  (e: "update:modelValue", smaller: boolean): void;
}>();

const name = useId();
// The drop only stretches on a real switch, not on first paint
const hasMoved = ref(false);

const choose = (smaller: boolean): void => {
  hasMoved.value = true;
  emit("update:modelValue", smaller);
};
</script>

<template>
  <div
    class="quality-switch"
    :class="{
      'quality-switch-smaller': modelValue,
      'quality-switch-moved': hasMoved,
    }"
    role="radiogroup"
    aria-label="Output size"
    title="Smaller runs a lossy pass that adds slight noise"
  >
    <span class="quality-switch-drop" aria-hidden="true"></span>
    <label class="quality-switch-option">
      <input
        type="radio"
        class="quality-switch-input"
        :name="name"
        :checked="!modelValue"
        @change="choose(false)"
      />
      <span class="quality-switch-text">Best</span>
    </label>
    <label class="quality-switch-option">
      <input
        type="radio"
        class="quality-switch-input"
        :name="name"
        :checked="modelValue"
        @change="choose(true)"
      />
      <span class="quality-switch-text">Smaller</span>
    </label>
  </div>
</template>
