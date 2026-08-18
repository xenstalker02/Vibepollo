import tailwindConfig from '@web/tailwind.config';

describe('Tailwind config', () => {
  test('loads the strict typed config with the expected scan and plugin settings', () => {
    expect(tailwindConfig.darkMode).toBe('class');
    expect(tailwindConfig.content).toEqual([
      './index.html',
      './*.{vue,js,ts,html}',
      './components/**/*.{vue,js,ts}',
      './views/**/*.{vue,js,ts}',
      './configs/**/*.{vue,js,ts}',
      './stores/**/*.{js,ts}',
    ]);
    expect(tailwindConfig.corePlugins).toEqual({
      preflight: true,
      visibility: false,
    });
  });

  test('preserves representative light and dark semantic tokens', () => {
    expect(tailwindConfig.theme.extend.semanticColors.light).toMatchObject({
      primary: '253 184 19',
      surface: '255 248 225',
      brand: '217 119 6',
    });
    expect(tailwindConfig.theme.extend.semanticColors.dark).toMatchObject({
      primary: '99 102 241',
      dark: '6 10 24',
      brand: '165 180 252',
    });
  });
});
