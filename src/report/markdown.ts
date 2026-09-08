import type { AuditReport } from './schema.js';

export function buildMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  const sev = { critical: '🔴', warning: '🟡', info: '🟢' } as const;
  lines.push(`# VouchIt Report — ${report.run.id}`);
  lines.push('');
  lines.push(`- **Verdict:** ${report.run.agents.map((a) => a.toUpperCase()).join(' / ')} → **${report.verdict}**`);
  lines.push(`- **Run:** ${report.run.timestamp} · model \`${report.run.model}\` · input \`${report.run.inputHash.slice(0, 12)}\``);
  if (report.run.gitCommit) lines.push(`- **Git:** \`${report.run.gitCommit}\`${report.run.gitDirty ? ' (dirty)' : ''}`);
  lines.push(`- **Runtime:** Node ${report.run.nodeVersion} · TS ${report.run.tsVersion}`);
  lines.push('');
  if (report.findings.length === 0) lines.push('No findings. Clear to ship.');
  for (const f of report.findings) {
    lines.push(`## ${sev[f.severity]} ${f.id} — ${f.title}`);
    lines.push('');
    lines.push(f.evidence);
    if (f.file) lines.push(`- **Location:** \`${f.file}${f.line ? `:${f.line}` : ''}\``);
    lines.push(`- **Recommendation:** ${f.recommendation}`);
    lines.push('');
  }
  if (report.rankings.length > 0) {
    lines.push('## Agent Performance');
    lines.push('');
    for (const r of report.rankings) lines.push(`- **${r.agent}:** score ${r.score}/100 (${r.confidence}) · ${r.durationMs}ms`);
    lines.push('');
  }
  return lines.join('\n');
}