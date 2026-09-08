import { describe, it, expect } from 'vitest';
import { sha256 } from '../src/lib/hash.js';
import { detectKind } from '../src/lib/context.js';
import { resolve } from 'node:path';

describe('sha256', () => {
  it('returns deterministic hash', () => { const a = sha256('hello world'); const b = sha256('hello world'); expect(a).toBe(b); expect(a).toHaveLength(64); });
  it('returns different hashes for different inputs', () => { const a = sha256('hello'); const b = sha256('world'); expect(a).not.toBe(b); });
});
describe('detectKind', () => {
  it('detects plan file for .md', () => { expect(detectKind(resolve('tests/fixtures/sample-plan.md'))).toBe('plan'); });
  it('detects codebase for .ts file', () => { expect(detectKind(resolve('src/cli/index.ts'))).toBe('codebase'); });
  it('detects codebase for directory', () => { expect(detectKind(resolve('src'))).toBe('codebase'); });
});