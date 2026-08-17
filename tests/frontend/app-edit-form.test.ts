import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { NMessageProvider } from '../../src_assets/common/assets/web/node_modules/naive-ui';
import { createPinia } from '../../src_assets/common/assets/web/node_modules/pinia';
import { createI18n } from '../../src_assets/common/assets/web/node_modules/vue-i18n';
import AppEditModal from '@web/components/AppEditModal.vue';
import AppEditBasicsSection from '@web/components/app-edit/AppEditBasicsSection.vue';
import type { AppForm, FrameGenHealth, ServerApp } from '@web/components/app-edit/types';

describe('AppEditModal', () => {
  function formFromModal(app?: ServerApp): AppForm {
    const wrapper = mount(
      defineComponent({
        components: { AppEditModal, NMessageProvider },
        props: { app: { type: Object, required: false } },
        template:
          '<n-message-provider><AppEditModal :app="app" :model-value="true" /></n-message-provider>',
      }),
      {
        global: {
          mocks: { $t: (key: string) => key },
          plugins: [
            createPinia(),
            createI18n({ legacy: false, locale: 'en', messages: { en: {} } }),
          ],
        },
      },
    );
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

  test('keeps a passing frame-generation health result free of a suggestion', () => {
    const health: FrameGenHealth = {
      checkedAt: Date.now(),
      capture: { status: 'pass', method: 'wgc', message: 'Capture is compatible.' },
      rtss: {
        status: 'pass',
        installed: true,
        running: true,
        hooksDetected: true,
        message: 'RTSS is ready.',
      },
      display: {
        status: 'pass',
        deviceLabel: 'Virtual display',
        deviceId: 'virtual',
        currentHz: 240,
        targets: [],
        virtualActive: true,
        message: 'Display is compatible.',
      },
    };

    expect('suggestion' in health).toBe(false);
  });
});
