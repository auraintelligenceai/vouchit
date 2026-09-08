import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, resolveApiKey, resolveModelConfig } from '../src/lib/config.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname ?? process.cwd(), 'fixtures', 'config-test');

describe('loadConfig', () => {
  beforeEach(() => { mkdirSync(FIXTURE_DIR, { recursive: true }); });
  afterEach(() => { rmSync(FIXTURE_DIR, { recursive: true, force: true }); });
  it('returns empty when no config file exists', () => { expect(loadConfig(FIXTURE_DIR)).toEqual({}); });
  it('loads valid .vouchit.json', () => {
    writeFileSync(join(FIXTURE_DIR, '.vouchit.json'), JSON.stringify({ models: { default: 'custom-model', backup: ['backup-1'] }, output: { dir: './out', format: 'json' } }));
    const config = loadConfig(FIXTURE_DIR);
    expect(config.models?.default).toBe('custom-model');
    expect(config.models?.backup).toEqual(['backup-1']);
    expect(config.output?.dir).toBe('./out');
    expect(config.output?.format).toBe('json');
  });
  it('returns empty for invalid JSON', () => { writeFileSync(join(FIXTURE_DIR, '.vouchit.json'), 'not json {{{'); expect(loadConfig(FIXTURE_DIR)).toEqual({}); });
  it('returns empty for invalid schema', () => { writeFileSync(join(FIXTURE_DIR, '.vouchit.json'), JSON.stringify({ output: { format: 'invalid-format' } })); expect(loadConfig(FIXTURE_DIR)).toEqual({}); });
  it('loads agent-specific model overrides', () => {
    writeFileSync(join(FIXTURE_DIR, '.vouchit.json'), JSON.stringify({ models: { default: 'default-model', agents: { security: 'security-model', edge: 'edge-model' } } }));
    const config = loadConfig(FIXTURE_DIR);
    expect(config.models?.agents?.security).toBe('security-model');
    expect(config.models?.agents?.edge).toBe('edge-model');
  });
});

describe('resolveApiKey', () => {
  const origEnv = { ...process.env };
  afterEach(() => { process.env = { ...origEnv }; });
  it('prefers VOUCHIT_API_KEY', () => { process.env.VOUCHIT_API_KEY = 'vouchit-key'; process.env.OPENROUTER_API_KEY = 'or-key'; expect(resolveApiKey()).toBe('vouchit-key'); });
  it('falls back to OPENROUTER_API_KEY', () => { delete process.env.VOUCHIT_API_KEY; process.env.OPENROUTER_API_KEY = 'or-key'; expect(resolveApiKey()).toBe('or-key'); });
  it('returns empty when no key set', () => { delete process.env.VOUCHIT_API_KEY; delete process.env.OPENROUTER_API_KEY; expect(resolveApiKey()).toBe(''); });
});

describe('resolveModelConfig', () => {
  it('uses CLI model override', () => { const config = { models: { default: 'config-model', agents: { security: 'sec-model' } } }; expect(resolveModelConfig(config, 'security', 'cli-model').model).toBe('cli-model'); });
  it('uses agent-specific model from config', () => { const config = { models: { default: 'config-model', agents: { security: 'sec-model' } } }; expect(resolveModelConfig(config, 'security').model).toBe('sec-model'); });
  it('falls back to default model', () => { const config = { models: { default: 'config-model' } }; expect(resolveModelConfig(config, 'unknown-agent').model).toBe('config-model'); });
  it('falls back to hardcoded default', () => { expect(resolveModelConfig({}).model).toBe('deepseek/deepseek-chat-v3-0324'); });
  it('includes backup models excluding primary', () => { const config = { models: { default: 'primary', backup: ['backup-1', 'primary', 'backup-2'] } }; const r = resolveModelConfig(config); expect(r.model).toBe('primary'); expect(r.backupModels).toEqual(['backup-1', 'backup-2']); });
});