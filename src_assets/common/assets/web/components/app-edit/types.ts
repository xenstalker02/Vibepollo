export interface PrepCmd {
  do: string;
  undo: string;
  elevated?: boolean;
}

export type LosslessProfileKey = 'recommended' | 'custom';

export type LosslessScalingMode =
  | 'off'
  | 'ls1'
  | 'fsr'
  | 'nis'
  | 'sgsr'
  | 'bcas'
  | 'anime4k'
  | 'xbr'
  | 'sharp-bilinear'
  | 'integer'
  | 'nearest';

export type Anime4kSize = 'S' | 'M' | 'L' | 'VL' | 'UL';

export type FrameGenerationProvider = 'lossless-scaling' | 'nvidia-smooth-motion' | 'game-provided';
export type FrameGenerationMode = 'off' | FrameGenerationProvider;
export type AppVirtualDisplayMode = 'disabled' | 'per_client' | 'shared';
export type AppVirtualDisplayLayout =
  'exclusive' | 'extended' | 'extended_primary' | 'extended_isolated' | 'extended_primary_isolated';

export interface LosslessProfileOverrides {
  performanceMode: Nullable<boolean>;
  flowScale: Nullable<number>;
  resolutionScale: Nullable<number>;
  scalingMode: Nullable<LosslessScalingMode>;
  sharpening: Nullable<number>;
  anime4kSize: Nullable<Anime4kSize>;
  anime4kVrs: Nullable<boolean>;
}

export interface LosslessProfileDefaults {
  performanceMode: boolean;
  flowScale: number;
  resolutionScale: number;
  scalingMode: LosslessScalingMode;
  sharpening: number;
  anime4kSize: Anime4kSize;
  anime4kVrs: boolean;
}

export interface AppForm {
  index: number;
  uuid?: string;
  name: string;
  output: string;
  cmd: string;
  workingDir: string;
  imagePath: string;
  excludeGlobalPrepCmd: boolean;
  excludeGlobalStateCmd: boolean;
  configOverrides: Record<string, unknown>;
  elevated: boolean;
  autoDetach: boolean;
  waitAll: boolean;
  terminateOnPause: boolean;
  allowClientCommands: boolean;
  useAppIdentity: boolean;
  perClientAppIdentity: boolean;
  gamepad: string;
  scaleFactor: number;
  frameGenLimiterFix: boolean;
  exitTimeout: number;
  prepCmd: PrepCmd[];
  stateCmd: PrepCmd[];
  detached: string[];
  virtualScreen: boolean;
  gen1FramegenFix: boolean;
  gen2FramegenFix: boolean;
  virtualDisplayMode: Nullable<AppVirtualDisplayMode>;
  virtualDisplayLayout: Nullable<AppVirtualDisplayLayout>;
  frameGenerationProvider: FrameGenerationProvider;
  frameGenerationMode: FrameGenerationMode;
  losslessScalingEnabled: boolean;
  losslessScalingTargetFps: Nullable<number>;
  losslessScalingRtssLimit: Nullable<number>;
  losslessScalingRtssTouched: boolean;
  losslessScalingProfile: LosslessProfileKey;
  losslessScalingProfiles: Record<LosslessProfileKey, LosslessProfileOverrides>;
  losslessScalingLaunchDelay: Nullable<number>;
  playniteId?: string;
  playniteManaged?: string;
  ddConfigurationOption: Nullable<
    'disabled' | 'verify_only' | 'ensure_active' | 'ensure_primary' | 'ensure_only_display'
  >;
}

export interface ServerApp {
  name?: string;
  output?: string;
  cmd?: string | string[];
  uuid?: string;
  'working-dir'?: string;
  'image-path'?: string;
  'exclude-global-prep-cmd'?: boolean;
  'config-overrides'?: Record<string, unknown>;
  elevated?: boolean;
  'auto-detach'?: boolean;
  'wait-all'?: boolean;
  'exclude-global-state-cmd'?: boolean;
  'state-cmd'?: Array<{ do?: string; undo?: string; elevated?: boolean }>;
  'terminate-on-pause'?: boolean;
  'virtual-display'?: boolean;
  'allow-client-commands'?: boolean;
  'use-app-identity'?: boolean;
  'per-client-app-identity'?: boolean;
  gamepad?: string;
  'scale-factor'?: number | string;
  'frame-gen-limiter-fix'?: boolean;
  'exit-timeout'?: number;
  'prep-cmd'?: Array<{ do?: string; undo?: string; elevated?: boolean }>;
  detached?: string[];
  'virtual-screen'?: boolean;
  'playnite-id'?: string;
  'playnite-managed'?: string;
  'gen1-framegen-fix'?: boolean;
  'gen2-framegen-fix'?: boolean;
  'dlss-framegen-capture-fix'?: boolean;
  'frame-generation-provider'?: string;
  'frame-generation-mode'?: string;
  'lossless-scaling-enabled'?: boolean;
  'lossless-scaling-framegen'?: boolean;
  'lossless-scaling-target-fps'?: Nullable<number | string>;
  'lossless-scaling-rtss-limit'?: Nullable<number | string>;
  'lossless-scaling-profile'?: string;
  'lossless-scaling-recommended'?: Record<string, unknown>;
  'lossless-scaling-custom'?: Record<string, unknown>;
  'lossless-scaling-launch-delay'?: Nullable<number | string>;
  'virtual-display-mode'?: string;
  'virtual-display-layout'?: string;
  'dd-configuration-option'?: string;
}

export type FrameGenRequirementStatus = 'pass' | 'warn' | 'fail' | 'unknown';

export interface FrameGenDisplayTarget {
  fps: number;
  requiredHz: number;
  supported: Nullable<boolean>;
}

export interface FrameGenHealth {
  checkedAt: number;
  capture: {
    status: FrameGenRequirementStatus;
    method: string;
    message: string;
  };
  rtss: {
    status: FrameGenRequirementStatus;
    installed: boolean;
    running: boolean;
    hooksDetected: boolean;
    message: string;
  };
  display: {
    status: FrameGenRequirementStatus;
    deviceLabel: string;
    deviceId: string;
    currentHz: Nullable<number>;
    targets: FrameGenDisplayTarget[];
    virtualActive: boolean;
    message: string;
    error?: Nullable<string>;
  };
  suggestion?: {
    message: string;
    emphasis: 'info' | 'warning';
  };
}
const nullValue = () => null;

/** Runtime null sentinel used by the application configuration protocol. */
export type Nullish = ReturnType<typeof nullValue>;

export type Nullable<T> = T | Nullish;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
