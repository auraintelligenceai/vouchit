import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

export const ConfigSchema = z.object({
  models: z.object({
    default: z.string().optional(),
    backup: z.array(z.string()).optional(),
    agents: z.record(z.string(), z.string()).optional(),
  }).optional(),
  budget: z.object({
    maxTokens: z.number().positive().optional(),
    warnAt: z.number().positive().optional(),
  }).optional(),
  output: z.object({
    dir: z.string().optional(),
    format: z.enum(['json', 'md', 'both']).optional(),
  }).optional(),
});

export type VouchitConfig = z.infer<typeof ConfigSchema>;

const CONFIG_FILENAME = '.vouchit.json';
const GLOBAL_DIR = join(homedir(), '.config', 'vouchit');

function findConfigFile(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  const globalCandidate = join(GLOBAL_DIR, 'config.json');
  if (existsSync(globalCandidate)) return globalCandidate;
  return null;
}

export function loadConfig(cwd?: string): VouchitConfig {
  const configFile = findConfigFile(cwd ?? process.cwd());
  if (!configFile) return {};
  try {
    const raw = readFileSync(configFile, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = ConfigSchema.safeParse(parsed);
    if (!result.success) { console.error(`Warning: invalid config in ${configFile}: ${result.error.message}`); return {}; }
    return result.data;
  } catch { return {}; }
}

export function resolveApiKey(config?: VouchitConfig): string {
  return process.env.VOUCHIT_API_KEY || process.env.OPENROUTER_API_KEY || '';
}

export function resolveModelConfig(config: VouchitConfig, agentId?: string, cliModel?: string): { model: string; backupModels: string[] } {
  const defaultModel = 'deepseek/deepseek-chat-v3-0324';
  const model = cliModel || (agentId && config.models?.agents?.[agentId]) || config.models?.default || process.env.VOUCHIT_MODEL || defaultModel;
  const backupModels = [...(config.models?.backup ?? [])].filter((m) => m !== model);
  return { model, backupModels };
}