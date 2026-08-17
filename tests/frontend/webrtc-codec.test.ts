import { describe, expect, test } from '../../src_assets/common/assets/web/node_modules/vitest';
import {
  hasPacketizationMode1,
  rewriteFmtp,
} from '@web/utils/webrtc/client';
import { toRtcIceCandidateInit } from '@web/services/webrtcApi';

describe('WebRTC codec and candidate helpers', () => {
  test('recognizes H.264 packetization mode 1 without assuming FMTP is present', () => {
    expect(hasPacketizationMode1('profile-level-id=42e01f;packetization-mode=1')).toBe(true);
    expect(hasPacketizationMode1(undefined)).toBe(false);
  });

  test('preserves existing FMTP parameters while applying a bitrate hint', () => {
    expect(rewriteFmtp(['apt=96', 'x-google-start-bitrate=1000'])).toEqual(
      expect.arrayContaining(['apt=96', 'x-google-start-bitrate=1000']),
    );
  });

  test('omits missing optional ICE candidate fields', () => {
    const candidate = toRtcIceCandidateInit({
      candidate: 'candidate:1 1 UDP 2122252543 192.0.2.1 54321 typ host',
      sdpMLineIndex: 0,
    });

    expect(candidate).toEqual({
      candidate: 'candidate:1 1 UDP 2122252543 192.0.2.1 54321 typ host',
      sdpMLineIndex: 0,
    });
    expect('sdpMid' in candidate).toBe(false);
  });
});
