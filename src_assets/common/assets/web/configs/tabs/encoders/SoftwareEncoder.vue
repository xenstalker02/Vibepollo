<script setup lang="ts">
import ConfigFieldRenderer from '@/ConfigFieldRenderer.vue';
import { useConfigStore } from '@/stores/config';

const store = useConfigStore();
const config = store.config;
</script>

<template>
  <div id="software-encoder" class="config-page">
    <ConfigFieldRenderer v-model="config.sw_preset" setting-key="sw_preset" class="mb-4" />

    <ConfigFieldRenderer v-model="config.sw_tune" setting-key="sw_tune" class="mb-4" />
  </div>
</template>

<style scoped></style>
