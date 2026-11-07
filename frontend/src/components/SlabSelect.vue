<script setup lang="ts">
import { useId } from "vue";
import { useSlabSelect } from "../composables/useSlabSelect";
import { type SlabOption } from "../lib/slabSelect";

const props = defineProps<{
  label: string;
  options: SlabOption[];
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", id: string): void;
}>();

const {
  isOpen,
  flowColumns,
  activeId,
  groups,
  hasGroups,
  picked,
  toggle,
  choose,
  hover,
  handleCellKeydown,
  handlePanelKeydown,
} = useSlabSelect(
  () => props.options,
  () => props.modelValue,
  (id) => emit("update:modelValue", id),
);
// Option ids repeat across pickers, so each panel prefixes its own
const uid = useId();
</script>

<template>
  <div
    ref="slabRoot"
    class="slab-select"
    :class="{ 'slab-select-open': isOpen }"
  >
    <button
      type="button"
      class="slab-cell"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-label="`${label}: ${picked?.label ?? ''}`"
      @click="toggle"
      @keydown="handleCellKeydown"
    >
      <span class="slab-cell-inner">
        <span class="slab-cell-label">{{ label }}</span>
        <!-- Keyed so every pick slams a fresh slab in -->
        <span :key="picked?.id" class="slab">
          <span class="slab-text">{{ picked?.label }}</span>
        </span>
      </span>
    </button>

    <Transition name="slab-panel">
      <div
        v-if="isOpen"
        ref="slabPanel"
        class="slab-panel"
        :class="hasGroups ? 'slab-panel-wide' : 'slab-panel-flow'"
        role="listbox"
        tabindex="-1"
        :aria-label="label"
        :aria-activedescendant="`${uid}-${activeId}`"
        @keydown="handlePanelKeydown"
      >
        <div class="slab-panel-inner">
          <div
            v-for="group in groups"
            :key="group.name"
            class="slab-group"
            :style="{ '--slab-columns': flowColumns }"
          >
            <div v-if="hasGroups" class="slab-group-name">{{ group.name }}</div>
            <div
              v-for="option in group.options"
              :id="`${uid}-${option.id}`"
              :key="option.id"
              class="slab-option"
              :class="{
                'slab-option-picked': option.id === picked?.id,
                'slab-option-active': option.id === activeId,
              }"
              role="option"
              :aria-selected="option.id === picked?.id"
              @click="choose(option.id)"
              @pointermove="hover(option.id)"
            >
              {{ option.label }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
