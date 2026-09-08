import type { ModelFn, ModelResponse } from './types.js';
import type { VouchitConfig } from '../lib/config.js';
import { resolveApiKey, resolveModelConfig } from '../lib/config.js';

export interface RouterConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  backupModels: string[];
  maxRetries: number;
}

export interface ModelUsage {
  model: string;
  tokensUsed: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export function resolveConfig(overrides?: Partial<RouterConfig>): RouterConfig {
  return {
    baseUrl: process.env.VOUCHIT_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey: resolveApiKey(),
    model: process.env.VOUCHIT_MODEL ?? 'deepseek/deepseek-chat-v3-0324',
    backupModels: [],
    maxRetries: 1,
    ...overrides,
  };
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message;
    if (/\b(429|500|502|503|504)\b/.test(msg)) return true;
    if (/ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(msg)) return true;
  }
  return false;
}

function getRetryDelay(attempt: number, retryAfterHeader?: string): number {
  if (retryAfterHeader) {
    const parsed = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsed) && parsed > 0) return Math.min(parsed * 1000, MAX_BACKOFF_MS);
  }
  const jitter = Math.random() * 500;
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt) + jitter, MAX_BACKOFF_MS);
}

async function callOpenRouter(cfg: RouterConfig, model: string, system: string, user: string, opts?: { maxTokens?: number; temperature?: number }): Promise<ModelResponse> {
  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}`, 'HTTP-Referer': 'https://github.com/vouchit', 'X-Title': 'VouchIt' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: opts?.maxTokens ?? 4096, temperature: opts?.temperature ?? 0.2 }),
  });
  if (!res.ok) { const body = await res.text().catch(() => ''); throw new Error(`Model ${model} returned ${res.status}: ${body.slice(0, 200)}`); }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
  const text = data.choices?.[0]?.message?.content ?? '';
  const tokensUsed = data.usage?.total_tokens ?? 0;
  return { text, tokensUsed };
}

async function callWithRetry(cfg: RouterConfig, model: string, system: string, user: string, opts?: { maxTokens?: number; temperature?: number }): Promise<ModelResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try { return await callOpenRouter(cfg, model, system, user, opts); }
    catch (err) {
      lastError = err;
      if (attempt < cfg.maxRetries && isRetryableError(err)) { await new Promise((r) => setTimeout(r, getRetryDelay(attempt))); continue; }
      throw err;
    }
  }
  throw lastError;
}

export function createModelFn(config?: Partial<RouterConfig>): ModelFn {
  const cfg = resolveConfig(config);
  return async (system: string, user: string, opts?: { maxTokens?: number; temperature?: number }): Promise<ModelResponse> => {
    return callWithRetry(cfg, cfg.model, system, user, opts);
  };
}

export function createModelFnWithFallback(config: VouchitConfig, agentId: string, cliModel?: string): ModelFn {
  const { model, backupModels } = resolveModelConfig(config, agentId, cliModel);
  const apiKey = resolveApiKey();
  const baseUrl = process.env.VOUCHIT_BASE_URL ?? DEFAULT_BASE_URL;
  const fullCfg: RouterConfig = { baseUrl, apiKey, model, backupModels, maxRetries: 1 };
  const allModels = [model, ...backupModels.filter((m) => m !== model)];
  const fn: ModelFn & { usage: ModelUsage[] } = Object.assign(
    async (system: string, user: string, opts?: { maxTokens?: number; temperature?: number }): Promise<ModelResponse> => {
      let lastError: unknown;
      for (const tryModel of allModels) {
        const start = performance.now();
        try {
          const result = await callWithRetry(fullCfg, tryModel, system, user, opts);
          fn.usage.push({ model: tryModel, tokensUsed: result.tokensUsed, durationMs: Math.round(performance.now() - start), success: true });
          return result;
        } catch (err) {
          lastError = err;
          fn.usage.push({ model: tryModel, tokensUsed: 0, durationMs: Math.round(performance.now() - start), success: false, error: err instanceof Error ? err.message : String(err) });
          continue;
        }
      }
      throw lastError;
    },
    { usage: [] as ModelUsage[] },
  );
  return fn;
}

export function getModelUsage(fn: ModelFn): ModelUsage[] {
  if ('usage' in fn && Array.isArray((fn as Record<string, unknown>).usage)) return (fn as unknown as { usage: ModelUsage[] }).usage;
  return [];
}