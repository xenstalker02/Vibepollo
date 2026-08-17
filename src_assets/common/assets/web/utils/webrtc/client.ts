import { WebRtcApi } from '@/services/webrtcApi';
import { GamepadFeedbackMessage, StreamConfig, WebRtcStatsSnapshot } from '@/types/webrtc';

const NULL_VALUE = null;
const UNDEFINED_VALUE = undefined;
type NullValue = typeof NULL_VALUE;
type UndefinedValue = typeof UNDEFINED_VALUE;
type RtpCodecCapability = RTCRtpCapabilities['codecs'][number];
type ReceiverParameters = RTCRtpReceiveParameters & { jitterBufferTarget?: number };
type ExtendedReceiver = RTCRtpReceiver & {
  playoutDelayHint?: number;
  jitterBufferTarget?: number;
  getParameters: () => ReceiverParameters;
  setParameters?: (parameters: ReceiverParameters) => Promise<void>;
};
type BrowserRTCConfiguration = Omit<RTCConfiguration, 'rtcpMuxPolicy'> & {
  rtcpMuxPolicy?: 'require' | 'negotiate';
};
type BrowserDataChannelInit = RTCDataChannelInit & { priority: RTCPriorityType };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

type MediaPlayTarget = { play: () => unknown };
type CatchablePlayResult = { catch: (handler: (error: unknown) => void) => unknown };

function isCatchablePlayResult(value: unknown): value is CatchablePlayResult {
  return isRecord(value) && typeof value['catch'] === 'function';
}

export function playMediaElement(
  element: MediaPlayTarget,
  onError?: (error: unknown) => void,
): void {
  let result: unknown;
  try {
    result = element.play();
  } catch (error) {
    onError?.(error);
    return;
  }
  if (!isCatchablePlayResult(result)) return;
  try {
    result.catch((error) => onError?.(error));
  } catch (error) {
    onError?.(error);
  }
}

function readNumber(
  value: Record<string, unknown> | UndefinedValue,
  key: string,
): number | UndefinedValue {
  const field = value?.[key];
  return typeof field === 'number' ? field : undefined;
}

function readString(
  value: Record<string, unknown> | UndefinedValue,
  key: string,
): string | UndefinedValue {
  const field = value?.[key];
  return typeof field === 'string' ? field : undefined;
}

function readBoolean(
  value: Record<string, unknown> | UndefinedValue,
  key: string,
): boolean | UndefinedValue {
  const field = value?.[key];
  return typeof field === 'boolean' ? field : undefined;
}

export interface WebRtcClientCallbacks {
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  onIceState?: (state: RTCIceConnectionState) => void;
  onInputChannelState?: (state: RTCDataChannelState) => void;
  onStats?: (stats: WebRtcStatsSnapshot) => void;
  onInputMessage?: (message: GamepadFeedbackMessage) => void;
  onNegotiatedEncoding?: (encoding: string) => void;
  onWarning?: (warning: string) => void;
  onError?: (error: Error) => void;
}

export interface WebRtcClientConnectOptions {
  inputPriority?: RTCPriorityType;
}

export interface WebRtcDisconnectOptions {
  keepalive?: boolean;
}

interface StatsState {
  lastVideoInboundId?: string;
  lastAudioInboundId?: string;
  lastVideoBytes?: number;
  lastAudioBytes?: number;
  lastTimestampMs?: number;
  lastVideoJitterBufferDelay?: number;
  lastVideoJitterBufferEmittedCount?: number;
  lastAudioJitterBufferDelay?: number;
  lastAudioJitterBufferEmittedCount?: number;
  lastVideoTotalDecodeTime?: number;
  lastVideoFramesDecoded?: number;
  lastVideoFramesReceived?: number;
}

const ENCODING_MIME: Record<string, string[]> = {
  h264: ['video/h264'],
  hevc: ['video/h265', 'video/hevc'],
  av1: ['video/av1'],
};
const DEFAULT_AUDIO_JITTER_TARGET_MS = 20;
const DEFAULT_AUDIO_PLAYOUT_DELAY_MS = 20;
const RECEIVER_HINT_REFRESH_MS = 250;
const STATS_POLL_FAST_MS = 250;
const STATS_POLL_SLOW_MS = 1000;
const STATS_POLL_FAST_BOOT_MS = 10000;
const STATS_POLL_FAST_HOLD_MS = 2500;
const STATS_POLL_FAST_JITTER_THRESHOLD_MS = 60;
const ICE_CANDIDATE_BATCH_WINDOW_MS = 75;
const ICE_CANDIDATE_BATCH_LIMIT = 256;

function getVideoCodecCapabilities(): RTCRtpCapabilities | NullValue {
  try {
    const receiverCaps =
      typeof RTCRtpReceiver !== 'undefined' ? RTCRtpReceiver.getCapabilities?.('video') : null;
    if (receiverCaps?.codecs?.length) return receiverCaps;
  } catch {
    /* ignore */
  }
  try {
    const senderCaps =
      typeof RTCRtpSender !== 'undefined' ? RTCRtpSender.getCapabilities?.('video') : null;
    if (senderCaps?.codecs?.length) return senderCaps;
  } catch {
    /* ignore */
  }
  return null;
}

function parseFmtpParams(fmtpLine?: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!fmtpLine) return params;
  for (const entry of fmtpLine.split(';')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      params[trimmed.toLowerCase()] = '';
      continue;
    }
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    const value = trimmed.slice(eq + 1).trim();
    if (key) {
      params[key] = value;
    }
  }
  return params;
}

export function hasPacketizationMode1(fmtpLine?: string): boolean {
  return /(?:^|;)\s*packetization-mode=1(?:;|$)/i.test(fmtpLine ?? '');
}

export function rewriteFmtp(params: string[], bitrateKbps?: number): string[] {
  const rewritten = [...params];
  if (bitrateKbps === undefined || rewritten.some((param) => /(?:^|\s)apt=\d+/i.test(param))) {
    return rewritten;
  }

  const bitrateParam = `x-google-start-bitrate=${bitrateKbps}`;
  const bitrateIndex = rewritten.findIndex((param) => /x-google-start-bitrate=\d+/i.test(param));
  if (bitrateIndex === -1) {
    rewritten.push(bitrateParam);
  } else {
    const current = rewritten[bitrateIndex];
    if (current !== undefined) {
      rewritten[bitrateIndex] = current.replace(/x-google-start-bitrate=\d+/i, bitrateParam);
    }
  }
  return rewritten;
}

function getFmtpParam(fmtpLine: string | UndefinedValue, key: string): string | NullValue {
  const params = parseFmtpParams(fmtpLine);
  const value = params[key.toLowerCase()];
  if (value === undefined || value === '') return null;
  return value;
}

function getCodecCapsForEncoding(encoding: string): RtpCodecCapability[] {
  const mimes = ENCODING_MIME[encoding.toLowerCase()];
  if (!mimes) return [];
  const caps = getVideoCodecCapabilities();
  if (!caps?.codecs?.length) return [];
  return caps.codecs.filter((codec) => mimes.includes(codec.mimeType.toLowerCase()));
}

function isHevcHdrCodec(codec: RtpCodecCapability): boolean {
  const profileId = getFmtpParam(codec.sdpFmtpLine ?? undefined, 'profile-id');
  if (!profileId) {
    return false;
  }
  return profileId !== '1';
}

function hasHevcHdrSupport(): boolean {
  const hevcCaps = getCodecCapsForEncoding('hevc');
  return hevcCaps.some((codec) => isHevcHdrCodec(codec));
}

function supportsHdrEncoding(encoding: string): boolean {
  const normalized = encoding.toLowerCase();
  if (normalized === 'hevc') {
    return hasHevcHdrSupport();
  }
  if (normalized === 'av1') {
    return getCodecCapsForEncoding('av1').length > 0;
  }
  return false;
}

function getOfferedVideoCodecNames(sdp: string): Set<string> {
  const codecs = new Set<string>();
  if (!sdp) return codecs;
  const lines = sdp.split(/\r\n/);
  let inVideo = false;

  for (const line of lines) {
    if (line.startsWith('m=')) {
      inVideo = line.startsWith('m=video');
      continue;
    }
    if (!inVideo || !line.startsWith('a=rtpmap:')) continue;
    const rest = line.slice('a=rtpmap:'.length);
    const space = rest.indexOf(' ');
    if (space < 0) continue;
    const codecPart = rest.slice(space + 1).trim();
    if (!codecPart) continue;
    const slash = codecPart.indexOf('/');
    const codecName = (slash >= 0 ? codecPart.slice(0, slash) : codecPart).trim();
    if (codecName) codecs.add(codecName.toLowerCase());
  }

  return codecs;
}

function offerSupportsEncoding(sdp: string, encoding: string): boolean {
  const offered = getOfferedVideoCodecNames(sdp);
  if (!offered.size) return false;
  const normalized = encoding.toLowerCase();
  if (normalized === 'hevc') return offered.has('h265') || offered.has('hevc');
  if (normalized === 'av1') return offered.has('av1') || offered.has('av1x');
  if (normalized === 'h264') return offered.has('h264');
  return true;
}

function parseOfferedCodecNamesFromError(message: string): Set<string> {
  const offered = new Set<string>();
  const match = message.match(/\(offered:\s*([^)]+)\)\s*$/i);
  const matchedCodecs = match?.[1];
  if (matchedCodecs === undefined) return offered;
  const raw = matchedCodecs.trim();
  if (!raw || raw.toLowerCase() === 'none') return offered;
  for (const part of raw.split(',')) {
    const name = part.trim().toLowerCase();
    if (name) offered.add(name);
  }
  return offered;
}

function applyCodecPreferences(
  transceiver: RTCRtpTransceiver | NullValue,
  encoding: string,
  preferHdr = false,
): void {
  if (!transceiver) return;
  const caps = getVideoCodecCapabilities();
  if (!caps?.codecs) return;
  const mimes = ENCODING_MIME[encoding.toLowerCase()];
  if (!mimes) return;
  const preferred = caps.codecs.filter((codec) => mimes.includes(codec.mimeType.toLowerCase()));
  if (!preferred.length) return;
  let filteredPreferred = preferred;
  if (preferHdr && (mimes.includes('video/hevc') || mimes.includes('video/h265'))) {
    const hdrPreferred = preferred.filter((codec) => isHevcHdrCodec(codec));
    if (hdrPreferred.length) {
      filteredPreferred = hdrPreferred;
    }
  }
  if (mimes.includes('video/h264')) {
    const packetizationMode1 = preferred.filter((codec) =>
      hasPacketizationMode1(codec.sdpFmtpLine),
    );
    if (packetizationMode1.length) {
      // Prefer H.264 packetization-mode=1 to avoid receiver assembly mismatches.
      filteredPreferred = packetizationMode1;
    }
  }
  const rest = caps.codecs.filter((codec) => !mimes.includes(codec.mimeType.toLowerCase()));
  try {
    transceiver.setCodecPreferences([...filteredPreferred, ...rest]);
  } catch {
    /* ignore */
  }
}

function applyInitialBitrateHints(sdp: string, bitrateKbps?: number): string {
  if (!sdp || !bitrateKbps || bitrateKbps <= 0) return sdp;
  const normalizedBitrateKbps = Math.max(1, Math.round(bitrateKbps));
  const bitrateBps = normalizedBitrateKbps * 1000;
  const lines = sdp.split(/\r\n/);
  const output: string[] = [];
  let inVideo = false;
  let pendingBandwidth = false;

  const pushBandwidth = () => {
    output.push(`b=AS:${normalizedBitrateKbps}`);
    output.push(`b=TIAS:${bitrateBps}`);
  };

  for (const line of lines) {
    if (line.startsWith('m=')) {
      if (inVideo && pendingBandwidth) {
        pushBandwidth();
      }
      inVideo = line.startsWith('m=video');
      pendingBandwidth = inVideo;
      output.push(line);
      continue;
    }

    if (inVideo) {
      if (line.startsWith('c=') && pendingBandwidth) {
        output.push(line);
        pushBandwidth();
        pendingBandwidth = false;
        continue;
      }
      if (line.startsWith('b=AS:') || line.startsWith('b=TIAS:')) {
        continue;
      }
      if (line.startsWith('a=fmtp:')) {
        const match = line.match(/^a=fmtp:(\d+)\s*(.*)$/);
        if (!match) {
          output.push(line);
          continue;
        }
        const payloadType = match[1];
        if (payloadType === undefined) {
          output.push(line);
          continue;
        }
        const params = match[2] ?? '';
        if (/(?:^|;)\s*apt=\d+/i.test(params)) {
          output.push(line);
          continue;
        }
        const trimmed = params.trim();
        const updatedParams = rewriteFmtp(
          trimmed ? trimmed.split(';') : [],
          normalizedBitrateKbps,
        ).join(';');
        output.push(`a=fmtp:${payloadType} ${updatedParams}`);
        continue;
      }
    }

    output.push(line);
  }

  if (inVideo && pendingBandwidth) {
    pushBandwidth();
  }

  const joined = output.join('\r\n');
  return sdp.endsWith('\n') && !joined.endsWith('\r\n') ? `${joined}\r\n` : joined;
}

function applyAudioReceiverHints(
  receiver?: RTCRtpReceiver,
  targetMs?: number,
  playoutDelayHintMs?: number,
): void {
  if (!receiver) return;
  const extendedReceiver = receiver as ExtendedReceiver;
  const target = resolveJitterTargetMs(targetMs);
  const delayHintMs =
    typeof playoutDelayHintMs === 'number' && Number.isFinite(playoutDelayHintMs)
      ? Math.max(0, playoutDelayHintMs)
      : undefined;
  try {
    if (delayHintMs != null && 'playoutDelayHint' in extendedReceiver) {
      extendedReceiver.playoutDelayHint = delayHintMs / 1000;
    }
  } catch {
    /* ignore */
  }
  try {
    if (target != null && typeof extendedReceiver.jitterBufferTarget === 'number') {
      extendedReceiver.jitterBufferTarget = target;
    }
  } catch {
    /* ignore */
  }
  if (target == null) return;
  try {
    if (
      typeof extendedReceiver.getParameters === 'function' &&
      typeof extendedReceiver.setParameters === 'function'
    ) {
      const parameters: ReceiverParameters = extendedReceiver.getParameters();
      if (Object.prototype.hasOwnProperty.call(parameters, 'jitterBufferTarget')) {
        parameters.jitterBufferTarget = target;
        void extendedReceiver.setParameters(parameters);
      }
    }
  } catch {
    /* ignore */
  }
}

function resolveJitterTargetMs(value?: number): number | UndefinedValue {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

const VIDEO_MAX_FRAME_AGE_MIN_MS = 5;
const VIDEO_MAX_FRAME_AGE_MAX_MS = 100;

function resolveVideoJitterTargetMs(config: StreamConfig): number | UndefinedValue {
  const fps =
    typeof config.fps === 'number' && Number.isFinite(config.fps) && config.fps > 0
      ? config.fps
      : 60;
  const minMs = VIDEO_MAX_FRAME_AGE_MIN_MS;
  const maxMs = VIDEO_MAX_FRAME_AGE_MAX_MS;
  if (
    typeof config.videoMaxFrameAgeFrames === 'number' &&
    Number.isFinite(config.videoMaxFrameAgeFrames) &&
    config.videoMaxFrameAgeFrames > 0
  ) {
    const frames = Math.round(config.videoMaxFrameAgeFrames);
    const computed = Math.round((1000 / fps) * frames);
    if (Number.isFinite(computed)) {
      return Math.min(maxMs, Math.max(minMs, computed));
    }
  }
  const targetMs = resolveJitterTargetMs(config.videoMaxFrameAgeMs);
  if (targetMs != null) return Math.min(maxMs, Math.max(minMs, targetMs));
  return undefined;
}

function applyVideoReceiverHints(receiver?: RTCRtpReceiver, targetMs?: number): void {
  if (!receiver) return;
  const target = resolveJitterTargetMs(targetMs);
  if (target == null) return;
  const extendedReceiver = receiver as ExtendedReceiver;
  try {
    if ('playoutDelayHint' in extendedReceiver) {
      extendedReceiver.playoutDelayHint = target / 1000;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof extendedReceiver.jitterBufferTarget === 'number') {
      extendedReceiver.jitterBufferTarget = target;
    }
  } catch {
    /* ignore */
  }
  try {
    if (
      typeof extendedReceiver.getParameters === 'function' &&
      typeof extendedReceiver.setParameters === 'function'
    ) {
      const parameters: ReceiverParameters = extendedReceiver.getParameters();
      if (Object.prototype.hasOwnProperty.call(parameters, 'jitterBufferTarget')) {
        parameters.jitterBufferTarget = target;
        void extendedReceiver.setParameters(parameters);
      }
    }
  } catch {
    /* ignore */
  }
}

export class WebRtcClient {
  private api: WebRtcApi;
  private pc?: RTCPeerConnection;
  private sessionId?: string;
  private remoteStream = new MediaStream();
  private inputChannel?: RTCDataChannel;
  private unsubscribeCandidates?: () => void;
  private statsTimer?: number;
  private statsFastUntilMs?: number;
  private statsConnectedAtMs?: number;
  private statsState: StatsState = {};
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  private pendingLocalCandidates: RTCIceCandidateInit[] = [];
  private pendingLocalCandidatesTimer?: number;
  private autoDisconnectTimer?: number;
  private disconnecting = false;
  private pendingInput: (string | ArrayBuffer)[] = [];
  private maxPendingInput = 256;
  private receiverHintTimer?: number;
  private videoJitterTargetMs?: number;
  private audioJitterTargetMs = DEFAULT_AUDIO_JITTER_TARGET_MS;
  private audioPlayoutDelayHintMs = DEFAULT_AUDIO_PLAYOUT_DELAY_MS;

  constructor(api: WebRtcApi) {
    this.api = api;
  }

  get connectionState(): RTCPeerConnectionState | UndefinedValue {
    return this.pc?.connectionState;
  }

  get inputChannelState(): RTCDataChannelState | UndefinedValue {
    return this.inputChannel?.readyState;
  }

  get inputChannelBufferedAmount(): number | UndefinedValue {
    return this.inputChannel?.bufferedAmount;
  }

  get peerConnection(): RTCPeerConnection | UndefinedValue {
    return this.pc;
  }

  async connect(
    config: StreamConfig,
    callbacks: WebRtcClientCallbacks = {},
    options: WebRtcClientConnectOptions = {},
  ): Promise<string> {
    const hdrRequested = Boolean(config.hdr);

    if (config.encoding.toLowerCase() === 'av1' && getCodecCapsForEncoding('av1').length === 0) {
      const warning =
        "AV1 is selected, but this browser reports no AV1 decode support. This can be a false positive—it's not always possible to know until you try. If you get a black screen, switch to HEVC/H.264.";
      callbacks.onWarning?.(warning);
      console.warn(warning);
    }

    if (hdrRequested) {
      const normalized = config.encoding.toLowerCase();
      if (normalized !== 'hevc' && normalized !== 'av1') {
        const error = new Error('HDR requires HEVC or AV1 video encoding.');
        callbacks.onError?.(error);
        throw error;
      }

      // Browser codec capability reporting is inconsistent (especially for HEVC profiles).
      // Treat this as a hint and allow the negotiation to proceed.
      if (!supportsHdrEncoding(config.encoding)) {
        const warning =
          "HDR is enabled, but this browser reports no HDR-capable decoder/profile for the selected codec. This can be a false positive—it's not always possible to know until you try. If you see a black screen, disable HDR or switch codecs.";
        callbacks.onWarning?.(warning);
        console.warn(warning);
      }
    }

    try {
      return await this.connectAttempt(config, callbacks, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const requested = config.encoding.toLowerCase();
      const isCodecOfferMismatch = message.startsWith(
        'Browser did not offer requested video codec',
      );

      if (
        requested !== 'h264' &&
        (isCodecOfferMismatch || message.includes('Failed to process offer'))
      ) {
        const offered = isCodecOfferMismatch
          ? parseOfferedCodecNamesFromError(message)
          : new Set<string>();
        const hdrRequestedNow = Boolean(config.hdr);
        const candidates: Array<{ encoding: 'hevc' | 'av1' | 'h264'; hdr: boolean; why: string }> =
          [];

        if (hdrRequestedNow) {
          if (requested === 'hevc' && (offered.has('av1') || offered.has('av1x'))) {
            candidates.push({
              encoding: 'av1',
              hdr: true,
              why: 'HEVC was requested but the browser did not offer H265; trying AV1 HDR.',
            });
          } else if (requested === 'av1' && (offered.has('h265') || offered.has('hevc'))) {
            candidates.push({
              encoding: 'hevc',
              hdr: true,
              why: 'AV1 was requested but the browser did not offer AV1; trying HEVC HDR.',
            });
          }
          candidates.push({
            encoding: 'h264',
            hdr: false,
            why: 'HDR/advanced codec negotiation failed; falling back to SDR H.264 for this session.',
          });
        } else {
          candidates.push({
            encoding: 'h264',
            hdr: false,
            why: 'Advanced codec negotiation failed; falling back to H.264 for this session.',
          });
        }

        for (const candidate of candidates) {
          if (candidate.encoding === requested && candidate.hdr === hdrRequestedNow) {
            continue;
          }

          const warning = `${hdrRequestedNow ? 'HDR requested; ' : ''}${candidate.why} (This does not change your saved settings.)`;
          callbacks.onWarning?.(warning);
          console.warn(warning);

          try {
            const id = await this.connectAttempt(
              { ...config, encoding: candidate.encoding, hdr: candidate.hdr },
              callbacks,
              options,
            );
            callbacks.onNegotiatedEncoding?.(candidate.encoding);
            return id;
          } catch {
            /* try next candidate */
          }
        }
      }

      const finalError =
        error instanceof Error ? error : new Error('Failed to establish WebRTC session.');
      callbacks.onError?.(finalError);
      throw finalError;
    }
  }

  private async connectAttempt(
    config: StreamConfig,
    callbacks: WebRtcClientCallbacks = {},
    options: WebRtcClientConnectOptions = {},
  ): Promise<string> {
    await this.disconnect();
    this.clearAutoDisconnectTimer();
    this.disconnecting = false;
    const sessionConfig = config;
    const session = await this.api.createSession(sessionConfig);
    this.sessionId = session.sessionId;
    this.pendingRemoteCandidates = [];
    const videoJitterTargetMs = resolveVideoJitterTargetMs(sessionConfig);
    if (videoJitterTargetMs === undefined) {
      delete this.videoJitterTargetMs;
    } else {
      this.videoJitterTargetMs = videoJitterTargetMs;
    }
    this.audioJitterTargetMs = DEFAULT_AUDIO_JITTER_TARGET_MS;
    this.audioPlayoutDelayHintMs = DEFAULT_AUDIO_PLAYOUT_DELAY_MS;
    delete this.statsFastUntilMs;
    delete this.statsConnectedAtMs;
    const requestedEncoding = sessionConfig.encoding.toLowerCase();
    const bundlePolicy: RTCBundlePolicy = requestedEncoding === 'hevc' ? 'balanced' : 'max-bundle';
    const rtcpMuxPolicy = requestedEncoding === 'hevc' ? 'negotiate' : 'require';
    const peerConfiguration: BrowserRTCConfiguration = {
      iceServers: session.iceServers,
      bundlePolicy,
      rtcpMuxPolicy,
    };
    this.pc = new RTCPeerConnection(peerConfiguration as RTCConfiguration);

    const videoTransceiver = this.pc.addTransceiver('video', { direction: 'recvonly' });
    this.pc.addTransceiver('audio', { direction: 'recvonly' });
    applyCodecPreferences(videoTransceiver, sessionConfig.encoding, Boolean(sessionConfig.hdr));

    const inputPriority = options.inputPriority ?? 'high';
    const inputChannelOptions: BrowserDataChannelInit = {
      ordered: false,
      maxRetransmits: 0,
      priority: inputPriority,
    };
    this.inputChannel = this.pc.createDataChannel('input', inputChannelOptions);
    this.inputChannel.onopen = () => {
      callbacks.onInputChannelState?.('open');
      this.flushPendingInput();
    };
    this.inputChannel.onclose = () => callbacks.onInputChannelState?.('closed');
    this.inputChannel.onerror = () => callbacks.onInputChannelState?.('closing');
    this.inputChannel.onmessage = (event) => {
      if (!callbacks.onInputMessage) return;
      if (typeof event.data !== 'string') return;
      try {
        const message = JSON.parse(event.data) as GamepadFeedbackMessage;
        if (message?.type !== 'gamepad_feedback') return;
        callbacks.onInputMessage(message);
      } catch {
        /* ignore */
      }
    };

    this.pc.ontrack = (event) => {
      const track = event.track;
      const kind = track.kind;
      for (const existing of this.remoteStream.getTracks()) {
        if (existing.kind !== kind) continue;
        this.remoteStream.removeTrack(existing);
        try {
          existing.stop();
        } catch {
          /* ignore */
        }
      }
      const removeTrack = () => {
        this.remoteStream.removeTrack(track);
        track.removeEventListener('ended', removeTrack);
      };
      track.addEventListener('ended', removeTrack);
      this.remoteStream.addTrack(track);
      if (kind === 'audio') {
        applyAudioReceiverHints(
          event.receiver,
          this.audioJitterTargetMs,
          this.audioPlayoutDelayHintMs,
        );
      } else if (kind === 'video') {
        track.contentHint = 'motion';
        applyVideoReceiverHints(event.receiver, this.videoJitterTargetMs);
      }
      callbacks.onRemoteStream?.(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const state = this.pc.connectionState;
      callbacks.onConnectionState?.(state);
      if (state === 'connected') {
        const now = Date.now();
        this.statsConnectedAtMs = now;
        this.statsFastUntilMs = now + STATS_POLL_FAST_BOOT_MS;
        this.clearAutoDisconnectTimer();
        this.startReceiverHintRefresh();
      } else if (state === 'failed' || state === 'closed') {
        this.stopReceiverHintRefresh();
        this.scheduleAutoDisconnect(0);
      } else if (state === 'disconnected') {
        this.stopReceiverHintRefresh();
        this.scheduleAutoDisconnect(5000);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      callbacks.onIceState?.(this.pc.iceConnectionState);
    };

    this.pc.onicecandidate = (event) => {
      if (!event.candidate || !this.sessionId) return;
      this.queueLocalCandidate(event.candidate.toJSON());
    };

    this.unsubscribeCandidates = this.api.subscribeRemoteCandidates(
      session.sessionId,
      (candidate) => {
        if (!this.pc || !candidate) return;
        if (this.pc.remoteDescription) {
          void this.pc.addIceCandidate(candidate).catch(() => {});
          return;
        }
        this.pendingRemoteCandidates.push(candidate);
      },
    );

    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      const mungedOffer: RTCSessionDescriptionInit = {
        type: offer.type,
        sdp: applyInitialBitrateHints(offer.sdp ?? '', sessionConfig.bitrateKbps),
      };
      if (!offerSupportsEncoding(mungedOffer.sdp ?? '', sessionConfig.encoding)) {
        const offered =
          Array.from(getOfferedVideoCodecNames(mungedOffer.sdp ?? '')).join(', ') || 'none';
        throw new Error(
          `Browser did not offer requested video codec '${sessionConfig.encoding}' (offered: ${offered})`,
        );
      }
      await this.pc.setLocalDescription(mungedOffer);
      const answer = await this.api.sendOffer(session.sessionId, {
        type: mungedOffer.type,
        sdp: mungedOffer.sdp ?? '',
      });
      if (!answer?.sdp) {
        throw new Error('WebRTC answer not received');
      }
      try {
        await this.pc.setRemoteDescription(answer);
      } catch (error) {
        const offered =
          Array.from(getOfferedVideoCodecNames(mungedOffer.sdp ?? '')).join(', ') || 'none';
        console.error('Failed to apply WebRTC answer SDP', {
          encoding: sessionConfig.encoding,
          offered,
          offerSdp: mungedOffer.sdp,
          answerSdp: answer.sdp,
          error,
        });
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to apply WebRTC answer SDP (${sessionConfig.encoding}; offered: ${offered}): ${message}`,
        );
      }
      await this.flushPendingCandidates();
    } catch (error) {
      await this.disconnect();
      throw error;
    }

    this.startStatsPolling(callbacks);
    return session.sessionId;
  }

  private queueLocalCandidate(candidate: RTCIceCandidateInit): void {
    if (!candidate?.candidate || !this.sessionId) return;
    this.pendingLocalCandidates.push(candidate);
    if (this.pendingLocalCandidates.length >= ICE_CANDIDATE_BATCH_LIMIT) {
      this.flushLocalCandidates();
      return;
    }
    if (this.pendingLocalCandidatesTimer) return;
    this.pendingLocalCandidatesTimer = window.setTimeout(() => {
      delete this.pendingLocalCandidatesTimer;
      this.flushLocalCandidates();
    }, ICE_CANDIDATE_BATCH_WINDOW_MS);
  }

  private flushLocalCandidates(): void {
    if (!this.sessionId || !this.pendingLocalCandidates.length) return;
    const candidates = this.pendingLocalCandidates;
    this.pendingLocalCandidates = [];
    void this.api.sendIceCandidates(this.sessionId, candidates).catch(() => {});
  }

  async disconnect(options: WebRtcDisconnectOptions = {}): Promise<void> {
    if (this.disconnecting) return;
    this.disconnecting = true;
    this.clearAutoDisconnectTimer();
    this.stopReceiverHintRefresh();
    if (this.statsTimer) {
      window.clearTimeout(this.statsTimer);
      delete this.statsTimer;
    }
    delete this.statsFastUntilMs;
    delete this.statsConnectedAtMs;
    this.unsubscribeCandidates?.();
    delete this.unsubscribeCandidates;
    if (this.inputChannel) {
      try {
        this.inputChannel.close();
      } catch {
        /* ignore */
      }
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        /* ignore */
      }
    }
    if (this.sessionId) {
      try {
        await this.api.endSession(this.sessionId, {
          ...(options.keepalive === undefined ? {} : { keepalive: options.keepalive }),
        });
      } catch {
        /* ignore */
      }
    }
    if (this.pendingLocalCandidatesTimer) {
      window.clearTimeout(this.pendingLocalCandidatesTimer);
      delete this.pendingLocalCandidatesTimer;
    }
    this.remoteStream = new MediaStream();
    this.pendingRemoteCandidates = [];
    this.pendingLocalCandidates = [];
    delete this.pc;
    delete this.sessionId;
    delete this.inputChannel;
    this.pendingInput = [];
    this.statsState = {};
    delete this.videoJitterTargetMs;
    delete this.statsFastUntilMs;
    delete this.statsConnectedAtMs;
    this.disconnecting = false;
  }

  private startReceiverHintRefresh(): void {
    if (this.receiverHintTimer) return;
    this.receiverHintTimer = window.setInterval(() => {
      if (!this.pc) return;
      for (const receiver of this.pc.getReceivers()) {
        if (receiver.track?.kind === 'audio') {
          applyAudioReceiverHints(receiver, this.audioJitterTargetMs, this.audioPlayoutDelayHintMs);
        } else if (receiver.track?.kind === 'video') {
          applyVideoReceiverHints(receiver, this.videoJitterTargetMs);
        }
      }
    }, RECEIVER_HINT_REFRESH_MS);
  }

  private stopReceiverHintRefresh(): void {
    if (!this.receiverHintTimer) return;
    window.clearInterval(this.receiverHintTimer);
    delete this.receiverHintTimer;
  }

  setAudioLatencyTargets(targetMs: number, playoutDelayHintMs?: number): void {
    const resolvedTarget = resolveJitterTargetMs(targetMs) ?? DEFAULT_AUDIO_JITTER_TARGET_MS;
    const resolvedHint =
      typeof playoutDelayHintMs === 'number' && Number.isFinite(playoutDelayHintMs)
        ? Math.max(0, playoutDelayHintMs)
        : resolvedTarget;
    this.audioJitterTargetMs = resolvedTarget;
    this.audioPlayoutDelayHintMs = resolvedHint;
    if (!this.pc) return;
    for (const receiver of this.pc.getReceivers()) {
      if (receiver.track?.kind === 'audio') {
        applyAudioReceiverHints(receiver, this.audioJitterTargetMs, this.audioPlayoutDelayHintMs);
      }
    }
  }

  setVideoLatencyTarget(targetMs?: number): void {
    const resolvedTarget = resolveJitterTargetMs(targetMs);
    if (resolvedTarget === undefined) {
      delete this.videoJitterTargetMs;
    } else {
      this.videoJitterTargetMs = resolvedTarget;
    }
    if (!this.pc) return;
    for (const receiver of this.pc.getReceivers()) {
      if (receiver.track?.kind === 'video') {
        applyVideoReceiverHints(receiver, this.videoJitterTargetMs);
      }
    }
  }

  sendInput(payload: string | ArrayBuffer): boolean {
    if (!this.inputChannel || this.inputChannel.readyState !== 'open') {
      this.queueInput(payload);
      return false;
    }
    try {
      if (typeof payload === 'string') {
        this.inputChannel.send(payload);
      } else {
        this.inputChannel.send(payload);
      }
      return true;
    } catch {
      this.queueInput(payload);
      return false;
    }
  }

  private queueInput(payload: string | ArrayBuffer): void {
    if (this.pendingInput.length >= this.maxPendingInput) {
      this.pendingInput.shift();
    }
    this.pendingInput.push(payload);
  }

  private flushPendingInput(): void {
    if (!this.inputChannel || this.inputChannel.readyState !== 'open') return;
    if (!this.pendingInput.length) return;
    const pending = this.pendingInput;
    this.pendingInput = [];
    for (const payload of pending) {
      try {
        if (typeof payload === 'string') {
          this.inputChannel.send(payload);
        } else {
          this.inputChannel.send(payload);
        }
      } catch {
        this.queueInput(payload);
        break;
      }
    }
  }

  private startStatsPolling(callbacks: WebRtcClientCallbacks): void {
    if (!this.pc) return;
    if (this.statsTimer) return;
    const poll = async () => {
      if (!this.pc) return;
      let snapshot: WebRtcStatsSnapshot | NullValue = null;
      try {
        const stats = await this.pc.getStats();
        snapshot = this.extractStats(stats);
        callbacks.onStats?.(snapshot);
      } catch {
        /* ignore */
      }

      if (!this.pc) return;
      const now = Date.now();
      const jitter = snapshot?.videoPlayoutDelayMs ?? snapshot?.videoJitterBufferMs;
      if (
        typeof jitter === 'number' &&
        Number.isFinite(jitter) &&
        jitter >= STATS_POLL_FAST_JITTER_THRESHOLD_MS
      ) {
        this.statsFastUntilMs = Math.max(this.statsFastUntilMs ?? 0, now + STATS_POLL_FAST_HOLD_MS);
      }
      const shouldFast =
        (this.statsFastUntilMs != null && now <= this.statsFastUntilMs) ||
        (this.statsConnectedAtMs != null &&
          now - this.statsConnectedAtMs <= STATS_POLL_FAST_BOOT_MS);
      const delay = shouldFast ? STATS_POLL_FAST_MS : STATS_POLL_SLOW_MS;
      this.statsTimer = window.setTimeout(() => {
        delete this.statsTimer;
        void poll();
      }, delay);
    };
    void poll();
  }

  private async flushPendingCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription || !this.pendingRemoteCandidates.length) return;
    const pc = this.pc;
    const pending = this.pendingRemoteCandidates;
    this.pendingRemoteCandidates = [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* ignore */
      }
    }
  }

  private clearAutoDisconnectTimer(): void {
    if (this.autoDisconnectTimer) {
      window.clearTimeout(this.autoDisconnectTimer);
      delete this.autoDisconnectTimer;
    }
  }

  private scheduleAutoDisconnect(delayMs: number): void {
    if (this.disconnecting || !this.sessionId) return;
    this.clearAutoDisconnectTimer();
    if (delayMs <= 0) {
      void this.disconnect();
      return;
    }
    this.autoDisconnectTimer = window.setTimeout(() => {
      delete this.autoDisconnectTimer;
      void this.disconnect();
    }, delayMs);
  }

  private extractStats(report: RTCStatsReport): WebRtcStatsSnapshot {
    const inboundVideo: Record<string, unknown>[] = [];
    const inboundAudio: Record<string, unknown>[] = [];
    let rttMs: number | UndefinedValue;
    let selectedPair: Record<string, unknown> | UndefinedValue;
    const candidates = new Map<string, Record<string, unknown>>();

    report.forEach((rawItem) => {
      const item: unknown = rawItem;
      if (!isRecord(item)) return;
      const type = readString(item, 'type');
      const kind = readString(item, 'kind');
      if (type === 'inbound-rtp' && kind === 'video') inboundVideo.push(item);
      if (type === 'inbound-rtp' && kind === 'audio') inboundAudio.push(item);
      if (type === 'candidate-pair' && readString(item, 'state') === 'succeeded') {
        const currentRoundTripTime = readNumber(item, 'currentRoundTripTime');
        if (currentRoundTripTime) rttMs = currentRoundTripTime * 1000;
        if (readBoolean(item, 'selected') || readBoolean(item, 'nominated') || !selectedPair) {
          selectedPair = item;
        }
      }
      if (type === 'local-candidate' || type === 'remote-candidate') {
        const id = readString(item, 'id');
        if (id !== undefined) candidates.set(id, item);
      }
    });

    const pickInbound = (
      items: Record<string, unknown>[],
    ): Record<string, unknown> | UndefinedValue => {
      const sorted = [...items].sort((left, right) => {
        const leftFramesDecoded = readNumber(left, 'framesDecoded') ?? 0;
        const rightFramesDecoded = readNumber(right, 'framesDecoded') ?? 0;
        const leftFramesReceived = readNumber(left, 'framesReceived') ?? 0;
        const rightFramesReceived = readNumber(right, 'framesReceived') ?? 0;
        const leftHasFrames = leftFramesDecoded > 0 || leftFramesReceived > 0;
        const rightHasFrames = rightFramesDecoded > 0 || rightFramesReceived > 0;
        if (leftHasFrames !== rightHasFrames) {
          return leftHasFrames ? -1 : 1;
        }
        if (leftFramesDecoded !== rightFramesDecoded) {
          return rightFramesDecoded - leftFramesDecoded;
        }
        if (leftFramesReceived !== rightFramesReceived) {
          return rightFramesReceived - leftFramesReceived;
        }
        const leftBytes = readNumber(left, 'bytesReceived') ?? 0;
        const rightBytes = readNumber(right, 'bytesReceived') ?? 0;
        if (leftBytes !== rightBytes) {
          return rightBytes - leftBytes;
        }
        const leftPackets = readNumber(left, 'packetsReceived') ?? 0;
        const rightPackets = readNumber(right, 'packetsReceived') ?? 0;
        return rightPackets - leftPackets;
      });
      return sorted[0];
    };

    const videoInbound = pickInbound(inboundVideo);
    const audioInbound = pickInbound(inboundAudio);

    const videoInboundId = readString(videoInbound, 'id');
    const audioInboundId = readString(audioInbound, 'id');
    const videoBytes = readNumber(videoInbound, 'bytesReceived');
    const audioBytes = readNumber(audioInbound, 'bytesReceived');
    const inboundVideoFps = readNumber(videoInbound, 'framesPerSecond');
    const packetsLost =
      readNumber(videoInbound, 'packetsLost') ?? readNumber(audioInbound, 'packetsLost');
    const videoPackets = readNumber(videoInbound, 'packetsReceived');
    const audioPackets = readNumber(audioInbound, 'packetsReceived');
    const videoFramesReceived = readNumber(videoInbound, 'framesReceived');
    const videoFramesDecoded = readNumber(videoInbound, 'framesDecoded');
    const videoFramesDropped = readNumber(videoInbound, 'framesDropped');
    const videoTotalDecodeTime = readNumber(videoInbound, 'totalDecodeTime');
    const rawVideoJitter = readNumber(videoInbound, 'jitter');
    const rawAudioJitter = readNumber(audioInbound, 'jitter');
    const videoJitterMs = rawVideoJitter === undefined ? undefined : rawVideoJitter * 1000;
    const audioJitterMs = rawAudioJitter === undefined ? undefined : rawAudioJitter * 1000;
    const videoJitterBufferDelay = readNumber(videoInbound, 'jitterBufferDelay');
    const videoJitterBufferEmittedCount = readNumber(videoInbound, 'jitterBufferEmittedCount');
    const audioJitterBufferDelay = readNumber(audioInbound, 'jitterBufferDelay');
    const audioJitterBufferEmittedCount = readNumber(audioInbound, 'jitterBufferEmittedCount');
    const videoCodecId = readString(videoInbound, 'codecId');
    const audioCodecId = readString(audioInbound, 'codecId');

    let videoCodec: string | UndefinedValue;
    let audioCodec: string | UndefinedValue;
    if (videoCodecId) {
      const codec: unknown = report.get(videoCodecId);
      if (isRecord(codec)) videoCodec = readString(codec, 'mimeType');
    }
    if (audioCodecId) {
      const codec: unknown = report.get(audioCodecId);
      if (isRecord(codec)) audioCodec = readString(codec, 'mimeType');
    }

    let candidatePair: WebRtcStatsSnapshot['candidatePair'];
    if (selectedPair) {
      const local = candidates.get(readString(selectedPair, 'localCandidateId') ?? '');
      const remote = candidates.get(readString(selectedPair, 'remoteCandidateId') ?? '');
      const state = readString(selectedPair, 'state');
      const protocol = readString(selectedPair, 'protocol');
      const localAddress = readString(local, 'address');
      const localPort = readNumber(local, 'port');
      const localType = readString(local, 'candidateType');
      const remoteAddress = readString(remote, 'address');
      const remotePort = readNumber(remote, 'port');
      const remoteType = readString(remote, 'candidateType');
      candidatePair = {
        ...(state === undefined ? {} : { state }),
        ...(protocol === undefined ? {} : { protocol }),
        ...(localAddress === undefined ? {} : { localAddress }),
        ...(localPort === undefined ? {} : { localPort }),
        ...(localType === undefined ? {} : { localType }),
        ...(remoteAddress === undefined ? {} : { remoteAddress }),
        ...(remotePort === undefined ? {} : { remotePort }),
        ...(remoteType === undefined ? {} : { remoteType }),
      };
    }

    const now = Date.now();
    const last = this.statsState;
    const deltaMs = last.lastTimestampMs ? Math.max(1, now - last.lastTimestampMs) : 0;
    const sameVideoInbound = videoInboundId && last.lastVideoInboundId === videoInboundId;
    const sameAudioInbound = audioInboundId && last.lastAudioInboundId === audioInboundId;
    const calcRate = (bytes?: number, lastBytes?: number) => {
      if (bytes == null || lastBytes == null || !deltaMs) return undefined;
      return Math.round(((bytes - lastBytes) * 8) / deltaMs);
    };
    const calcFps = (frames?: number, lastFrames?: number) => {
      if (frames == null || lastFrames == null || !deltaMs) return undefined;
      const deltaFrames = frames - lastFrames;
      if (deltaFrames <= 0) return undefined;
      return (deltaFrames * 1000) / deltaMs;
    };
    const videoBitrate = calcRate(videoBytes, sameVideoInbound ? last.lastVideoBytes : undefined);
    const audioBitrate = calcRate(audioBytes, sameAudioInbound ? last.lastAudioBytes : undefined);
    const calcJitterBufferMs = (
      delay?: number,
      emitted?: number,
      lastDelay?: number,
      lastEmitted?: number,
    ) => {
      if (delay == null || emitted == null || emitted <= 0) return undefined;
      if (lastDelay == null || lastEmitted == null) return undefined;
      const deltaDelay = delay - lastDelay;
      const deltaEmitted = emitted - lastEmitted;
      if (deltaEmitted <= 0 || deltaDelay < 0) return undefined;
      return (deltaDelay / deltaEmitted) * 1000;
    };
    const calcDecodeMs = (
      totalDecodeTime?: number,
      framesDecoded?: number,
      lastTotalDecodeTime?: number,
      lastFramesDecoded?: number,
    ) => {
      if (totalDecodeTime == null || framesDecoded == null || framesDecoded <= 0) return undefined;
      // Use delta-based calculation if we have previous values
      if (lastTotalDecodeTime != null && lastFramesDecoded != null) {
        const deltaTime = totalDecodeTime - lastTotalDecodeTime;
        const deltaFrames = framesDecoded - lastFramesDecoded;
        if (deltaFrames > 0 && deltaTime >= 0) {
          return (deltaTime / deltaFrames) * 1000;
        }
      }
      // Fall back to lifetime average for first sample
      return (totalDecodeTime / framesDecoded) * 1000;
    };
    const videoJitterBufferMs = calcJitterBufferMs(
      videoJitterBufferDelay,
      videoJitterBufferEmittedCount,
      sameVideoInbound ? last.lastVideoJitterBufferDelay : undefined,
      sameVideoInbound ? last.lastVideoJitterBufferEmittedCount : undefined,
    );
    const audioJitterBufferMs = calcJitterBufferMs(
      audioJitterBufferDelay,
      audioJitterBufferEmittedCount,
      sameAudioInbound ? last.lastAudioJitterBufferDelay : undefined,
      sameAudioInbound ? last.lastAudioJitterBufferEmittedCount : undefined,
    );
    const videoDecodeMs = calcDecodeMs(
      videoTotalDecodeTime,
      videoFramesDecoded,
      sameVideoInbound ? last.lastVideoTotalDecodeTime : undefined,
      sameVideoInbound ? last.lastVideoFramesDecoded : undefined,
    );
    const videoFpsFromDecoded = calcFps(
      videoFramesDecoded,
      sameVideoInbound ? last.lastVideoFramesDecoded : undefined,
    );
    const videoFpsFromReceived = calcFps(
      videoFramesReceived,
      sameVideoInbound ? last.lastVideoFramesReceived : undefined,
    );
    const videoFps = videoFpsFromDecoded ?? videoFpsFromReceived ?? inboundVideoFps;
    this.statsState = {
      lastTimestampMs: now,
      ...(videoInboundId === undefined ? {} : { lastVideoInboundId: videoInboundId }),
      ...(audioInboundId === undefined ? {} : { lastAudioInboundId: audioInboundId }),
      ...(videoBytes === undefined ? {} : { lastVideoBytes: videoBytes }),
      ...(audioBytes === undefined ? {} : { lastAudioBytes: audioBytes }),
      ...(videoJitterBufferDelay === undefined
        ? {}
        : { lastVideoJitterBufferDelay: videoJitterBufferDelay }),
      ...(videoJitterBufferEmittedCount === undefined
        ? {}
        : { lastVideoJitterBufferEmittedCount: videoJitterBufferEmittedCount }),
      ...(audioJitterBufferDelay === undefined
        ? {}
        : { lastAudioJitterBufferDelay: audioJitterBufferDelay }),
      ...(audioJitterBufferEmittedCount === undefined
        ? {}
        : { lastAudioJitterBufferEmittedCount: audioJitterBufferEmittedCount }),
      ...(videoTotalDecodeTime === undefined
        ? {}
        : { lastVideoTotalDecodeTime: videoTotalDecodeTime }),
      ...(videoFramesDecoded === undefined ? {} : { lastVideoFramesDecoded: videoFramesDecoded }),
      ...(videoFramesReceived === undefined
        ? {}
        : { lastVideoFramesReceived: videoFramesReceived }),
    };

    return {
      ...(videoBitrate ? { videoBitrateKbps: Math.max(0, videoBitrate) } : {}),
      ...(audioBitrate ? { audioBitrateKbps: Math.max(0, audioBitrate) } : {}),
      ...(videoFps === undefined ? {} : { videoFps }),
      ...(packetsLost === undefined ? {} : { packetsLost }),
      ...(rttMs === undefined ? {} : { roundTripTimeMs: rttMs }),
      ...(videoBytes === undefined ? {} : { videoBytesReceived: videoBytes }),
      ...(audioBytes === undefined ? {} : { audioBytesReceived: audioBytes }),
      ...(videoPackets === undefined ? {} : { videoPacketsReceived: videoPackets }),
      ...(audioPackets === undefined ? {} : { audioPacketsReceived: audioPackets }),
      ...(videoFramesReceived === undefined ? {} : { videoFramesReceived }),
      ...(videoFramesDecoded === undefined ? {} : { videoFramesDecoded }),
      ...(videoFramesDropped === undefined ? {} : { videoFramesDropped }),
      ...(videoDecodeMs === undefined ? {} : { videoDecodeMs }),
      ...(videoJitterMs === undefined ? {} : { videoJitterMs }),
      ...(audioJitterMs === undefined ? {} : { audioJitterMs }),
      ...(videoJitterBufferMs === undefined ? {} : { videoJitterBufferMs }),
      ...(audioJitterBufferMs === undefined ? {} : { audioJitterBufferMs }),
      ...(videoCodec === undefined ? {} : { videoCodec }),
      ...(audioCodec === undefined ? {} : { audioCodec }),
      ...(candidatePair === undefined ? {} : { candidatePair }),
    };
  }
}
