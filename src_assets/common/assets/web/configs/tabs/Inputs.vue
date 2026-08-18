<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import ConfigFieldRenderer from '@/ConfigFieldRenderer.vue';
import { useConfigStore } from '@/stores/config';

const store = useConfigStore();
const { config, metadata } = storeToRefs(store);

const platform = computed(() =>
  (metadata.value?.platform || config.value?.platform || '').toLowerCase(),
);
</script>

<template>
  <div id="input" class="config-page">
    <ConfigFieldRenderer v-model="config.controller" setting-key="controller" class="mb-3" />

    <div v-if="config.controller === 'enabled' && platform !== 'macos'" class="mb-6">
      <ConfigFieldRenderer v-model="config.gamepad" setting-key="gamepad" />
    </div>

    <template v-if="config.controller === 'enabled'">
      <template
        v-if="
          config.gamepad === 'ds4' ||
          config.gamepad === 'ds5' ||
          (config.gamepad === 'auto' && platform !== 'macos')
        "
      >
        <div class="mb-3 accordion">
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button
                class="accordion-button"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#panelsStayOpen-collapseOne"
              >
                {{
                  $t(
                    config.gamepad === 'ds4'
                      ? 'config.gamepad_ds4_manual'
                      : config.gamepad === 'ds5'
                        ? 'config.gamepad_ds5_manual'
                        : 'config.gamepad_auto',
                  )
                }}
              </button>
            </h2>
            <div
              id="panelsStayOpen-collapseOne"
              class="accordion-collapse collapse show"
              aria-labelledby="panelsStayOpen-headingOne"
            >
              <div class="accordion-body">
                <template
                  v-if="
                    config.gamepad === 'auto' && (platform === 'windows' || platform === 'linux')
                  "
                >
                  <ConfigFieldRenderer
                    v-model="config.motion_as_ds4"
                    setting-key="motion_as_ds4"
                    class="mb-3"
                  />
                  <ConfigFieldRenderer
                    v-model="config.touchpad_as_ds4"
                    setting-key="touchpad_as_ds4"
                    class="mb-3"
                  />
                </template>

                <template
                  v-if="
                    config.gamepad === 'ds4' ||
                    (config.gamepad === 'auto' && platform === 'windows')
                  "
                >
                  <ConfigFieldRenderer
                    v-model="config.ds4_back_as_touchpad_click"
                    setting-key="ds4_back_as_touchpad_click"
                    class="mb-3"
                  />
                </template>

                <template
                  v-if="
                    config.gamepad === 'ds5' || (config.gamepad === 'auto' && platform === 'linux')
                  "
                >
                  <ConfigFieldRenderer
                    v-model="config.ds5_inputtino_randomize_mac"
                    setting-key="ds5_inputtino_randomize_mac"
                    class="mb-3"
                  />
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>

    <div v-if="config.controller === 'enabled'" class="mb-4">
      <ConfigFieldRenderer v-model="config.back_button_timeout" setting-key="back_button_timeout" />
    </div>

    <ConfigFieldRenderer
      v-if="config.controller === 'enabled'"
      v-model="config.forward_rumble"
      setting-key="forward_rumble"
      class="mb-3"
    />

    <hr />

    <ConfigFieldRenderer v-model="config.keyboard" setting-key="keyboard" class="mb-3" />

    <div v-if="config.keyboard === 'enabled' && platform === 'windows'" class="mb-4">
      <ConfigFieldRenderer v-model="config.key_repeat_delay" setting-key="key_repeat_delay" />
    </div>

    <div v-if="config.keyboard === 'enabled' && platform === 'windows'" class="mb-4">
      <ConfigFieldRenderer
        v-model="config.key_repeat_frequency"
        setting-key="key_repeat_frequency"
      />
    </div>

    <ConfigFieldRenderer
      v-if="config.keyboard === 'enabled' && platform === 'windows'"
      v-model="config.always_send_scancodes"
      setting-key="always_send_scancodes"
      class="mb-3"
    />

    <ConfigFieldRenderer
      v-if="config.keyboard === 'enabled'"
      v-model="config.key_rightalt_to_key_win"
      setting-key="key_rightalt_to_key_win"
      class="mb-3"
    />

    <ConfigFieldRenderer v-model="config.mouse" setting-key="mouse" class="mt-5 mb-3" />

    <ConfigFieldRenderer
      v-if="config.mouse === 'enabled'"
      v-model="config.high_resolution_scrolling"
      setting-key="high_resolution_scrolling"
      class="mb-3"
    />

    <ConfigFieldRenderer
      v-if="config.mouse === 'enabled'"
      v-model="config.native_pen_touch"
      setting-key="native_pen_touch"
      class="mb-3"
    />

    <hr />

    <ConfigFieldRenderer
      v-model="config.enable_input_only_mode"
      setting-key="enable_input_only_mode"
      class="mb-3"
    />
  </div>
</template>

<style scoped></style>
