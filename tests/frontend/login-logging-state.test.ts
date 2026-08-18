import {
  flushPromises,
  mount,
} from '../../src_assets/common/assets/web/node_modules/@vue/test-utils';
import { createPinia } from '../../src_assets/common/assets/web/node_modules/pinia';
import { createI18n } from '../../src_assets/common/assets/web/node_modules/vue-i18n';
import { NButton } from '../../src_assets/common/assets/web/node_modules/naive-ui';
import LoginModal from '@web/components/LoginModal.vue';
import { http } from '@web/http';
import { useAuthStore } from '@web/stores/auth';
import { useConnectivityStore } from '@web/stores/connectivity';

function mountLoginModal() {
  const pinia = createPinia();
  const auth = useAuthStore(pinia);
  const connectivity = useConnectivityStore(pinia);
  auth.ready = true;
  auth.requireLogin();
  connectivity.offline = true;

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        auth: {
          login_title: 'Login',
          username: 'Username',
          password: 'Password',
          remember_me_label: 'Stay signed in',
          login_loading: 'Signing in',
          login_sign_in: 'Sign In',
          login_failed: 'Login failed',
          login_network_error: 'Network error',
          login_success: 'Signed in',
        },
      },
    },
  });
  const wrapper = mount(LoginModal, {
    global: {
      plugins: [pinia, i18n],
      stubs: { Teleport: true },
    },
  });

  return { auth, connectivity, wrapper };
}

describe('login logging state', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('keeps the login control, auth flag, and connectivity overlay synchronized on failure', async () => {
    let releaseRequest: (() => void) | undefined;
    const requestPending = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    vi.spyOn(http, 'post').mockImplementation(async () => {
      await requestPending;
      return { status: 401, data: { status: false, error: 'Rejected' } } as never;
    });
    const { auth, connectivity, wrapper } = mountLoginModal();
    const button = wrapper.getComponent(NButton);

    expect(connectivity.overlayVisible).toBe(true);
    await wrapper.get('form').trigger('submit');

    expect(auth.loggingIn).toBe(true);
    expect(button.props('loading')).toBe(true);
    expect(button.props('disabled')).toBe(true);
    expect(button.text()).toBe('Signing in');
    expect(connectivity.overlayVisible).toBe(false);

    if (releaseRequest === undefined) throw new Error('login request did not start');
    releaseRequest();
    await flushPromises();

    expect(auth.loggingIn).toBe(false);
    expect(button.props('loading')).toBe(false);
    expect(button.props('disabled')).toBe(false);
    expect(button.text()).toBe('Sign In');
    expect(connectivity.overlayVisible).toBe(true);
    expect(wrapper.text()).toContain('Rejected');
  });

  test('clears the auth logging flag after a successful login', async () => {
    vi.useFakeTimers();
    vi.spyOn(http, 'post').mockResolvedValue({ status: 200, data: { status: true } } as never);
    vi.spyOn(http, 'get').mockResolvedValue({
      status: 200,
      data: { status: true, sessions: [] },
    } as never);
    const { auth, wrapper } = mountLoginModal();

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(auth.loggingIn).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.loggingIn).toBe(false);
  });
});
