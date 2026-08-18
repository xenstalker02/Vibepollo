<script setup lang="ts">
defineOptions({ inheritAttrs: false });

import { computed, useAttrs, type PropType } from 'vue';
import { NInputNumber } from 'naive-ui';
import ConfigFieldShell from './ConfigFieldShell.vue';

const nullValue = () => null;
type Nullable<T> = T | ReturnType<typeof nullValue>;

const model = defineModel<Nullable<number>>({ required: true });
const attrs = useAttrs();

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  desc: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  size: {
    type: String as PropType<'small' | 'medium' | 'large'>,
    default: 'medium',
  },
  min: { type: Number, default: undefined },
  max: { type: Number, default: undefined },
  step: { type: Number, default: undefined },
  precision: { type: Number, default: undefined },
});

const numberProps = computed(() => ({
  ...(props.min !== undefined ? { min: props.min } : {}),
  ...(props.max !== undefined ? { max: props.max } : {}),
  ...(props.step !== undefined ? { step: props.step } : {}),
  ...(props.precision !== undefined ? { precision: props.precision } : {}),
}));
const mergedNumberProps = computed(() => ({
  ...numberProps.value,
  ...attrs,
}));
</script>

<template>
  <ConfigFieldShell :id="props.id" :label="props.label" :desc="props.desc">
    <template #actions><slot name="actions" /></template>
    <template #control>
      <n-input-number
        :id="props.id"
        v-model:value="model"
        :size="props.size"
        :placeholder="props.placeholder"
        v-bind="mergedNumberProps"
      />
    </template>
    <template #meta><slot name="meta" /></template>
    <slot />
  </ConfigFieldShell>
</template>
