<script setup lang="ts">
import ConfigFieldRenderer from '@/ConfigFieldRenderer.vue';
import { useConfigStore } from '@/stores/config';

const store = useConfigStore();
const config = store.config;
</script>

<template>
  <div id="intel-quicksync-encoder" class="config-page">
    <header class="section-header">
      <h3 class="text-sm font-medium">Intel Encoder</h3>
    </header>

    <ConfigFieldRenderer v-model="config.qsv_preset" setting-key="qsv_preset" class="mb-4" />

    <ConfigFieldRenderer v-model="config.qsv_coder" setting-key="qsv_coder" class="mb-4" />

    <ConfigFieldRenderer v-model="config.qsv_slow_hevc" setting-key="qsv_slow_hevc" class="mb-0" />
  </div>
</template>

<style scoped>
.section-header {
  @apply mb-4;
}
</style>
