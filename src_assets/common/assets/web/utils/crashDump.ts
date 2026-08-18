export type CrashDumpStatus = {
  available?: boolean;
  filename?: string;
  path?: string;
  process?: string;
  size_bytes?: number;
  captured_at?: string;
  age_seconds?: number;
  age_hours?: number;
  dismissed?: boolean;
  dismissed_at?: string;
};

export const MIN_SUNSHINE_CRASH_DUMP_SIZE_BYTES = 10 * 1024 * 1024;

const NULL_VALUE = null;
type NullValue = typeof NULL_VALUE;

function isSunshineDump(status?: CrashDumpStatus | NullValue): boolean {
  if (!status) return false;
  const proc = status.process?.toLowerCase();
  if (proc) return proc === 'sunshine.exe';
  const name = status.filename?.toLowerCase() || '';
  return name.startsWith('sunshine.exe.');
}

export function isCrashDumpEligible(status?: CrashDumpStatus | NullValue): boolean {
  if (!status || status.available !== true) {
    return false;
  }
  if (isSunshineDump(status)) {
    const size = status.size_bytes ?? 0;
    return size >= MIN_SUNSHINE_CRASH_DUMP_SIZE_BYTES;
  }
  return true;
}

export function sanitizeCrashDumpStatus(
  status?: CrashDumpStatus | NullValue,
): CrashDumpStatus | NullValue {
  if (!status) {
    return null;
  }
  if (status.available !== true) {
    return status;
  }
  if (!isCrashDumpEligible(status)) {
    return { available: false };
  }
  return status;
}
