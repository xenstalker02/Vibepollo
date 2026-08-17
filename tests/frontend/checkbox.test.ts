import { mount } from '@vue/test-utils';
import Checkbox from '@web/Checkbox.vue';

describe('Checkbox.vue', () => {
  type CheckboxValue = boolean | number | string;
  type CheckboxProps = {
    inverseValues?: boolean;
    default?: CheckboxValue;
  };

  const mountWith = (model: CheckboxValue, props: CheckboxProps = {}) =>
    mount(Checkbox, {
      props: { id: 'flag', localePrefix: 'playnite', label: 'Label', modelValue: model, ...props },
      global: { mocks: { $t: (k: string) => k } },
    });

  test('maps boolean model to true/false values', async () => {
    const w = mountWith(true);
    const checkbox = w.get('[role="checkbox"]');
    expect(checkbox.attributes('aria-checked')).toBe('true');
    await checkbox.trigger('click');
    expect(w.emitted()['update:modelValue'][0][0]).toBe(false);
  });

  test('maps string "enabled/disabled" and respects inverseValues', async () => {
    const w = mountWith('enabled', { inverseValues: true });
    const checkbox = w.get('.n-checkbox');
    // inverseValues flips truthy/falsy mapping; enabled becomes falsy
    expect(checkbox.attributes('aria-checked')).toBe('false');
    await checkbox.trigger('click');
    // when checked, model updates to mapped truthy (which is original falsy due to inverse)
    expect(w.emitted()['update:modelValue'][0][0]).toBe('disabled');
  });

  test('numeric 1/0 mapping works', async () => {
    const w = mountWith(1);
    const checkbox = w.get('[role="checkbox"]');
    expect(checkbox.attributes('aria-checked')).toBe('true');
    await checkbox.trigger('click');
    expect(w.emitted()['update:modelValue'][0][0]).toBe(0);
  });

  test('shows default value hint based on `default` prop', () => {
    const w = mountWith(true, { default: 'enabled' });
    expect(w.text()).toContain('_common.enabled_def_cbox');
  });
});
