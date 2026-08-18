<script setup lang="ts">
import ConfigFieldRenderer from '@/ConfigFieldRenderer.vue';
import { useConfigStore } from '@/stores/config';

const store = useConfigStore();
const config = store.config;
</script>

<template>
  <div id="videotoolbox-encoder" class="config-page">
    <ConfigFieldRenderer v-model="config.vt_coder" setting-key="vt_coder" class="mb-4" />

    <ConfigFieldRenderer v-model="config.vt_software" setting-key="vt_software" class="mb-4" />

    <ConfigFieldRenderer v-model="config.vt_realtime" setting-key="vt_realtime" class="mb-4" />
  </div>
</template>

<style scoped></style>
