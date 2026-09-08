import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const pkg = (await import('../../package.json', { with: { type: 'json' } })).default as { version: string; name: string };
export const name = pkg.name;
export const version = pkg.version;
export const nodeVersion = process.version;
export const tsVersion = (() => {
  try {
    const ts = require('typescript');
    return ts.version ?? 'unknown';
  } catch { return 'unknown'; }
})();