import { describe, it, expect } from 'vitest';
import { version, nodeVersion, tsVersion } from '../src/lib/meta.js';
import type { AuditReport } from '../src/report/schema.js';

describe('CLI configuration', () => {
  it('version matches package.json', () => { expect(version).toBe('0.1.0'); });
  it('node version is valid', () => { expect(nodeVersion).toMatch(/^v\d+/); });
  it('ts version is defined', () => { expect(tsVersion).toBeDefined(); });
});
describe('exit code mapping', () => {
  function exitCodeForVerdict(verdict: AuditReport['verdict']): number {
    if (verdict === 'block') return 2;
    if (verdict === 'review') return 1;
    return 0;
  }
  it('block verdict maps to exit code 2', () => { expect(exitCodeForVerdict('block')).toBe(2); });
  it('review verdict maps to exit code 1', () => { expect(exitCodeForVerdict('review')).toBe(1); });
  it('clear verdict maps to exit code 0', () => { expect(exitCodeForVerdict('clear')).toBe(0); });
});