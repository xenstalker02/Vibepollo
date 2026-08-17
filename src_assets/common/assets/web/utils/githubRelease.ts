import type { GitHubRelease } from '@/sunshine_version';

const NULL_VALUE = null;
type NullValue = typeof NULL_VALUE;

export type DashboardRelease = GitHubRelease & { draft?: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function presentationField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseGitHubRelease(value: unknown): DashboardRelease | NullValue {
  if (!isRecord(value) || typeof value['tag_name'] !== 'string') return null;
  return {
    tag_name: value['tag_name'],
    name: presentationField(value['name']),
    html_url: presentationField(value['html_url']),
    body: presentationField(value['body']),
    ...(typeof value['prerelease'] === 'boolean' ? { prerelease: value['prerelease'] } : {}),
    ...(typeof value['draft'] === 'boolean' ? { draft: value['draft'] } : {}),
  };
}
