import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, extname, join, relative } from 'node:path';

export type TargetKind = 'plan' | 'codebase';

const PLAN_EXTENSIONS = new Set(['.md', '.txt', '.rst', '.adoc']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.vouchit', 'coverage']);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.rs', '.java', '.cs', '.json', '.yaml', '.yml', '.toml']);

export function detectKind(targetPath: string): TargetKind {
  const stat = statSync(targetPath, { throwIfNoEntry: false });
  if (!stat) return 'plan';
  if (stat.isFile()) return PLAN_EXTENSIONS.has(extname(targetPath).toLowerCase()) ? 'plan' : 'codebase';
  return 'codebase';
}

export interface FileContent { path: string; content: string; }

export function readTarget(targetPath: string, kind: TargetKind): FileContent[] {
  const resolved = resolve(targetPath);
  const stat = statSync(resolved, { throwIfNoEntry: false });
  if (!stat) throw new Error(`Target not found: ${targetPath}`);
  if (stat.isFile()) return [{ path: resolved, content: readFileSync(resolved, 'utf-8') }];
  return readDir(resolved, kind);
}

function readDir(dirPath: string, kind: TargetKind): FileContent[] {
  const results: FileContent[] = [];
  function walk(current: string) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      const ext = extname(entry.name).toLowerCase();
      const accept = kind === 'plan' ? PLAN_EXTENSIONS.has(ext) : CODE_EXTENSIONS.has(ext) || PLAN_EXTENSIONS.has(ext);
      if (!accept) continue;
      results.push({ path: relative(dirPath, full), content: readFileSync(full, 'utf-8') });
    }
  }
  walk(dirPath);
  return results;
}