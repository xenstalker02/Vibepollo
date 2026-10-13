import { primitiveText } from '@web/utils/primitiveText';

describe('scalar wire display', () => {
  test('preserves scalar and flat-list representations', () => {
    expect(primitiveText('  value  ')).toBe('  value  ');
    expect(primitiveText(60)).toBe('60');
    expect(primitiveText(false)).toBe('false');
    expect(primitiveText(['one', 2, true, null])).toBe('one,2,true,');
    expect(primitiveText(undefined, 'missing')).toBe('missing');
  });

  test('does not call object coercion hooks or recurse into cyclic data', () => {
    const object = { toString: vi.fn(() => 'unsafe') };
    expect(primitiveText(object, 'invalid')).toBe('invalid');
    expect(object.toString).not.toHaveBeenCalled();
    const cycle: unknown[] = [];
    cycle.push(cycle);
    expect(primitiveText(cycle, 'invalid')).toBe('invalid');
    expect(primitiveText([object], 'invalid')).toBe('invalid');
  });
});
