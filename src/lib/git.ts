import { execSync } from 'node:child_process';

export interface GitInfo {
  commit?: string;
  dirty?: boolean;
}

export function getGitInfo(cwd?: string): GitInfo {
  try {
    const commit = execSync('git rev-parse --short HEAD', {
      cwd, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const status = execSync('git status --porcelain', {
      cwd, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { commit, dirty: status.length > 0 };
  } catch {
    return {};
  }
}