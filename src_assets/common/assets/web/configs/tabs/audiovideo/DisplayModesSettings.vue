<script setup lang="ts">
import ConfigFieldRenderer from '@/ConfigFieldRenderer.vue';
import { useConfigStore } from '@/stores/config';

const store = useConfigStore();
const config = store.config;
</script>

<template>
  <ConfigFieldRenderer v-model="config.fallback_mode" setting-key="fallback_mode" class="mb-4" />

  <ConfigFieldRenderer v-model="config.max_bitrate" setting-key="max_bitrate" class="mb-4" />

  <ConfigFieldRenderer
    v-model="config.minimum_fps_target"
    setting-key="minimum_fps_target"
    class="mb-4"
  />
</template>

<style scoped>
.ms-item {
  background-color: var(--bs-dark-bg-subtle);
  font-size: 12px;
  font-weight: bold;
}
</style>
