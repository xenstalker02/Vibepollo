import { getConfigFieldDefinition } from '@web/configs/configFieldSchema';

const baseContext = {
  t: (key: string) => key,
  platform: 'windows',
  metadata: {},
};

describe('configFieldSchema', () => {
  test.each([0, 1, '0', '1'])(
    'keeps back_button_timeout as a number field for %p',
    (currentValue) => {
      const field = getConfigFieldDefinition('back_button_timeout', {
        ...baseContext,
        currentValue,
        defaultValue: -1,
      });

      expect(field.kind).toBe('number');
    },
  );

  test.each([0, 1])(
    'infers checkbox fields from boolean-like numeric values when not overridden: %p',
    (currentValue) => {
      const field = getConfigFieldDefinition('custom_toggle', {
        ...baseContext,
        currentValue,
      });

      expect(field.kind).toBe('checkbox');
    },
  );

  test('omits optional metadata when a plain input has none', () => {
    const field = getConfigFieldDefinition('custom_text', {
      ...baseContext,
      currentValue: 'value',
    });

    expect('placeholder' in field).toBe(false);
    expect('durationUnit' in field).toBe(false);
  });
});
