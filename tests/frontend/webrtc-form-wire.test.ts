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
  NDialogProvider,
  NInputNumber,
} from '../../src_assets/common/assets/web/node_modules/naive-ui';
import WebRtcClientView from '@web/views/WebRtcClientView.vue';
import { WebRtcHttpApi } from '@web/services/webrtcApi';
import { WebRtcClient } from '@web/utils/webrtc/client';
import { http } from '@web/http';
import type { StreamConfig } from '@web/types/webrtc';

let wrapper: VueWrapper | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

describe('WebRTC session form serialization', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('serializes cleared bitrate and pacing slack as null sentinels', async () => {
    vi.stubGlobal(
      'MediaStream',
      class {
        getAudioTracks(): unknown[] {
          return [];
        }
      },
    );
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const get = vi.spyOn(http, 'get').mockResolvedValue({
      status: 200,
      data: { apps: [], status: true, activeSessions: 0, appRunning: false, paused: false },
    } as never);

    let submittedConfig: StreamConfig | undefined;
    vi.spyOn(WebRtcClient.prototype, 'connect').mockImplementation(async (config) => {
      submittedConfig = { ...config };
      return 'session-from-client';
    });

    wrapper = mount(NDialogProvider, {
      slots: { default: WebRtcClientView },
      global: {
        plugins: [
          createPinia(),
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: {} },
            missingWarn: false,
            fallbackWarn: false,
          }),
        ],
        mocks: { $t: (key: string) => key },
        stubs: { Teleport: true },
      },
    });

    await wrapper.get('.settings-btn').trigger('click');
    const numberInputs = wrapper.findAllComponents(NInputNumber);
    const bitrate = numberInputs.find((input) => input.props('min') === 500);
    const pacingSlack = numberInputs.find(
      (input) => input.props('min') === 0 && input.props('max') === 10,
    );
    if (bitrate === undefined || pacingSlack === undefined) {
      throw new Error('bitrate and pacing inputs were not mounted');
    }
    bitrate.vm.$emit('update:value', null);
    pacingSlack.vm.$emit('update:value', null);

    await wrapper.get('.action-btn.primary').trigger('click');
    await flushPromises();
    await vi.waitFor(() => {
      expect(submittedConfig).toBeDefined();
    });
    if (submittedConfig === undefined) throw new Error('WebRTC config was not submitted');
    const post = vi.spyOn(http, 'post').mockResolvedValue({
      status: 200,
      data: { session: { id: 'session-from-api' }, ice_servers: [] },
    } as never);
    await new WebRtcHttpApi().createSession(submittedConfig);

    const requestBody = post.mock.calls[0]?.[1];
    const serialized: unknown = JSON.parse(JSON.stringify(requestBody));
    if (!isRecord(serialized)) throw new Error('session request body was not an object');
    expect(serialized['bitrate_kbps']).toBeNull();
    expect(serialized['video_pacing_slack_ms']).toBeNull();
    expect(Object.keys(serialized)).toContain('bitrate_kbps');
    expect(Object.keys(serialized)).toContain('video_pacing_slack_ms');

    const requestsBeforeUnmount = get.mock.calls.length;
    wrapper.unmount();
    wrapper = undefined;
    await flushPromises();
    expect(get).toHaveBeenCalledTimes(requestsBeforeUnmount);
  });
});
