<script setup lang="ts">
import { computed } from 'vue';
import { NCheckbox } from 'naive-ui';

type CheckboxValue = boolean | number | string;
type CheckboxPair = {
  possibleValues: readonly [CheckboxValue, CheckboxValue];
  value: CheckboxValue;
};
const MISSING_PROP = '\u0000';

const model = defineModel<unknown>({ required: true });
const slots = defineSlots<{
  default?: () => unknown;
  meta?: () => unknown;
  actions?: () => unknown;
}>();
interface Props {
  id: string;
  label?: string;
  desc?: string;
  localePrefix?: string;
  inverseValues?: boolean;
  disabled?: boolean;
  // Default backing value used to infer mapping when model is null/undefined
  default?: CheckboxValue;
}
const props = withDefaults(defineProps<Props>(), {
  label: MISSING_PROP,
  desc: MISSING_PROP,
  localePrefix: 'missing-prefix',
  inverseValues: false,
  disabled: false,
  default: false,
});

// Always include the mandatory class on the wrapper; user-supplied class on the
// component itself will be merged by Vue onto the root element automatically.

// Map an arbitrary value into a boolean-pair representation if recognizable.
// Returns false when the provided value cannot be interpreted.
function mapToBoolRepresentation(value: unknown): CheckboxPair | false {
  if (value === true || value === false) return { possibleValues: [true, false], value };
  if (value === 1 || value === 0) return { possibleValues: [1, 0], value };

  const stringPairs = [
    ['true', 'false'],
    ['1', '0'],
    ['enabled', 'disabled'],
    ['enable', 'disable'],
    ['yes', 'no'],
    ['on', 'off'],
  ] as const satisfies ReadonlyArray<readonly [string, string]>;

  if (value === undefined || value === null) return false;
  const norm = String(value).toLowerCase().trim();
  for (const pair of stringPairs) {
    if (norm === pair[0] || norm === pair[1]) return { possibleValues: pair, value: norm };
  }
  return false;
}

// Determine the backing truthy/falsy values this checkbox should write to the model
const checkboxValues = computed(() => {
  // Prefer explicit model mapping
  const fromModel = mapToBoolRepresentation(model.value);
  if (fromModel) {
    const truthyIndex = props.inverseValues ? 1 : 0;
    const falsyIndex = props.inverseValues ? 0 : 1;
    return {
      truthy: fromModel.possibleValues[truthyIndex],
      falsy: fromModel.possibleValues[falsyIndex],
    };
  }
  // Fall back to provided default mapping
  const fromDefault = mapToBoolRepresentation(props.default);
  if (fromDefault) {
    const truthyIndex = props.inverseValues ? 1 : 0;
    const falsyIndex = props.inverseValues ? 0 : 1;
    return {
      truthy: fromDefault.possibleValues[truthyIndex],
      falsy: fromDefault.possibleValues[falsyIndex],
    };
  }
  // Final fallback is boolean mapping
  return { truthy: !props.inverseValues, falsy: !!props.inverseValues };
});

// Expose a real boolean for the UI, while mapping to the configured backend values
const isChecked = computed<boolean>({
  get() {
    const { truthy } = checkboxValues.value;
    const cur = model.value;
    // Treat undefined/null as default if provided
    const mapped = mapToBoolRepresentation(cur);
    if (mapped)
      return mapped.value === mapped.possibleValues[0]
        ? !props.inverseValues
        : !!props.inverseValues;

    // If model is not recognizable, try default to decide visual state
    const def = mapToBoolRepresentation(props.default);
    if (def)
      return def.value === def.possibleValues[0] ? !props.inverseValues : !!props.inverseValues;

    // Fallback: only true if equals our truthy literal
    return cur === truthy;
  },
  set(checked: boolean) {
    const { truthy, falsy } = checkboxValues.value;
    model.value = checked ? truthy : falsy;
  },
});

// For helper text showing what the default resolves to (enabled/disabled)
const parsedDefaultPropValue = (() => {
  const boolValues = mapToBoolRepresentation(props.default);
  if (boolValues) return boolValues.value === boolValues.possibleValues[0];
  return false;
})();

const labelField = props.label === MISSING_PROP ? `${props.localePrefix}.${props.id}` : props.label;
const descField =
  props.desc === MISSING_PROP ? `${props.localePrefix}.${props.id}_desc` : props.desc;
const showDesc = computed(() => props.desc !== '' || Boolean(slots['default']));
const showActions = computed(() => Boolean(slots['actions']));
const showMeta = computed(() => Boolean(slots['meta']));
const showDefValue = parsedDefaultPropValue !== false;
const defValue = parsedDefaultPropValue ? '_common.enabled_def_cbox' : '_common.disabled_def_cbox';
</script>

<template>
  <div :id="props.id" class="form-check">
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <div class="pt-0.5">
          <n-checkbox
            :id="`${props.id}_cb`"
            v-model:checked="isChecked"
            :disabled="props.disabled"
          />
        </div>
        <div class="min-w-0 flex-1 space-y-1">
          <label :for="`${props.id}_cb`" class="form-label cursor-pointer leading-snug">
            {{ $t(labelField) }}
          </label>
          <div v-if="showDesc" class="form-text mt-0">
            {{ $t(descField) }}
            <slot />
          </div>
          <div v-if="showDefValue" class="form-text mt-0">
            {{ $t(defValue) }}
          </div>
          <div v-if="showMeta" class="mt-1 text-[11px] opacity-60">
            <slot name="meta" />
          </div>
        </div>
      </div>
      <div v-if="showActions" class="shrink-0 pt-0.5">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
