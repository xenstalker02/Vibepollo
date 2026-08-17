<template>
  <div class="space-y-8 playnite-tab">
    <n-alert v-if="platform && platform !== 'windows'" type="info" :show-icon="true">
      {{ $t('playnite.only_windows') }}
    </n-alert>

    <section v-if="platform === 'windows'" class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wider">
        {{ $t('playnite.status_title') }}
      </h3>
      <div
        class="bg-light/70 dark:bg-surface/70 border border-dark/10 dark:border-light/10 rounded-lg p-4 space-y-4 playnite-card"
      >
        <!-- Integration is always on; no enable/disable toggle -->
        <div class="text-sm grid md:grid-cols-3 gap-3">
          <div class="flex items-center gap-2">
            <b>{{ $t('playnite.status_overall') }}</b>
            <n-tooltip v-if="statusKind === 'waiting'" trigger="hover">
              <template #trigger>
                <n-tag size="small" :type="statusType">{{ statusText }}</n-tag>
              </template>
              <span>{{ $t('playnite.limited_tooltip') }}</span>
            </n-tooltip>
            <n-tag v-else size="small" :type="statusType">{{ statusText }}</n-tag>
          </div>
        </div>
        <n-alert v-if="pluginOutdated" type="warning" :show-icon="true">
          {{
            $t('playnite.plugin_outdated', {
              installed: status.plugin_version || '?',
              latest: status.plugin_latest || '?',
            })
          }}
        </n-alert>
        <div v-if="diagnosticText" class="text-xs opacity-80">
          {{ diagnosticText }}
        </div>
        <div class="flex items-center gap-2">
          <n-button
            v-if="canLaunch"
            size="small"
            type="primary"
            strong
            :loading="launching"
            @click="launchPlaynite"
          >
            <i class="fas fa-rocket" />
            <span class="ml-2">{{ $t('playnite.launch_button') || 'Launch Playnite' }}</span>
          </n-button>
          <n-button size="small" type="primary" strong @click="refreshStatus">
            <i class="fas fa-sync" />
            <span class="ml-2">{{ $t('playnite.refresh_status') || 'Refresh Status' }}</span>
          </n-button>
        </div>

        <!-- Merged maintenance details -->
        <div v-if="status.extensions_dir" class="text-sm flex items-center gap-2 inline-info">
          <b class="shrink-0">{{ $t('playnite.extensions_dir') }}:</b>
          <code
            class="text-xs whitespace-nowrap overflow-x-auto px-1 rounded bg-black/5 dark:bg-white/5"
            >{{ status.extensions_dir }}</code
          >
          <n-button size="tiny" type="default" strong @click="copyExtensionsPath">
            <i class="fas fa-copy" />
            <span class="ml-1">{{ $t('playnite.copy_path') || 'Copy' }}</span>
          </n-button>
        </div>
        <div v-if="status.plugin_version" class="text-sm flex items-center gap-2 inline-info">
          <b>{{ $t('playnite.plugin_version') || 'Plugin' }}:</b>
          <n-tag size="small" type="default">v{{ status.plugin_version }}</n-tag>
          <template v-if="status.plugin_latest">
            <span class="opacity-70">→</span>
            <n-tag size="small" :type="pluginOutdated ? 'warning' : 'success'"
              >v{{ status.plugin_latest }}</n-tag
            >
          </template>
        </div>
        <div class="pt-2 border-t border-dark/10 dark:border-light/10 mt-2">
          <div class="flex items-center justify-end gap-2 playnite-actions">
            <PlayniteReinstallButton
              v-if="status.extensions_dir"
              size="small"
              :strong="true"
              :restart="true"
              :label="
                status.installed
                  ? pluginOutdated
                    ? translate('playnite.upgrade_button', 'Upgrade Plugin')
                    : translate(
                        'playnite.reinstall_button',
                        translate('playnite.repair_button', 'Reinstall Plugin'),
                      )
                  : translate('playnite.install_button', 'Install Plugin')
              "
              @done="onReinstallDone"
            />
            <n-button
              v-if="status.extensions_dir && status.installed"
              size="small"
              type="error"
              strong
              :loading="uninstalling"
              @click="openUninstallConfirm"
            >
              <i class="fas fa-trash" />
              <span class="ml-2">{{ $t('playnite.uninstall_button') || 'Uninstall Plugin' }}</span>
            </n-button>
          </div>
        </div>
      </div>
    </section>
    <section v-if="platform === 'windows'" class="space-y-6">
      <h3 class="text-sm font-semibold uppercase tracking-wider">
        {{ $t('playnite.settings_title') }}
      </h3>

      <!-- Auto-sync card -->
      <div
        class="bg-light/70 dark:bg-surface/70 border border-dark/10 dark:border-light/10 rounded-lg section-card"
      >
        <div class="px-4 pt-3 pb-2 flex items-baseline justify-between section-header">
          <h4 class="text-sm font-semibold">
            {{ $t('playnite.section_auto_sync') || 'Auto-sync' }}
          </h4>
          <div class="flex items-center gap-2">
            <n-button size="tiny" type="default" strong @click="resetAutoSyncSection">
              <i class="fas fa-undo" />
              <span class="ml-1">{{ $t('playnite.reset_defaults') || 'Reset to defaults' }}</span>
            </n-button>
            <n-button
              size="tiny"
              type="error"
              strong
              :loading="deletingAutosync"
              @click="openDeleteAutosyncConfirm"
            >
              <i class="fas fa-trash" />
              <span class="ml-1">
                {{ $t('playnite.delete_all_autosync') || 'Delete Auto-sync Games' }}
              </span>
            </n-button>
          </div>
        </div>
        <div class="px-4 pb-4 section-body">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 items-start">
            <div>
              <Checkbox
                id="playnite_auto_sync"
                v-model="config.playnite_auto_sync"
                :default="store.defaults.playnite_auto_sync"
                locale-prefix="playnite"
                label="playnite.auto_sync"
                :desc="''"
              />
              <div v-if="!autoSyncEnabled" class="form-text">
                {{
                  $t('playnite.enable_autosync_hint') || 'Enable Auto-sync to edit these settings.'
                }}
              </div>
            </div>
            <div>
              <Checkbox
                id="playnite_sync_all_installed"
                v-model="config.playnite_sync_all_installed"
                :default="store.defaults.playnite_sync_all_installed"
                locale-prefix="playnite"
                label="playnite.sync_all_installed"
                desc="playnite.sync_all_installed_desc"
                :disabled="!autoSyncEnabled"
              />
            </div>
            <div>
              <label for="playnite_recent_games" class="form-label">{{
                $t('playnite.recent_games')
              }}</label>
              <n-input-number
                id="playnite_recent_games"
                v-model:value="config.playnite_recent_games"
                :min="0"
                :max="50"
                :show-button="true"
                class="w-32"
                :disabled="!autoSyncEnabled"
              />
              <div class="form-text">
                {{ $t('playnite.recent_games_desc') }} (0 =
                {{ $t('_common.disabled') || 'disabled' }})
              </div>
            </div>
            <div>
              <label for="playnite_recent_max_age_days" class="form-label">{{
                $t('playnite.recent_max_age_days')
              }}</label>
              <n-input-number
                id="playnite_recent_max_age_days"
                v-model:value="config.playnite_recent_max_age_days"
                :min="0"
                :max="3650"
                :show-button="true"
                class="w-32"
                :disabled="!autoSyncEnabled"
              />
              <div class="form-text">
                {{ $t('playnite.recent_max_age_days_desc') }} (0 =
                {{ $t('_common.disabled') || 'disabled' }})
              </div>
            </div>
            <div class="md:col-span-1">
              <label for="playnite_sync_categories" class="form-label">{{
                $t('playnite.sync_categories')
              }}</label>
              <n-tooltip :disabled="!disablePlayniteSelection && autoSyncEnabled" trigger="hover">
                <template #trigger>
                  <n-select
                    id="playnite_sync_categories"
                    v-model:value="selectedCategories"
                    multiple
                    :options="categoryOptions"
                    filterable
                    tag
                    clearable
                    :placeholder="
                      $t('playnite.categories_placeholder') || 'All categories (default)'
                    "
                    :loading="categoriesLoading"
                    :disabled="disablePlayniteSelection || !autoSyncEnabled"
                    class="w-full"
                    @focus="() => loadCategories()"
                  />
                </template>
                <span>{{
                  !autoSyncEnabled
                    ? $t('playnite.enable_autosync_hint') ||
                      'Enable Auto-sync to edit these settings.'
                    : disabledHint
                }}</span>
              </n-tooltip>
              <div class="form-text">{{ $t('playnite.sync_categories_help') }}</div>
            </div>
            <div>
              <label for="playnite_sync_plugins" class="form-label">{{
                $t('playnite.sync_plugins') || 'Include library plugins'
              }}</label>
              <n-tooltip :disabled="!disablePlayniteSelection && autoSyncEnabled" trigger="hover">
                <template #trigger>
                  <n-select
                    id="playnite_sync_plugins"
                    v-model:value="includedPlugins"
                    multiple
                    :options="pluginOptions"
                    filterable
                    clearable
                    :placeholder="
                      $t('playnite.plugins_include_placeholder') || 'Include all games from...'
                    "
                    :loading="pluginsLoading"
                    :disabled="disablePlayniteSelection || !autoSyncEnabled"
                    class="w-full"
                    @focus="() => loadPlugins()"
                  />
                </template>
                <span
                  >{ !autoSyncEnabled ? $t('playnite.enable_autosync_hint') || 'Enable Auto-sync to
                  edit these settings.' : disabledHint }</span
                >
              </n-tooltip>
              <div class="form-text">{{ $t('playnite.sync_plugins_help') }}</div>
            </div>
            <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <label for="playnite_autosync_delete_after_days" class="form-label">{{
                  $t('playnite.delete_after_days')
                }}</label>
                <n-input-number
                  id="playnite_autosync_delete_after_days"
                  v-model:value="config.playnite_autosync_delete_after_days"
                  :min="0"
                  :max="3650"
                  :show-button="true"
                  class="w-32"
                  :disabled="!autoSyncEnabled"
                />
                <div class="form-text">
                  {{ $t('playnite.delete_after_days_desc') }} (0 =
                  {{ $t('_common.disabled') || 'disabled' }})
                </div>
              </div>
              <div>
                <label class="form-label" for="playnite_cleanup_policy">{{
                  $t('playnite.cleanup_policy') || 'Cleanup policy'
                }}</label>
                <n-radio-group
                  id="playnite_cleanup_policy"
                  v-model:value="config.playnite_autosync_require_replacement"
                  :disabled="!autoSyncEnabled"
                >
                  <div class="flex flex-col gap-1 text-sm">
                    <label class="flex items-center gap-2">
                      <n-radio :value="true" />
                      <span>{{
                        $t('playnite.policy_keep_until_replaced') || 'Keep until replaced (default)'
                      }}</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <n-radio :value="false" />
                      <span>{{
                        $t('playnite.policy_prune_immediately') ||
                        'Always prune games that no longer qualify'
                      }}</span>
                    </label>
                  </div>
                </n-radio-group>
                <div class="form-text">
                  {{
                    $t('playnite.policy_explainer') ||
                    'Choose how Vibepollo removes old auto-synced games.'
                  }}
                </div>
              </div>
              <div class="md:col-span-2">
                <Checkbox
                  id="playnite_autosync_remove_uninstalled"
                  v-model="config.playnite_autosync_remove_uninstalled"
                  :default="store.defaults.playnite_autosync_remove_uninstalled"
                  locale-prefix="playnite"
                  label="playnite.remove_uninstalled"
                  desc="playnite.remove_uninstalled_desc"
                  :disabled="!autoSyncEnabled"
                />
              </div>
              <div v-if="autoSyncEnabled" class="md:col-span-2 form-text">{{ policySummary }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Launch Behavior card -->
      <div
        class="bg-light/70 dark:bg-surface/70 border border-dark/10 dark:border-light/10 rounded-lg section-card"
      >
        <div class="px-4 pt-3 pb-2 flex items-baseline justify-between section-header">
          <h4 class="text-sm font-semibold">
            {{ $t('playnite.section_launch_behavior') || 'Launch Behavior' }}
          </h4>
          <n-button size="tiny" type="default" strong @click="resetLaunchSection">
            <i class="fas fa-undo" />
            <span class="ml-1">{{ $t('playnite.reset_defaults') || 'Reset to defaults' }}</span>
          </n-button>
        </div>
        <div class="px-4 pb-4 section-body">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 items-start">
            <div class="md:col-span-2">
              <Checkbox
                id="playnite_fullscreen_entry_enabled"
                v-model="config.playnite_fullscreen_entry_enabled"
                :default="store.defaults.playnite_fullscreen_entry_enabled"
                locale-prefix="playnite"
                label="Add 'Playnite (Fullscreen)' to Applications"
                desc="When enabled, Vibepollo adds a launcher entry that opens Playnite in fullscreen desktop mode."
              />
            </div>
            <div>
              <label for="playnite_focus_attempts" class="form-label">{{
                $t('playnite.focus_attempts') || 'Auto-focus attempts'
              }}</label>
              <n-input-number
                id="playnite_focus_attempts"
                v-model:value="config.playnite_focus_attempts"
                :min="0"
                :max="30"
                :show-button="true"
                class="w-32"
              />
              <div class="form-text">
                {{
                  $t('playnite.focus_attempts_help') ||
                  'Number of times to try to bring Playnite windows to the foreground when launching.'
                }}
              </div>
            </div>
            <div>
              <ConfigDurationField
                id="playnite_focus_timeout_secs"
                v-model="config.playnite_focus_timeout_secs"
                :label="
                  String($t('playnite.focus_timeout_secs') || 'Auto-focus timeout window (seconds)')
                "
                :desc="
                  String(
                    $t('playnite.focus_timeout_secs_help') ||
                      'How long auto-focus runs while re-applying focus (0 to disable).',
                  )
                "
                :min="0"
                :max="120"
                size="small"
              />
            </div>
            <div class="md:col-span-2">
              <Checkbox
                id="playnite_focus_exit_on_first"
                v-model="config.playnite_focus_exit_on_first"
                :default="store.defaults.playnite_focus_exit_on_first"
                locale-prefix="playnite"
                label="playnite.focus_exit_on_first"
                desc="playnite.focus_exit_on_first_help"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Exclusions & Filters card -->
      <div
        class="bg-light/70 dark:bg-surface/70 border border-dark/10 dark:border-light/10 rounded-lg"
      >
        <div class="px-4 pt-3 pb-2 flex items-baseline justify-between">
          <h4 class="text-sm font-semibold">
            {{ $t('playnite.section_exclusions_filters') || 'Exclusions & Filters' }}
          </h4>
          <n-button size="tiny" type="default" strong @click="resetFiltersSection">
            <i class="fas fa-undo" />
            <span class="ml-1">{{ $t('playnite.reset_defaults') || 'Reset to defaults' }}</span>
          </n-button>
        </div>
        <div class="px-4 pb-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 items-start">
            <div>
              <label for="playnite_exclude_categories" class="form-label">{{
                $t('playnite.exclude_categories') || 'Exclude categories'
              }}</label>
              <n-tooltip :disabled="!disablePlayniteSelection && autoSyncEnabled" trigger="hover">
                <template #trigger>
                  <n-select
                    id="playnite_exclude_categories"
                    v-model:value="excludedCategories"
                    multiple
                    :options="categoryOptions"
                    filterable
                    tag
                    clearable
                    :placeholder="
                      $t('playnite.categories_placeholder') || 'All categories (default)'
                    "
                    :loading="categoriesLoading"
                    :disabled="disablePlayniteSelection || !autoSyncEnabled"
                    class="w-full"
                    @focus="() => loadCategories()"
                  />
                </template>
                <span
                  >{ !autoSyncEnabled ? $t('playnite.enable_autosync_hint') || 'Enable Auto-sync to
                  edit these settings.' : disabledHint }}</span
                >
              </n-tooltip>
              <div class="form-text">
                {{
                  $t('playnite.exclude_categories_help') ||
                  'Games tagged with these categories will never be auto-synced.'
                }}
              </div>
            </div>
            <div>
              <label for="playnite_exclude_plugins" class="form-label">{{
                $t('playnite.exclude_plugins') || 'Exclude library plugins'
              }}</label>
              <n-tooltip :disabled="!disablePlayniteSelection && autoSyncEnabled" trigger="hover">
                <template #trigger>
                  <n-select
                    id="playnite_exclude_plugins"
                    v-model:value="excludedPlugins"
                    multiple
                    :options="pluginOptions"
                    filterable
                    clearable
                    :placeholder="
                      $t('playnite.plugins_placeholder') || 'All library plugins (default)'
                    "
                    :loading="pluginsLoading"
                    :disabled="disablePlayniteSelection || !autoSyncEnabled"
                    class="w-full"
                    @focus="() => loadPlugins()"
                  />
                </template>
                <span
                  >{ !autoSyncEnabled ? $t('playnite.enable_autosync_hint') || 'Enable Auto-sync to
                  edit these settings.' : disabledHint }}</span
                >
              </n-tooltip>
              <div class="form-text">
                {{
                  $t('playnite.exclude_plugins_help') ||
                  'Games imported from these plugins will never be auto-synced.'
                }}
              </div>
            </div>
            <div class="md:col-span-2">
              <div class="flex flex-col gap-2">
                <label class="form-label">{{
                  $t('playnite.exclude_games') || 'Exclude games from auto-sync'
                }}</label>
                <div class="text-[12px]">
                  <n-alert v-if="limitedNoCache" type="warning" :show-icon="true">
                    {{
                      $t('playnite.games_unavailable_indicator') ||
                      'Cannot retrieve Playnite games right now. Start Playnite to load games.'
                    }}
                  </n-alert>
                  <n-alert v-else-if="limitedWithCache" type="info" :show-icon="true">
                    {{
                      $t('playnite.games_cached_indicator') ||
                      'Showing cached Playnite games due to limited connectivity.'
                    }}
                  </n-alert>
                </div>
                <div class="playnite-exclusions">
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-sm font-medium">
                      {{ $t('playnite.exclude_games_table_title') || 'Excluded Games' }}
                    </div>
                    <div class="flex items-center gap-2">
                      <n-button
                        size="small"
                        type="default"
                        strong
                        :disabled="disablePlayniteSelection"
                        @click="openAddExclusions"
                      >
                        <i class="fas fa-plus" />
                        <span class="ml-1">{{ $t('playnite.add_exclusions') || 'Add' }}</span>
                      </n-button>
                      <n-button
                        size="small"
                        type="default"
                        strong
                        :disabled="!excludedIds.length"
                        @click="clearAllExclusions"
                      >
                        <i class="fas fa-times" />
                        <span class="ml-1">{{ $t('_common.clear_all') || 'Clear All' }}</span>
                      </n-button>
                    </div>
                  </div>
                  <n-data-table
                    :columns="exclusionsColumns"
                    :data="excludedDisplayList"
                    :bordered="true"
                    :single-line="false"
                    :pagination="false"
                    size="small"
                  />
                </div>
                <div class="text-[11px] opacity-60">
                  <span v-if="gamesSource === 'live'">{{
                    $t('playnite.games_loaded_live') || 'Loaded from Playnite'
                  }}</span>
                  <span v-else-if="gamesSource === 'cache'"
                    >{{ $t('playnite.games_loaded_cache') || 'Loaded from cache'
                    }}<template v-if="gamesCacheTime">
                      — {{ new Date(gamesCacheTime).toLocaleString() }}</template
                    ></span
                  >
                  <span v-else>{{
                    $t('playnite.games_not_available') ||
                    'No games available. Start Playnite to fetch games.'
                  }}</span>
                </div>
                <div class="form-text">
                  {{
                    $t('playnite.exclude_games_desc') ||
                    'Selected games will not be auto-synced from Playnite.'
                  }}
                </div>
                <div class="form-text">
                  {{ $t('playnite.exclusions_override_note') || 'Exclusions override categories.' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
  <!-- Uninstall confirmation -->
  <n-modal :show="showDeleteAutosyncConfirm" @update:show="(v) => (showDeleteAutosyncConfirm = v)">
    <n-card :bordered="false" style="max-width: 32rem; width: 100%">
      <template #header>
        <div class="flex items-center gap-2">
          <i class="fas fa-trash" />
          <span>{{ $t('playnite.delete_autosync_title') || 'Delete auto-synced games?' }}</span>
        </div>
      </template>
      <div class="space-y-2 text-sm">
        <p>
          {{
            $t('playnite.delete_autosync_body') ||
            'This removes every Playnite-managed auto-sync entry from the Applications list. Apps added manually are not affected.'
          }}
        </p>
      </div>
      <template #footer>
        <div class="w-full flex items-center justify-center gap-3">
          <n-button type="default" strong @click="showDeleteAutosyncConfirm = false">{{
            $t('_common.cancel') || 'Cancel'
          }}</n-button>
          <n-button
            type="error"
            strong
            :loading="deletingAutosync"
            @click="confirmDeleteAutosync"
            >{{ $t('_common.continue') || 'Continue' }}</n-button
          >
        </div>
      </template>
    </n-card>
  </n-modal>

  <n-modal :show="showUninstallConfirm" @update:show="(v) => (showUninstallConfirm = v)">
    <n-card :bordered="false" style="max-width: 32rem; width: 100%">
      <template #header>
        <div class="flex items-center gap-2">
          <i class="fas fa-trash" />
          <span>{{ $t('playnite.uninstall_button') || 'Uninstall Plugin' }}</span>
        </div>
      </template>
      <div class="text-sm">
        {{
          $t('playnite.uninstall_requires_restart') ||
          'Uninstalling the Playnite plugin may require restarting Playnite. Continue?'
        }}
      </div>
      <template #footer>
        <div class="w-full flex items-center justify-center gap-3">
          <n-button type="default" strong @click="showUninstallConfirm = false">{{
            $t('_common.cancel')
          }}</n-button>
          <n-button type="error" strong :loading="uninstalling" @click="confirmUninstall">{{
            $t('_common.continue') || 'Continue'
          }}</n-button>
        </div>
      </template>
    </n-card>
  </n-modal>

  <!-- Add Exclusions modal -->
  <n-modal :show="showAddModal" @update:show="(v) => (showAddModal = v)">
    <n-card
      :bordered="false"
      style="max-width: 40rem; width: 100%; height: auto; max-height: calc(100dvh - 2rem)"
    >
      <template #header>
        <div class="flex items-center gap-2">
          <i class="fas fa-list-check" />
          <span>{{ $t('playnite.add_exclusions') || 'Add Exclusions' }}</span>
        </div>
      </template>
      <div class="space-y-2">
        <n-select
          v-model:value="addSelection"
          :options="addOptions"
          multiple
          filterable
          clearable
          :loading="gamesLoading"
          :disabled="disablePlayniteSelection"
          :placeholder="$t('playnite.add_exclusions_placeholder') || 'Search and select games'"
          class="w-full"
          @focus="() => loadGames()"
        />
        <div class="text-[12px] opacity-70">
          {{
            $t('playnite.add_exclusions_hint') ||
            'Pick one or more games to exclude from auto-sync.'
          }}
        </div>
      </div>
      <template #footer>
        <div class="w-full flex items-center justify-center gap-3">
          <n-button type="default" strong @click="showAddModal = false">{{
            $t('_common.cancel')
          }}</n-button>
          <n-button type="primary" :disabled="!addSelection.length" @click="confirmAddExclusions">{{
            $t('_common.add') || 'Add'
          }}</n-button>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, onUnmounted, watch, h } from 'vue';
import {
  NInputNumber,
  NSelect,
  NButton,
  NAlert,
  NTag,
  NTooltip,
  NModal,
  NCard,
  NRadioGroup,
  NRadio,
  NDataTable,
  useNotification,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import Checkbox from '@/Checkbox.vue';
import ConfigDurationField from '@/ConfigDurationField.vue';
import { useConfigStore } from '@/stores/config';
import { storeToRefs } from 'pinia';
import { http } from '@/http';
import PlayniteReinstallButton from '@/components/PlayniteReinstallButton.vue';

const store = useConfigStore();
const { config, metadata } = storeToRefs(store);
const platform = computed(() =>
  (metadata.value?.platform || config.value?.platform || '').toLowerCase(),
);
const { t } = useI18n();

function translate(
  key: string,
  fallback: string,
  params?: Record<string, number | string>,
): string {
  const value = params ? t(key, params) : t(key);
  return typeof value === 'string' && value ? value : fallback;
}

type ApiRecord = Record<string, unknown>;

function isApiRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function textValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

const status = reactive<{
  installed?: boolean;
  installed_unknown?: boolean;
  active: boolean;
  enabled?: boolean;
  playnite_running?: boolean;
  extensions_dir: string;
  plugin_version?: string;
  plugin_latest?: string;
}>({ active: false, extensions_dir: '' });
const launching = ref(false);
const uninstalling = ref(false);
const deletingAutosync = ref(false);
const showUninstallConfirm = ref(false);
const showDeleteAutosyncConfirm = ref(false);
// Naive UI notifications for transient messages
const notification = useNotification();
function notify(type: 'success' | 'error' | 'info' | 'warning', content: string) {
  notification.create({ type, content, duration: 5000 });
}

const NULL_GUID = '00000000-0000-0000-0000-000000000000';
const categoriesLoading = ref(false);
const pluginsLoading = ref(false);
const gamesLoading = ref(false);
const categoryOptions = ref<{ label: string; value: string }[]>([]);
const pluginOptions = ref<{ label: string; value: string }[]>([]);
type GameRow = {
  id: string;
  name: string;
  installed?: boolean;
  categories?: string[];
  pluginId?: string;
  pluginName?: string;
};
const gamesList = ref<GameRow[]>([]);
const gamesSource = ref<'live' | 'cache' | 'none'>('none');
const gamesCacheTime = ref<number>();
// Dual-list transfer value mirrors the excluded IDs
const transferValue = ref<string[]>([]);

type IdNameEntry = { id?: string; name?: string };

function normalizeIdNameEntries(value: unknown): IdNameEntry[] {
  if (Array.isArray(value)) return value as IdNameEntry[];
  if (value && typeof value === 'object') return [value as IdNameEntry];
  return [];
}

const selectedCategories = computed<string[]>({
  get() {
    const arr = normalizeIdNameEntries(config.value?.playnite_sync_categories);
    return arr.map((o) => o.id || o.name || '').filter(Boolean);
  },
  set(v: string[]) {
    const mapByVal = new Map(categoryOptions.value.map((o) => [o.value, o.label] as const));
    const next = (v || []).map((val) => ({
      id: val && mapByVal.has(val) ? val : '',
      name: mapByVal.get(val) || val,
    }));
    store.updateOption('playnite_sync_categories', next);
  },
});

const excludedCategories = computed<string[]>({
  get() {
    const arr = normalizeIdNameEntries(config.value?.playnite_exclude_categories);
    return arr.map((o) => o.id || o.name || '').filter(Boolean);
  },
  set(v: string[]) {
    const mapByVal = new Map(categoryOptions.value.map((o) => [o.value, o.label] as const));
    const next = (v || []).map((val) => ({
      id: val && mapByVal.has(val) ? val : '',
      name: mapByVal.get(val) || val,
    }));
    store.updateOption('playnite_exclude_categories', next);
  },
});

const excludedPlugins = computed<string[]>({
  get() {
    const arr = normalizeIdNameEntries(config.value?.playnite_exclude_plugins);
    return arr.map((o) => o.id || o.name || '').filter(Boolean);
  },
  set(v: string[]) {
    const mapByVal = new Map(pluginOptions.value.map((o) => [o.value, o.label] as const));
    const next = (v || []).map((val) => ({
      id: val && mapByVal.has(val) ? val : '',
      name: mapByVal.get(val) || val,
    }));
    store.updateOption('playnite_exclude_plugins', next);
  },
});

const includedPlugins = computed<string[]>({
  get() {
    const arr = normalizeIdNameEntries(config.value?.playnite_sync_plugins);
    return arr.map((o) => o.id || o.name || '').filter(Boolean);
  },
  set(v: string[]) {
    const mapByVal = new Map(pluginOptions.value.map((o) => [o.value, o.label] as const));
    const next = (v || []).map((val) => ({
      id: val && mapByVal.has(val) ? val : '',
      name: mapByVal.get(val) || val,
    }));
    store.updateOption('playnite_sync_plugins', next);
  },
});

const excludedIds = computed<string[]>({
  get() {
    const arr = normalizeIdNameEntries(config.value?.playnite_exclude_games);
    return arr.map((o) => o.id || '').filter(Boolean);
  },
  set(v: string[]) {
    const nameById = new Map(gamesList.value.map((g) => [g.id, g.name] as const));
    const next = (v || []).map((id) => ({ id, name: nameById.get(id) || '' }));
    store.updateOption('playnite_exclude_games', next);
  },
});

// Build the display list of current exclusions, resolving names from cache if missing
const excludedDisplayList = computed<Array<{ id: string; name: string }>>(() => {
  const arr = normalizeIdNameEntries(config.value?.playnite_exclude_games);
  const nameById = new Map(gamesList.value.map((g) => [g.id, g.name] as const));
  return (arr || []).map(({ id, name }) => {
    const resolvedId = id ?? '';
    return { id: resolvedId, name: name || nameById.get(resolvedId) || '' };
  });
});

// Connectivity indicator helpers for transfer UI
const limitedConnectivity = computed(() => statusKind.value !== 'active');
const hasCachedGames = computed(
  () =>
    gamesSource.value === 'cache' || (Array.isArray(gamesList.value) && gamesList.value.length > 0),
);
const limitedNoCache = computed(() => limitedConnectivity.value && !hasCachedGames.value);
const limitedWithCache = computed(() => limitedConnectivity.value && hasCachedGames.value);

async function refreshStatus() {
  if (platform.value !== 'windows') return;
  try {
    const r = await http.get('/api/playnite/status');
    if (r.status === 200 && isApiRecord(r.data)) {
      const d = r.data;
      if (typeof d['installed'] === 'boolean') {
        status.installed = d['installed'];
      } else {
        delete status.installed;
      }
      status.active = Boolean(d['active']);
      // 'enabled' is no longer a config; presence is indicated by 'installed'
      if (typeof d['playnite_running'] === 'boolean') {
        status.playnite_running = d['playnite_running'];
      }
      status.extensions_dir = stringValue(d['extensions_dir']);
      const installedVersion =
        stringValue(d['installed_version']) ||
        stringValue(d['plugin_version']) ||
        stringValue(d['version']);
      if (installedVersion) status.plugin_version = installedVersion;
      const packagedVersion =
        stringValue(d['packaged_version']) ||
        stringValue(d['plugin_latest']) ||
        stringValue(d['latest_version']);
      if (packagedVersion) status.plugin_latest = packagedVersion;
    }
  } catch (error) {
    void error;
  }
}

const diagnosticText = computed<string>(() => {
  switch (statusKind.value) {
    case 'uninstalled':
      return translate(
        'playnite.diagnostic_not_installed',
        'Playnite plugin is not installed in the Extensions directory.',
      );
    case 'waiting':
      return translate(
        'playnite.diagnostic_not_running',
        'Playnite is not running. Launch it to resume syncing.',
      );
    case 'active':
      return '';
    default:
      return '';
  }
});

async function loadCategories() {
  if (platform.value !== 'windows') return;
  if (categoriesLoading.value || categoryOptions.value.length) return;
  categoriesLoading.value = true;
  try {
    // Prefer categories endpoint if available
    try {
      const rc = await http.get('/api/playnite/categories', { validateStatus: () => true });
      if (rc.status >= 200 && rc.status < 300 && Array.isArray(rc.data) && rc.data.length) {
        const cats = rc.data
          .map((c) => {
            if (isApiRecord(c)) {
              const id = textValue(c['id']);
              const name = textValue(c['name']) || id;
              return { label: name, value: id || name };
            }
            const value = textValue(c);
            return value ? { label: value, value } : undefined;
          })
          .filter((option): option is { label: string; value: string } => option !== undefined)
          .sort((a, b) => a.label.localeCompare(b.label));
        categoryOptions.value = cats;
        categoriesLoading.value = false;
        return;
      }
    } catch (error) {
      void error;
    }
    // Fallback: derive from games list
    const rg = await http.get('/api/playnite/games');
    const games: unknown[] = Array.isArray(rg.data) ? rg.data : [];
    const set = new Set<string>();
    for (const game of games) {
      if (!isApiRecord(game)) continue;
      for (const category of stringArray(game['categories'])) if (category) set.add(category);
    }
    categoryOptions.value = Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ label: c, value: c }));
  } catch (error) {
    void error;
  }
  categoriesLoading.value = false;
}

function ensurePluginOptionsIncludeSelection() {
  const current = pluginOptions.value.slice();
  const byValue = new Map(current.map((o) => [o.value, o] as const));
  const selected = [
    ...normalizeIdNameEntries(config.value?.playnite_exclude_plugins),
    ...normalizeIdNameEntries(config.value?.playnite_sync_plugins),
  ];
  let changed = false;
  for (const entry of selected || []) {
    const value = entry?.id || entry?.name || '';
    if (!value || value === NULL_GUID) continue;
    const label = entry?.name || entry?.id || value;
    if (!byValue.has(value)) {
      const option = { value, label };
      current.push(option);
      byValue.set(value, option);
      changed = true;
    } else {
      const existing = byValue.get(value);
      if (existing && !existing.label && label) {
        existing.label = label;
        changed = true;
      }
    }
  }
  if (changed) {
    pluginOptions.value = current.sort((a, b) => a.label.localeCompare(b.label));
  }
}

async function loadPlugins() {
  if (platform.value !== 'windows') return;
  if (pluginsLoading.value || pluginOptions.value.length) {
    ensurePluginOptionsIncludeSelection();
    return;
  }
  pluginsLoading.value = true;
  try {
    const map = new Map<string, string>();
    const ingestGames = (rows: GameRow[]) => {
      for (const g of rows) {
        if (!g) continue;
        const pid = g.pluginId ? String(g.pluginId) : '';
        const pname = g.pluginName ? String(g.pluginName) : '';
        if (!pid || pid === NULL_GUID) continue;
        if (!map.has(pid)) {
          map.set(pid, pname || pid);
        } else if (!map.get(pid) && pname) {
          map.set(pid, pname);
        }
      }
    };
    if (gamesList.value.length) {
      ingestGames(gamesList.value);
    }
    if (!map.size) {
      try {
        const rg = await http.get('/api/playnite/games', { validateStatus: () => true });
        if (rg.status >= 200 && rg.status < 300 && Array.isArray(rg.data)) {
          ingestGames(rg.data.map(gameRow));
        }
      } catch (error) {
        void error;
      }
    }
    const opts = Array.from(map.entries())
      .map(([value, label]) => ({ value, label: label || value }))
      .sort((a, b) => a.label.localeCompare(b.label));
    pluginOptions.value = opts;
    ensurePluginOptionsIncludeSelection();
  } finally {
    pluginsLoading.value = false;
  }
}

const GAMES_CACHE_KEY = 'playnite_games_cache_v2';
function saveGamesCache(list: GameRow[]) {
  try {
    const payload = {
      t: Date.now(),
      games: list.map((g) => ({
        id: g.id,
        name: g.name,
        installed: !!g.installed,
        categories: Array.isArray(g.categories) ? g.categories : [],
        pluginId: g.pluginId || '',
        pluginName: g.pluginName || '',
      })),
    };
    localStorage.setItem(GAMES_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    void error;
  }
}
function gameRow(value: unknown): GameRow {
  const game = isApiRecord(value) ? value : {};
  const id = textValue(game['id']);
  return {
    id,
    name: textValue(game['name']) || id,
    installed: Boolean(game['installed']),
    categories: stringArray(game['categories']),
    pluginId: textValue(game['pluginId']),
    pluginName: textValue(game['pluginName']),
  };
}

type GamesCache = { t: number; games: GameRow[] };

function loadGamesCache(): GamesCache | false {
  try {
    const raw = localStorage.getItem(GAMES_CACHE_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (!isApiRecord(parsed) || !Array.isArray(parsed['games'])) return false;
    return {
      t: Number(parsed['t']) || Date.now(),
      games: parsed['games'].map(gameRow),
    };
  } catch (error) {
    void error;
    return false;
  }
}

async function loadGames(useCacheFirst = true) {
  if (platform.value !== 'windows') return;
  if (gamesLoading.value) return;
  gamesLoading.value = true;
  if (useCacheFirst) {
    const cached = loadGamesCache();
    if (cached && cached.games.length) {
      gamesList.value = cached.games.slice().sort((a, b) => a.name.localeCompare(b.name));
      gamesSource.value = 'cache';
      gamesCacheTime.value = cached.t;
    }
  }
  try {
    const r = await http.get('/api/playnite/games', { validateStatus: () => true });
    if (r.status >= 200 && r.status < 300 && Array.isArray(r.data)) {
      const list = r.data
        .map(gameRow)
        .filter((game) => game.installed)
        .sort((a, b) => a.name.localeCompare(b.name));
      gamesList.value = list;
      gamesSource.value = 'live';
      gamesCacheTime.value = Date.now();
      saveGamesCache(list);
    } else if (gamesSource.value === 'none') {
      const cached = loadGamesCache();
      if (cached && cached.games.length) {
        gamesList.value = cached.games.slice().sort((a, b) => a.name.localeCompare(b.name));
        gamesSource.value = 'cache';
        gamesCacheTime.value = cached.t;
      } else {
        gamesSource.value = 'none';
      }
    }
  } catch (_) {
    if (gamesSource.value === 'none') {
      const cached = loadGamesCache();
      if (cached && cached.games.length) {
        gamesList.value = cached.games.slice().sort((a, b) => a.name.localeCompare(b.name));
        gamesSource.value = 'cache';
        gamesCacheTime.value = cached.t;
      }
    }
  }
  gamesLoading.value = false;
}

async function onReinstallDone(res: { ok: boolean; error?: string }) {
  if (res.ok) {
    notify('success', translate('playnite.install_success', 'Plugin installed successfully.'));
    await refreshStatus();
  } else {
    const msg =
      translate('playnite.install_error', 'Failed to install plugin.') +
      (res.error ? `: ${res.error}` : '');
    notify('error', msg);
  }
}

function openDeleteAutosyncConfirm() {
  showDeleteAutosyncConfirm.value = true;
}

async function confirmDeleteAutosync() {
  deletingAutosync.value = true;
  try {
    const r = await http.post('/api/apps/purge_autosync', {}, { validateStatus: () => true });
    const body = isApiRecord(r.data) ? r.data : undefined;
    const ok = r.status >= 200 && r.status < 300 && body?.['status'] === true;
    if (ok) {
      notify(
        'success',
        translate('playnite.delete_autosync_success', 'Removed auto-synced Playnite games.'),
      );
      showDeleteAutosyncConfirm.value = false;
    } else {
      const msg =
        translate(
          'playnite.delete_autosync_error',
          'Failed to delete auto-synced Playnite games.',
        ) + (typeof body?.['error'] === 'string' ? `: ${body['error']}` : '');
      notify('error', msg);
    }
  } catch (error) {
    const detail = isApiRecord(error) ? stringValue(error['message']) : '';
    const msg =
      translate('playnite.delete_autosync_error', 'Failed to delete auto-synced Playnite games.') +
      (detail ? `: ${detail}` : '');
    notify('error', msg);
  }
  deletingAutosync.value = false;
}

function openUninstallConfirm() {
  showUninstallConfirm.value = true;
}

async function confirmUninstall() {
  uninstalling.value = true;
  showUninstallConfirm.value = false;
  try {
    const r = await http.post(
      '/api/playnite/uninstall',
      { restart: true },
      { validateStatus: () => true },
    );
    const body = isApiRecord(r.data) ? r.data : undefined;
    const ok = r.status >= 200 && r.status < 300 && body?.['status'] === true;
    if (ok) {
      notify(
        'success',
        translate('playnite.uninstall_success', 'Plugin uninstalled successfully.'),
      );
      await refreshStatus();
    } else {
      const msg =
        translate('playnite.uninstall_error', 'Failed to uninstall plugin.') +
        (typeof body?.['error'] === 'string' ? `: ${body['error']}` : '');
      notify('error', msg);
    }
  } catch (error) {
    const detail = isApiRecord(error) ? stringValue(error['message']) : '';
    const msg =
      translate('playnite.uninstall_error', 'Failed to uninstall plugin.') +
      (detail ? `: ${detail}` : '');
    notify('error', msg);
  }
  uninstalling.value = false;
}

onMounted(async () => {
  // ensure config is loaded so platform/keys available
  if (!config.value) await store.fetchConfig();
  await refreshStatus();
  // Preload lists so existing selections display with names immediately
  void loadGames();
  void loadCategories();
  void loadPlugins();
  ensurePluginOptionsIncludeSelection();
  // Periodically refresh Playnite status while on Windows
  if (platform.value === 'windows') {
    statusTimer.value = window.setInterval(() => {
      void refreshStatus();
    }, 3000);
  }
  // Initialize transfer value from current exclusions and stay in sync
  transferValue.value = excludedIds.value.slice();
  watch(excludedIds, (v) => {
    transferValue.value = (v || []).slice();
  });
  watch(
    () => config.value?.playnite_exclude_plugins,
    () => {
      ensurePluginOptionsIncludeSelection();
    },
    { deep: true },
  );
  watch(
    () => config.value?.playnite_sync_plugins,
    () => {
      ensurePluginOptionsIncludeSelection();
    },
    { deep: true },
  );
  // no screen-size watchers needed for exclusions table
});
onUnmounted(() => {
  if (statusTimer.value) {
    window.clearInterval(statusTimer.value);
    statusTimer.value = undefined;
  }
  // nothing to unbind
});

const statusKind = computed<'active' | 'waiting' | 'uninstalled' | 'unknown'>(() => {
  if (status.active) return 'active';
  if (!status.extensions_dir) return 'unknown';
  if (status.installed === false) return 'uninstalled';
  if (status.installed === true) return 'waiting';
  return 'unknown';
});
const statusType = computed<'success' | 'warning' | 'error' | 'default'>(() => {
  switch (statusKind.value) {
    case 'active':
      return 'success';
    case 'waiting':
      return 'warning';
    case 'uninstalled':
      return 'error';
    case 'unknown':
      return 'default';
    default:
      return 'default';
  }
});
const statusText = computed<string>(() => {
  switch (statusKind.value) {
    case 'active':
      return t('playnite.status_connected');
    case 'waiting':
      return t('playnite.status_waiting');
    case 'uninstalled':
      return t('playnite.status_uninstalled');
    case 'unknown':
      return translate(
        'playnite.status_unknown',
        translate('playnite.status_not_running_unknown', ''),
      );
    default:
      return '';
  }
});

function cmpSemver(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const na = String(a)
    .replace(/^v/i, '')
    .split('.')
    .map((x) => parseInt(x, 10));
  const nb = String(b)
    .replace(/^v/i, '')
    .split('.')
    .map((x) => parseInt(x, 10));
  const len = Math.max(na.length, nb.length);
  for (let i = 0; i < len; i++) {
    const parsedA = na[i];
    const parsedB = nb[i];
    const va = typeof parsedA === 'number' && Number.isFinite(parsedA) ? parsedA : 0;
    const vb = typeof parsedB === 'number' && Number.isFinite(parsedB) ? parsedB : 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

const pluginOutdated = computed(() => {
  if (status.installed !== true) return false;
  if (!status.plugin_version || !status.plugin_latest) return false;
  return cmpSemver(status.plugin_version, status.plugin_latest) < 0;
});
const canLaunch = computed(() => {
  return !!(status.extensions_dir && status.installed === true && !status.active);
});

const statusTimer = ref<number>();

const autoSyncEnabled = computed<boolean>(() => !!config.value?.playnite_auto_sync);

// Disable category/game selection when Playnite is not fully connected
const disablePlayniteSelection = computed<boolean>(() => statusKind.value !== 'active');
const disabledHint = computed<string>(() => {
  return translate(
    'playnite.selects_disabled_hint',
    'Cannot modify without Playnite connectivity. Start Playnite to continue.',
  );
});

function copyExtensionsPath() {
  try {
    if (status.extensions_dir) void navigator.clipboard?.writeText(status.extensions_dir);
    notify('success', translate('playnite.copied_path', 'Copied path to clipboard.'));
  } catch (error) {
    void error;
  }
}

// old table-based exclusion code removed in favor of action list UI

const policySummary = computed<string>(() => {
  if (!autoSyncEnabled.value) return '';
  const n = Number(config.value?.playnite_recent_games ?? 0);
  const days = Number(config.value?.playnite_recent_max_age_days ?? 0);
  const pruneDays = Number(config.value?.playnite_autosync_delete_after_days ?? 0);
  const keepUntilReplaced = !!config.value?.playnite_autosync_require_replacement;
  const syncAll = !!config.value?.playnite_sync_all_installed;
  const includePluginCount = normalizeIdNameEntries(config.value?.playnite_sync_plugins).length;
  const removeUninstalled = config.value?.playnite_autosync_remove_uninstalled !== false;
  const parts: string[] = [];
  parts.push(
    translate(
      'playnite.summary_recent_limit',
      `Up to ${n} most-recently played games will be auto-synced.`,
      { n },
    ),
  );
  parts.push(
    days > 0
      ? translate('playnite.summary_activity_window', `Activity window: last ${days} days.`, {
          days,
        })
      : translate('playnite.summary_activity_ignored', 'Activity window is ignored.'),
  );
  parts.push(
    keepUntilReplaced
      ? translate(
          'playnite.summary_keep_until_replaced',
          'Games stay until a newer game replaces them.',
        )
      : translate(
          'playnite.summary_prune_immediately',
          'Games are pruned when they no longer qualify.',
        ),
  );
  if (syncAll) {
    parts.push(
      translate(
        'playnite.summary_all_installed',
        'All installed Playnite games will be kept in Vibepollo.',
      ),
    );
  } else if (includePluginCount > 0) {
    parts.push(
      translate(
        'playnite.summary_plugin_include',
        `Includes every game from ${includePluginCount} selected library plugins.`,
        { count: includePluginCount },
      ),
    );
  }
  if (pruneDays > 0) {
    parts.push(
      translate(
        'playnite.summary_delete_after',
        `Also remove games never launched after ${pruneDays} days.`,
        { days: pruneDays },
      ),
    );
  }
  parts.push(
    removeUninstalled
      ? translate(
          'playnite.summary_remove_uninstalled_on',
          'Uninstalled games are removed automatically.',
        )
      : translate(
          'playnite.summary_remove_uninstalled_off',
          'Uninstalled games remain until removed manually.',
        ),
  );
  const excluded = (
    (config.value?.playnite_exclude_categories || []) as Array<{
      id: string;
      name: string;
    }>
  )
    .map((o) => (o?.name || o?.id || '').toString().trim())
    .filter(Boolean);
  if (excluded.length) {
    const shown = excluded.slice(0, 3);
    const sample = shown.join(', ');
    const more = excluded.length > shown.length ? excluded.length - shown.length : 0;
    if (more > 0) {
      parts.push(
        translate(
          'playnite.summary_excluded_categories_more',
          `Excluded categories: ${sample} (+${more} more).`,
          {
            categories: sample,
            count: more,
          },
        ),
      );
    } else {
      parts.push(
        translate('playnite.summary_excluded_categories', `Excluded categories: ${sample}.`, {
          categories: sample,
        }),
      );
    }
  }
  return parts.join(' ');
});

async function launchPlaynite() {
  if (platform.value !== 'windows' || !canLaunch.value) return;
  launching.value = true;
  try {
    await http.post('/api/playnite/launch', {}, { validateStatus: () => true });
    window.setTimeout(() => {
      void refreshStatus();
    }, 1000);
  } catch (error) {
    void error;
  }
  launching.value = false;
}

// --- Exclusions update helpers --------------------------------------------
function handleTransferUpdate(next: string[]) {
  const nextSet = new Set(next);
  const final = Array.from(nextSet);
  excludedIds.value = final;
  transferValue.value = final;
  // No toast for additions per design
  // No toast for removals per design
}

// --- Reset to defaults (per section) ---------------------------------------
function resetAutoSyncSection() {
  const d = store.defaults;
  store.updateOption('playnite_auto_sync', d.playnite_auto_sync);
  store.updateOption('playnite_sync_all_installed', d.playnite_sync_all_installed);
  store.updateOption('playnite_recent_games', d.playnite_recent_games);
  store.updateOption('playnite_recent_max_age_days', d.playnite_recent_max_age_days);
  store.updateOption('playnite_autosync_delete_after_days', d.playnite_autosync_delete_after_days);
  store.updateOption(
    'playnite_autosync_require_replacement',
    d.playnite_autosync_require_replacement,
  );
  store.updateOption(
    'playnite_autosync_remove_uninstalled',
    d.playnite_autosync_remove_uninstalled,
  );
  store.updateOption('playnite_sync_categories', d.playnite_sync_categories);
  store.updateOption('playnite_sync_plugins', d.playnite_sync_plugins);
  notify('success', translate('playnite.reset_done', 'Section reset to defaults.'));
}

function resetLaunchSection() {
  const d = store.defaults;
  store.updateOption('playnite_focus_attempts', d.playnite_focus_attempts);
  store.updateOption('playnite_focus_timeout_secs', d.playnite_focus_timeout_secs);
  store.updateOption('playnite_focus_exit_on_first', d.playnite_focus_exit_on_first);
  notify('success', translate('playnite.reset_done', 'Section reset to defaults.'));
}

function resetFiltersSection() {
  const d = store.defaults;
  store.updateOption('playnite_exclude_categories', d.playnite_exclude_categories);
  store.updateOption('playnite_exclude_plugins', d.playnite_exclude_plugins);
  store.updateOption('playnite_exclude_games', d.playnite_exclude_games);
  notify('success', translate('playnite.reset_done', 'Section reset to defaults.'));
}

// Data table columns and actions
type ExcludedRow = { id: string; name: string };
const exclusionsColumns = computed(() => [
  { title: translate('playnite.table_game', 'Game'), key: 'name' },
  {
    title: translate('playnite.table_actions', 'Actions'),
    key: 'actions',
    width: 120,
    render: (row: ExcludedRow) =>
      h('div', { class: 'flex items-center gap-2 justify-end' }, [
        h(
          NButton,
          { type: 'error', size: 'tiny', strong: true, onClick: () => removeExclusion(row.id) },
          {
            default: () => [
              h('i', { class: 'fas fa-trash' }),
              h('span', { class: 'ml-1' }, translate('_common.remove', 'Remove')),
            ],
          },
        ),
      ]),
  },
]);

function removeExclusion(id: string) {
  const next = transferValue.value.filter((x) => x !== id);
  handleTransferUpdate(next);
}

function clearAllExclusions() {
  handleTransferUpdate([]);
}

// Add modal state and actions
const showAddModal = ref(false);
const addSelection = ref<string[]>([]);
const addOptions = computed(() => {
  const excluded = new Set(excludedIds.value);
  return gamesList.value
    .filter((g) => !excluded.has(g.id))
    .map((g) => ({
      label: g.name || translate('playnite.unknown_game', 'Unknown'),
      value: g.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

function openAddExclusions() {
  addSelection.value = [];
  showAddModal.value = true;
  void loadGames();
}
function confirmAddExclusions() {
  const merged = Array.from(new Set([...transferValue.value, ...addSelection.value]));
  handleTransferUpdate(merged);
  showAddModal.value = false;
}
</script>

<style scoped>
/* No global heights for transfer lists; only adjust on mobile below */
/* Compact nested cards and responsive actions on small screens */
@media (max-width: 640px) {
  .playnite-tab .playnite-card {
    padding: 0.75rem !important; /* reduce p-4 */
  }
  .playnite-tab .section-card .section-header {
    padding-left: 0.75rem !important;
    padding-right: 0.75rem !important;
    padding-top: 0.5rem !important;
    padding-bottom: 0.25rem !important;
  }
  .playnite-tab .section-card .section-body {
    padding-left: 0.75rem !important;
    padding-right: 0.75rem !important;
    padding-bottom: 0.75rem !important;
  }
  /* Stack info rows to avoid cramping */
  .playnite-tab .inline-info {
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
  }
  .playnite-tab .inline-info code {
    max-width: 100%;
  }
  /* Plugin actions: stack and let text wrap to prevent overflow */
  .playnite-tab .playnite-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .playnite-tab .playnite-actions :deep(.n-button) {
    width: 100%;
  }
  .playnite-tab .playnite-actions :deep(.n-button .n-button__content) {
    white-space: normal; /* allow wrapping */
    line-height: 1.2;
    text-align: center;
  }

  /* No special mobile styles needed for exclusions table */
}
</style>
