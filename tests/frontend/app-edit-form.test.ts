import {
  flushPromises,
  mount,
  type VueWrapper,
} from '../../src_assets/common/assets/web/node_modules/@vue/test-utils';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from '../../src_assets/common/assets/web/node_modules/vitest';
import { h } from '../../src_assets/common/assets/web/node_modules/vue';
import { NMessageProvider } from '../../src_assets/common/assets/web/node_modules/naive-ui';
import { createPinia } from '../../src_assets/common/assets/web/node_modules/pinia';
import { createI18n } from '../../src_assets/common/assets/web/node_modules/vue-i18n';
import AppEditModal from '@web/components/AppEditModal.vue';
import AppEditBasicsSection from '@web/components/app-edit/AppEditBasicsSection.vue';
import AppEditFrameGenSection from '@web/components/app-edit/AppEditFrameGenSection.vue';
import AppEditCoverModal from '@web/components/app-edit/AppEditCoverModal.vue';
import type { AppForm, ServerApp } from '@web/components/app-edit/types';
import { http } from '@web/http';
import { useConfigStore } from '@web/stores/config';

describe('AppEditModal', () => {
  const wrappers: VueWrapper[] = [];

  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount();
    vi.restoreAllMocks();
  });

  function modalGlobal(windows = false) {
    const pinia = createPinia();
    const configStore = useConfigStore(pinia);
    if (windows) {
      configStore.metadata = { platform: 'windows' };
      configStore.config.capture = 'wgc';
    }
    return {
      mocks: { $t: (key: string) => key },
      plugins: [
        pinia,
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: {} },
          missingWarn: false,
          fallbackWarn: false,
        }),
      ],
      stubs: { Teleport: true },
    };
  }

  function mountModal(app?: ServerApp, windows = false) {
    const wrapper = mount(NMessageProvider, {
      slots: { default: () => h(AppEditModal, { app, modelValue: true }) },
      global: modalGlobal(windows),
    });
    wrappers.push(wrapper);
    return wrapper;
  }

  function formFromModal(app?: ServerApp): AppForm {
    const wrapper = mountModal(app);
    return wrapper
      .getComponent(AppEditModal)
      .getComponent(AppEditBasicsSection)
      .props('form') as AppForm;
  }

  test('omits unavailable application identifiers from a new form', () => {
    const form = formFromModal();

    expect('uuid' in form).toBe(false);
    expect('playniteId' in form).toBe(false);
    expect('playniteManaged' in form).toBe(false);
  });

  test('omits unavailable application identifiers when loading a server app', () => {
    const form = formFromModal({ name: 'Saved app', cmd: 'run.exe' });

    expect('uuid' in form).toBe(false);
    expect('playniteId' in form).toBe(false);
    expect('playniteManaged' in form).toBe(false);
  });

  test('builds a healthy virtual-display frame-generation result without a suggestion', async () => {
    const healthResponse = {
      status: 200,
      data: { path_exists: true, hooks_found: true, process_running: true },
    };
    const get = vi.spyOn(http, 'get').mockResolvedValue(healthResponse as never);
    const wrapper = mountModal({ 'virtual-screen': true, 'gen1-framegen-fix': true }, true);

    const frameGen = wrapper.getComponent(AppEditModal).getComponent(AppEditFrameGenSection);
    frameGen.vm.$emit('refresh-health');
    await flushPromises();

    const health = frameGen.props('health');
    expect(health).not.toBeNull();
    if (health === null) throw new Error('frame-generation health did not refresh');
    expect('suggestion' in health).toBe(false);
    expect(get).toHaveBeenCalledWith('/api/rtss/status', expect.any(Object));
    expect(get).toHaveBeenCalledWith('/api/display-devices?detail=full', expect.any(Object));
  });

  test('keeps the loading Playnite option disabled while suggestions resolve', async () => {
    vi.spyOn(http, 'get').mockImplementation(() => new Promise(() => {}));
    const wrapper = mountModal(undefined, true);
    const basics = wrapper.getComponent(AppEditModal).getComponent(AppEditBasicsSection);

    basics.vm.$emit('name-focus');
    await wrapper.vm.$nextTick();

    expect(basics.props('nameSelectOptions')).toEqual([
      { label: 'Loading Playnite games…', value: '__loading__', disabled: true },
    ]);
  });

  test('builds a cover candidate from a numeric GameDB id', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({ status: 200, data: {} } as never);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/buckets/ha.json')) {
        return {
          ok: true,
          json: async () => ({ '28076': { name: 'Halo' } }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          id: 28076,
          name: 'Halo',
          cover: { url: '//images.igdb.com/igdb/image/upload/t_thumb/co123.jpg' },
        }),
      } as Response;
    });
    const wrapper = mountModal({ name: 'Halo' });
    const modal = wrapper.getComponent(AppEditModal);

    modal.getComponent(AppEditBasicsSection).vm.$emit('open-cover-finder');
    await flushPromises();

    expect(modal.getComponent(AppEditCoverModal).props('coverCandidates')).toEqual([
      {
        name: 'Halo',
        key: 'igdb_28076',
        url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg',
        saveUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co123.png',
      },
    ]);
  });
});
