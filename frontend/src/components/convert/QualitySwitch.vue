<script setup lang="ts">
import { useId } from "vue";
import { useDropSwitch } from "../../composables/shared/useDropSwitch";

const props = defineProps<{ modelValue: boolean }>();

const emit = defineEmits<{
  (e: "update:modelValue", smaller: boolean): void;
}>();

const name = useId();
const { hasMoved } = useDropSwitch(() => props.modelValue);
</script>

<template>
  <div
    class="drop-switch quality-switch"
    :class="{
      'drop-switch-end': modelValue,
      'drop-switch-moved': hasMoved,
    }"
    role="radiogroup"
    aria-label="Output size"
    title="Smaller runs a lossy pass that adds slight noise"
  >
    <span
      class="drop-switch-drop quality-switch-drop"
      aria-hidden="true"
    ></span>
    <label class="quality-switch-option">
      <input
        type="radio"
        class="quality-switch-input"
        :name="name"
        :checked="!modelValue"
        @change="emit('update:modelValue', false)"
      />
      <span class="quality-switch-text">Best</span>
    </label>
    <label class="quality-switch-option">
      <input
        type="radio"
        class="quality-switch-input"
        :name="name"
        :checked="modelValue"
        @change="emit('update:modelValue', true)"
      />
      <span class="quality-switch-text">Smaller</span>
    </label>
  </div>
</template>
