import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { NMessageProvider } from '../../src_assets/common/assets/web/node_modules/naive-ui';
import { createPinia } from '../../src_assets/common/assets/web/node_modules/pinia';
import { createI18n } from '../../src_assets/common/assets/web/node_modules/vue-i18n';
import AppEditModal from '@web/components/AppEditModal.vue';
import AppEditBasicsSection from '@web/components/app-edit/AppEditBasicsSection.vue';
import type { AppForm } from '@web/components/app-edit/types';

describe('AppEditModal', () => {
  test('omits unavailable application identifiers from a new form', () => {
    const wrapper = mount(
      defineComponent({
        components: { AppEditModal, NMessageProvider },
        template: '<n-message-provider><AppEditModal :model-value="true" /></n-message-provider>',
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
    const form = wrapper
      .getComponent(AppEditModal)
      .getComponent(AppEditBasicsSection)
      .props('form') as AppForm;

    expect('uuid' in form).toBe(false);
    expect('playniteId' in form).toBe(false);
    expect('playniteManaged' in form).toBe(false);
  });
});
