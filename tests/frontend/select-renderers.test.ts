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
import { createPinia } from '../../src_assets/common/assets/web/node_modules/pinia';
import { createI18n } from '../../src_assets/common/assets/web/node_modules/vue-i18n';
import {
  defineComponent,
  h,
  type PropType,
} from '../../src_assets/common/assets/web/node_modules/vue';
import {
  NMessageProvider,
  NSelect,
  type SelectOption,
  type SelectRenderLabel,
  type SelectRenderOption,
} from '../../src_assets/common/assets/web/node_modules/naive-ui';
import AppEditModal from '@web/components/AppEditModal.vue';
import DisplayDeviceOptions from '@web/configs/tabs/audiovideo/DisplayDeviceOptions.vue';
import DisplayOutputSelector from '@web/configs/tabs/audiovideo/DisplayOutputSelector.vue';
import ClientManagementView from '@web/views/ClientManagementView.vue';
import { http } from '@web/http';
import { useAuthStore } from '@web/stores/auth';
import { useConfigStore } from '@web/stores/config';

const representativeOption: SelectOption = {
  label: 'Flattened label',
  value: 'display-guid',
  displayName: 'Primary Display',
  id: 'display-guid',
  active: false,
};

const NSelectRendererHarness = defineComponent({
  props: {
    renderLabel: { type: Function as PropType<SelectRenderLabel>, required: true },
    renderOption: { type: Function as PropType<SelectRenderOption>, required: true },
    option: { type: Object as PropType<SelectOption>, required: true },
  },
  setup(props) {
    return () => {
      const selected = props.renderLabel(props.option, true);
      const dropdown = props.renderOption({
        node: h('span', [props.renderLabel(props.option, false)]),
        option: props.option,
        selected: false,
      });
      return h('div', [
        h('div', { class: 'selected-value' }, [selected]),
        h('div', { class: 'dropdown-option' }, [dropdown]),
      ]);
    };
  },
});

function rendererGlobal() {
  const pinia = createPinia();
  useConfigStore(pinia).metadata = { platform: 'windows' };
  return {
    plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en: {} } })],
    mocks: { $t: (key: string) => key },
    stubs: { Teleport: true },
  };
}

function rendererFrom(wrapper: VueWrapper, option: SelectOption = representativeOption) {
  const select = wrapper
    .findAllComponents(NSelect)
    .find(
      (candidate) =>
        typeof candidate.props('renderLabel') === 'function' &&
        typeof candidate.props('renderOption') === 'function',
    );
  if (select === undefined) throw new Error('display select renderer was not mounted');
  return mount(NSelectRendererHarness, {
    props: {
      renderLabel: select.props('renderLabel') as SelectRenderLabel,
      renderOption: select.props('renderOption') as SelectRenderOption,
      option,
    },
  });
}

function expectBothStates(wrapper: VueWrapper, includesStatus: boolean) {
  expect(wrapper.get('.selected-value').text()).toContain('Primary Display');
  expect(wrapper.get('.dropdown-option').text()).toContain('Primary Display');
  expect(wrapper.get('.dropdown-option').text()).toContain('display-guid');
  if (includesStatus) expect(wrapper.get('.dropdown-option').text()).toContain('Inactive');
}

describe('display select renderers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('mounts AppEditModal renderer callbacks for selected and dropdown states', () => {
    const wrapper = mount(NMessageProvider, {
      slots: {
        default: () => h(AppEditModal, { app: { output: 'display-guid' }, modelValue: true }),
      },
      global: rendererGlobal(),
    });

    expectBothStates(rendererFrom(wrapper.getComponent(AppEditModal)), true);
  });

  test('mounts DisplayDeviceOptions renderer callbacks for both states', () => {
    expectBothStates(
      rendererFrom(mount(DisplayDeviceOptions, { global: rendererGlobal() })),
      false,
    );
  });

  test('mounts DisplayOutputSelector renderer callbacks for both states', () => {
    expectBothStates(
      rendererFrom(mount(DisplayOutputSelector, { global: rendererGlobal() })),
      false,
    );
  });

  test('preserves active and inactive status styling in client display options', async () => {
    const pinia = createPinia();
    const configStore = useConfigStore(pinia);
    configStore.metadata = { platform: 'windows' };
    vi.spyOn(configStore, 'fetchConfig').mockResolvedValue({} as never);
    const authStore = useAuthStore(pinia);
    authStore.isAuthenticated = true;
    vi.spyOn(authStore, 'waitForAuthentication').mockResolvedValue();
    vi.spyOn(http, 'get').mockResolvedValue({
      status: 200,
      data: {
        status: true,
        platform: 'windows',
        named_certs: [
          {
            uuid: 'client-guid',
            name: 'Living Room',
            output_name_override: 'display-guid',
          },
        ],
      },
    } as never);

    const wrapper = mount(NMessageProvider, {
      slots: { default: () => h(ClientManagementView) },
      global: {
        plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en: {} } })],
        mocks: { $t: (key: string) => key },
        stubs: {
          AppEditConfigOverridesSection: true,
          Teleport: true,
          TrustedDevicesCard: true,
        },
      },
    });
    await flushPromises();
    await vi.waitFor(() => {
      expect(wrapper.find('.fa-edit').exists()).toBe(true);
    });
    await wrapper.get('.fa-edit').trigger('click');
    await flushPromises();

    const clientView = wrapper.getComponent(ClientManagementView);
    const inactive = rendererFrom(clientView, representativeOption);
    const active = rendererFrom(clientView, { ...representativeOption, active: true });

    expect(inactive.get('.dropdown-option .font-mono span').classes()).toContain('opacity-70');
    expect(active.get('.dropdown-option .font-mono span').classes()).toEqual(
      expect.arrayContaining(['text-green-600', 'dark:text-green-400']),
    );
    wrapper.unmount();
  });
});
