import { describe, expect, test } from '../../src_assets/common/assets/web/node_modules/vitest';
import { parseGitHubRelease } from '@web/utils/githubRelease';

describe('Dashboard GitHub release normalization', () => {
  test('keeps a release with a valid tag when presentation fields are null or missing', () => {
    expect(
      parseGitHubRelease({
        tag_name: 'v1.15.31',
        name: null,
        html_url: null,
        prerelease: true,
      }),
    ).toEqual({
      tag_name: 'v1.15.31',
      name: '',
      html_url: '',
      body: '',
      prerelease: true,
    });
  });

  test('rejects records without a string tag name', () => {
    expect(parseGitHubRelease({ name: 'Untaggable release' })).toBeNull();
    expect(parseGitHubRelease({ tag_name: null })).toBeNull();
  });
});
