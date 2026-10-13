import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import type { UndefinedValue } from '../utils/wireAbsence';

type SnapshotValue = string | number[];
type ProbeSnapshot = Record<string, Record<string, SnapshotValue>>;
type ThemeSnapshot = Record<string, ProbeSnapshot>;
const sourceCommit = '83588c4687bba4a5d3f5fd83d454c7256e97f032';
const baselineHash = 'fbda8a1c8a6a56fdc3915777df1f3debcc181cdbc64532580eead72df17cb5e1';
const baselinePath = new URL('../../../../../tests/fixtures/theme-v3.css', import.meta.url);
const baselineCss = await readFile(baselinePath, 'utf8');
assert.equal(
  createHash('sha256').update(baselineCss).digest('hex'),
  baselineHash,
  'Baseline CSS source changed',
);

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isColor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((channel: unknown) => typeof channel === 'number' && Number.isFinite(channel))
  );
}

function parseContract(text: string): ThemeSnapshot {
  const raw: unknown = JSON.parse(text);
  assert.ok(isRecord(raw) && isRecord(raw['results']), 'Invalid theme contract');
  assert.equal(raw['sourceCommit'], sourceCommit, 'Unexpected baseline source commit');
  assert.equal(raw['cssSha256'], baselineHash, 'Unexpected baseline CSS hash');
  const results: ThemeSnapshot = {};
  for (const [scenario, probes] of Object.entries(raw['results'])) {
    assert.ok(isRecord(probes), 'Invalid theme scenario');
    const parsedProbes: ProbeSnapshot = {};
    for (const [probe, properties] of Object.entries(probes)) {
      assert.ok(isRecord(properties), 'Invalid theme probe');
      const parsedProperties: Record<string, SnapshotValue> = {};
      for (const [property, value] of Object.entries(properties)) {
        assert.ok(typeof value === 'string' || isColor(value), 'Invalid theme property');
        parsedProperties[property] = value;
      }
      parsedProbes[probe] = parsedProperties;
    }
    results[scenario] = parsedProbes;
  }
  return results;
}

const assetDir = new URL('../../../../../build/assets/web/assets/', import.meta.url);
const contractPath =
  argument('--contract') ??
  new URL(
    '../../../../../tests/fixtures/theme-contract-v3-semantic-interactions.json',
    import.meta.url,
  );
const expected = process.argv.includes('--record')
  ? undefined
  : parseContract(await readFile(contractPath, 'utf8'));
const builtHtml = await readFile(new URL('../index.html', assetDir), 'utf8');
const cssFiles: string[] = [];
for (const [tag] of builtHtml.matchAll(/<link\b[^>]*>/g)) {
  if (!/rel="stylesheet"/.test(tag)) continue;
  const name = tag.match(/href="\.\/assets\/([^"/]+\.css)"/)?.[1];
  assert.ok(name, 'Unexpected stylesheet location');
  cssFiles.push(name);
}
assert.ok(cssFiles.length > 0, 'Build the production web assets first');
const frozenCss = argument('--css');
const css = frozenCss
  ? await readFile(frozenCss, 'utf8')
  : (await Promise.all(cssFiles.map((name) => readFile(new URL(name, assetDir), 'utf8')))).join(
      '\n',
    );
const screenshotDir = argument('--screenshots');
if (process.argv.includes('--record')) {
  assert.ok(frozenCss, 'Recording requires the preserved source CSS');
  assert.equal(
    createHash('sha256').update(css).digest('hex'),
    baselineHash,
    'Refusing to record a candidate baseline',
  );
}
assert.ok(!/\.invisible\s*\{/.test(css), 'Disabled visibility utility was reintroduced');
const probes = `
  <main style="padding:20px">
    <h1 class="text-2xl font-semibold text-primary">Theme contract</h1>
    <section data-probe="card" class="card">
      <label class="block text-sm font-medium">Application name</label>
      <input data-probe="field" class="form-control" value="Fixture application" />
      <button data-probe="button" class="btn btn-primary">Save application</button>
      <select data-probe="select" class="form-control"><option value="display">Display</option><option value="audio">Audio</option></select>
    </section>
    <div data-probe="grid" class="grid grid-cols-1 lg:grid-cols-2 gap-4"><div>Display</div><div>Audio</div></div>
    <mark data-probe="mark" class="rounded-sm bg-amber-200/70 dark:bg-amber-400/30">Recorded source</mark>
  </main>`;
const browser = await chromium.launch({
  channel: process.env['PLAYWRIGHT_CHANNEL'] ?? 'chrome',
  headless: true,
  chromiumSandbox: true,
  args: ['--disable-gpu'],
});
const results: ThemeSnapshot = {};
try {
  for (const state of [
    'default',
    'field-focus',
    'button-hover',
    'button-disabled',
    'select-focus',
    'select-disabled',
    'field-disabled',
  ]) {
    for (const width of [390, 1280]) {
      for (const dark of [false, true]) {
        const context = await browser.newContext({
          viewport: { width, height: 800 },
          reducedMotion: 'reduce',
        });
        try {
          const page = await context.newPage();
          await page.route('**/*', (route) => route.abort());
          await page.setContent(
            `<html class="${dark ? 'dark' : ''}"><head><style>${css}</style><style>#hover-control {position:absolute;left:-100px;color:rgb(1,2,3)} #hover-control:hover {color:rgb(4,5,6)}</style></head><body>${probes}<button id="hover-control">Hover control</button></body></html>`,
          );
          await page.evaluate(() => document.fonts.ready);
          const [probe, action] = state.split('-');
          if (action) {
            assert.ok(probe, 'Missing interaction target');
            const control = page.locator(`[data-probe="${probe}"]`);
            if (action === 'focus') await control.focus();
            if (action === 'hover') {
              // Windows headless pointer hover did not activate :hover in positive controls.
              // Force only the CSS pseudo-state; this does not accept pointer/event behavior.
              const client = await context.newCDPSession(page);
              await client.send('DOM.enable');
              await client.send('CSS.enable');
              {
                const document: unknown = await client.send('DOM.getDocument');
                assert.ok(isRecord(document) && isRecord(document['root']));
                const rootId = document['root']['nodeId'];
                assert.ok(typeof rootId === 'number');
                const forceHover = async (selector: string, active: boolean) => {
                  const result: unknown = await client.send('DOM.querySelector', {
                    nodeId: rootId,
                    selector,
                  });
                  assert.ok(
                    isRecord(result) &&
                      typeof result['nodeId'] === 'number' &&
                      result['nodeId'] > 0,
                  );
                  await client.send('CSS.forcePseudoState', {
                    nodeId: result['nodeId'],
                    forcedPseudoClasses: active ? ['hover'] : [],
                  });
                };
                const positive = page.locator('#hover-control');
                assert.equal(
                  await positive.evaluate((element) => getComputedStyle(element).color),
                  'rgb(1, 2, 3)',
                );
                await forceHover('#hover-control', true);
                assert.equal(
                  await positive.evaluate((element) => getComputedStyle(element).color),
                  'rgb(4, 5, 6)',
                );
                await forceHover('#hover-control', false);
                assert.equal(
                  await positive.evaluate((element) => getComputedStyle(element).color),
                  'rgb(1, 2, 3)',
                );
                await forceHover(`[data-probe="${probe}"]`, true);
              }
              // The context's finally block closes this session after the snapshot.
            }
            if (action === 'disabled')
              await control.evaluate((element) => element.setAttribute('disabled', ''));
            if (action === 'focus')
              assert.ok(await control.evaluate((element) => element === document.activeElement));
            if (action === 'disabled')
              assert.ok(await control.evaluate((element) => element.matches(':disabled')));
          }
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              ),
          );
          const key = `${width}-${dark ? 'dark' : 'light'}-${state}`;
          results[key] = await page.evaluate((): ProbeSnapshot => {
            const properties = [
              'color',
              'backgroundColor',
              'borderTopColor',
              'borderTopWidth',
              'borderRadius',
              'boxShadow',
              'paddingTop',
              'paddingLeft',
              'fontSize',
              'lineHeight',
              'display',
              'gridTemplateColumns',
              'gap',
              'opacity',
              'appearance',
              'backgroundImage',
              'backgroundPosition',
              'backgroundSize',
              'outlineStyle',
              'outlineWidth',
              'outlineColor',
              'outlineOffset',
            ] as const;
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const painter = canvas.getContext('2d');
            if (!painter) throw new Error('Canvas color normalization unavailable');
            const colorSnapshot = (value: string): number[] => {
              painter.clearRect(0, 0, 1, 1);
              painter.fillStyle = value;
              painter.fillRect(0, 0, 1, 1);
              const alpha = painter.getImageData(0, 0, 1, 1).data[3];
              if (alpha === undefined) throw new Error('Invalid color raster');
              // Compare visible premultiplied color, avoiding unstable unpremultiplication
              // of very translucent borders. Keep original alpha as a separate invariant.
              painter.fillStyle = '#fff';
              painter.fillRect(0, 0, 1, 1);
              painter.fillStyle = value;
              painter.fillRect(0, 0, 1, 1);
              const rgba = painter.getImageData(0, 0, 1, 1).data;
              return [rgba[0] ?? 0, rgba[1] ?? 0, rgba[2] ?? 0, alpha];
            };
            const normalized = (
              property: (typeof properties)[number],
              value: string,
            ): SnapshotValue => {
              if (property.toLowerCase().includes('color')) return colorSnapshot(value);
              if (property === 'boxShadow') {
                return (
                  value
                    .split(/, (?![^()]*\))/)
                    .filter((layer) => !/^rgba\(0, 0, 0, 0\) /.test(layer))
                    // A zero-area ring-offset layer draws no pixels.
                    .filter((layer) => !/ 0px 0px 0px 0px$/.test(layer))
                    .map((layer) =>
                      layer.replace(/(?:rgba?|oklab|color)\([^)]*\)/g, (color) =>
                        JSON.stringify(colorSnapshot(color)),
                      ),
                    )
                    .join(', ') || 'none'
                );
              }
              return value;
            };
            return Object.fromEntries(
              [document.body, ...document.querySelectorAll<HTMLElement>('[data-probe]')].map(
                (element): [string, Record<string, SnapshotValue>] => {
                  const style = getComputedStyle(element);
                  return [
                    element.dataset['probe'] ?? 'body',
                    Object.fromEntries(
                      properties.map((property): [string, SnapshotValue] => [
                        property,
                        normalized(property, style[property]),
                      ]),
                    ),
                  ];
                },
              ),
            );
          });
          if (screenshotDir) {
            await mkdir(screenshotDir, { recursive: true });
            await page.screenshot({
              path: `${screenshotDir}/${key}.png`,
              animations: 'disabled',
              fullPage: true,
            });
          }
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}
if (process.argv.includes('--record')) {
  await writeFile(
    contractPath,
    `${JSON.stringify({ source: 'Preserved Tailwind 3.4.19 production CSS; actual app control classes and interaction states', sourceCommit, cssSha256: baselineHash, results }, null, 2)}\n`,
    { flag: 'wx' },
  );
  console.log('Recorded a new create-only theme contract');
} else {
  assert.ok(expected, 'Missing verified baseline contract');
  assert.deepEqual(
    Object.keys(results).sort(),
    Object.keys(expected).sort(),
    'Scenario coverage changed',
  );
  const differences: Array<{
    scenario: string;
    probe: string;
    property: string;
    expected: SnapshotValue;
    actual: SnapshotValue;
  }> = [];
  for (const [scenario, expectedProbes] of Object.entries(expected)) {
    const actualProbes: ProbeSnapshot | UndefinedValue = results[scenario];
    assert.ok(actualProbes);
    assert.deepEqual(
      Object.keys(actualProbes).sort(),
      Object.keys(expectedProbes).sort(),
      'Probe coverage changed',
    );
    for (const [probe, expectedProperties] of Object.entries(expectedProbes)) {
      const actualProperties: Record<string, SnapshotValue> | UndefinedValue = actualProbes[probe];
      assert.ok(actualProperties);
      assert.deepEqual(
        Object.keys(actualProperties).sort(),
        Object.keys(expectedProperties).sort(),
        'Property coverage changed',
      );
      for (const [property, value] of Object.entries(expectedProperties)) {
        const actual = actualProperties[property];
        assert.ok(actual !== undefined);
        const matches = Array.isArray(value)
          ? Array.isArray(actual) &&
            value.length === actual.length &&
            value.every((channel, i) => {
              const observed = actual[i];
              return observed !== undefined && Math.abs(channel - observed) <= 1;
            })
          : actual === value;
        if (!matches) differences.push({ scenario, probe, property, expected: value, actual });
      }
    }
  }
  assert.equal(
    differences.length,
    0,
    `Theme behavior changed (${differences.length} differences): ${JSON.stringify(differences.slice(0, 12), null, 2)}`,
  );
  console.log('PASS: light/dark desktop/mobile theme behavior matches the pre-migration contract');
}
