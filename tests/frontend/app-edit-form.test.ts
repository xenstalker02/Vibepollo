import {
  flushPromises,
  mount,
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
import type { AppForm, ServerApp } from '@web/components/app-edit/types';
import { http } from '@web/http';
import { useConfigStore } from '@web/stores/config';

describe('AppEditModal', () => {
  afterEach(() => {
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
      plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en: {} } })],
      stubs: { Teleport: true },
    };
  }

  function formFromModal(app?: ServerApp): AppForm {
    const wrapper = mount(NMessageProvider, {
      slots: { default: () => h(AppEditModal, { app, modelValue: true }) },
      global: modalGlobal(),
    });
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
    const wrapper = mount(NMessageProvider, {
      slots: {
        default: () =>
          h(AppEditModal, {
            app: { 'virtual-screen': true, 'gen1-framegen-fix': true },
            modelValue: true,
          }),
      },
      global: modalGlobal(true),
    });

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
});
