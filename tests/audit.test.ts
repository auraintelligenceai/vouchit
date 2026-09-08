import { describe, it, expect } from 'vitest';
import { getGitInfo } from '../src/lib/git.js';
import { nodeVersion, tsVersion, version } from '../src/lib/meta.js';

describe('git info', () => {
  it('returns commit hash for a git repo', () => { const info = getGitInfo('D:\\VouchIt'); expect(info.commit).toBeDefined(); expect(typeof info.commit).toBe('string'); expect(info.commit!.length).toBeGreaterThan(0); });
  it('returns dirty flag for a git repo', () => { const info = getGitInfo('D:\\VouchIt'); expect(typeof info.dirty).toBe('boolean'); });
  it('returns empty object for non-git directory', () => { const info = getGitInfo('C:\\'); expect(info.commit).toBeUndefined(); expect(info.dirty).toBeUndefined(); });
});
describe('meta', () => {
  it('exports version from package.json', () => { expect(version).toBe('0.1.0'); });
  it('exports node version', () => { expect(nodeVersion).toMatch(/^v\d+\.\d+\.\d+/); });
  it('exports ts version', () => { expect(tsVersion).toBeDefined(); });
});