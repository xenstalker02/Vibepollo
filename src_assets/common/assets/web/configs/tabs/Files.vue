<script setup lang="ts">
import ConfigFieldRenderer from '@/ConfigFieldRenderer.vue';
import { useConfigStore } from '@/stores/config';

const store = useConfigStore();
const config = store.config;
</script>

<template>
  <div id="files" class="config-page">
    <ConfigFieldRenderer
      v-model="config.file_apps"
      setting-key="file_apps"
      class="mb-6"
      placeholder="apps.json"
    />

    <ConfigFieldRenderer
      v-model="config.credentials_file"
      setting-key="credentials_file"
      class="mb-6"
      placeholder="sunshine_state.json"
    />

    <ConfigFieldRenderer
      v-model="config.log_path"
      setting-key="log_path"
      class="mb-6"
      placeholder="sunshine.log"
    />

    <ConfigFieldRenderer
      v-model="config.pkey"
      setting-key="pkey"
      class="mb-6"
      placeholder="/dir/pkey.pem"
    />

    <ConfigFieldRenderer
      v-model="config.cert"
      setting-key="cert"
      class="mb-6"
      placeholder="/dir/cert.pem"
    />

    <ConfigFieldRenderer
      v-model="config.file_state"
      setting-key="file_state"
      class="mb-6"
      placeholder="sunshine_state.json"
    />

    <ConfigFieldRenderer
      v-model="config.vibeshine_file_state"
      setting-key="vibeshine_file_state"
      class="mb-6"
      placeholder="vibeshine_state.json"
    />
  </div>
</template>

<style scoped></style>
