<script setup lang="ts">
defineOptions({ inheritAttrs: false });

import { computed, ref, useAttrs, watch, type PropType } from 'vue';
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
  size: {
    type: String as PropType<'small' | 'medium' | 'large'>,
    default: 'medium',
  },
  min: { type: Number, default: 0 },
  max: { type: Number, default: undefined },
});

const hoursPart = ref<Nullable<number>>(null);
const minutesPart = ref<Nullable<number>>(null);
const secondsPart = ref<Nullable<number>>(null);

function sanitizePart(value: Nullable<number>, max?: number): Nullable<number> {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const normalized = Math.max(0, Math.floor(value));
  return max !== undefined ? Math.min(max, normalized) : normalized;
}

function clampTotalSeconds(value: number): number {
  const withMin = props.min !== undefined ? Math.max(props.min, value) : value;
  return props.max !== undefined ? Math.min(props.max, withMin) : withMin;
}

function syncFromModel(value: Nullable<number>) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    hoursPart.value = null;
    minutesPart.value = null;
    secondsPart.value = null;
    return;
  }

  const totalSeconds = Math.max(0, Math.floor(value));
  hoursPart.value = Math.floor(totalSeconds / 3600);
  minutesPart.value = Math.floor((totalSeconds % 3600) / 60);
  secondsPart.value = totalSeconds % 60;
}

watch(
  () => model.value,
  (value) => syncFromModel(value),
  { immediate: true },
);

function updateDurationPart(part: 'hours' | 'minutes' | 'seconds', value: Nullable<number>) {
  const normalized = sanitizePart(value, part === 'hours' ? undefined : 59);
  if (part === 'hours') hoursPart.value = normalized;
  else if (part === 'minutes') minutesPart.value = normalized;
  else secondsPart.value = normalized;

  if (hoursPart.value === null && minutesPart.value === null && secondsPart.value === null) {
    model.value = null;
    return;
  }

  const totalSeconds =
    (hoursPart.value ?? 0) * 3600 + (minutesPart.value ?? 0) * 60 + (secondsPart.value ?? 0);
  model.value = clampTotalSeconds(totalSeconds);
  syncFromModel(model.value);
}

const durationSummary = computed(() => {
  if (model.value === null || model.value === undefined || !Number.isFinite(model.value)) {
    return 'Stored as seconds.';
  }

  const totalSeconds = Math.max(0, Math.floor(model.value));
  const parts: string[] = [];
  if (hoursPart.value) parts.push(`${hoursPart.value}h`);
  if (minutesPart.value) parts.push(`${minutesPart.value}m`);
  if (secondsPart.value || parts.length === 0) parts.push(`${secondsPart.value ?? 0}s`);
  return `${parts.join(' ')} (${totalSeconds} seconds)`;
});
</script>

<template>
  <ConfigFieldShell
    :id="`${props.id}-hours`"
    :label="props.label"
    :desc="props.desc"
    v-bind="attrs"
  >
    <template #actions><slot name="actions" /></template>
    <template #control>
      <div class="grid grid-cols-3 gap-2">
        <div class="space-y-1">
          <div class="text-[11px] font-medium uppercase tracking-wide opacity-60">Hours</div>
          <n-input-number
            :id="`${props.id}-hours`"
            :value="hoursPart"
            :size="props.size"
            :min="0"
            :precision="0"
            :show-button="false"
            placeholder="0"
            class="w-full"
            @update:value="(value) => updateDurationPart('hours', value)"
          />
        </div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium uppercase tracking-wide opacity-60">Minutes</div>
          <n-input-number
            :id="`${props.id}-minutes`"
            :value="minutesPart"
            :size="props.size"
            :min="0"
            :max="59"
            :precision="0"
            :show-button="false"
            placeholder="0"
            class="w-full"
            @update:value="(value) => updateDurationPart('minutes', value)"
          />
        </div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium uppercase tracking-wide opacity-60">Seconds</div>
          <n-input-number
            :id="`${props.id}-seconds`"
            :value="secondsPart"
            :size="props.size"
            :min="0"
            :max="59"
            :precision="0"
            :show-button="false"
            placeholder="0"
            class="w-full"
            @update:value="(value) => updateDurationPart('seconds', value)"
          />
        </div>
      </div>
    </template>
    <template #meta>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{{ durationSummary }}</span>
        <slot name="meta" />
      </div>
    </template>
    <slot />
  </ConfigFieldShell>
</template>
