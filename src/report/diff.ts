import type { Finding, AuditReport } from './schema.js';

export interface DiffFinding {
  id: string;
  title: string;
  agent: string;
  change: 'added' | 'removed' | 'severity-changed';
  oldSeverity?: Finding['severity'];
  newSeverity?: Finding['severity'];
  file?: string;
  line?: number;
}

export interface DiffResult {
  runA: { id: string; timestamp: string; verdict: string };
  runB: { id: string; timestamp: string; verdict: string };
  summary: { totalA: number; totalB: number; added: number; removed: number; severityChanged: number; unchanged: number };
  findings: DiffFinding[];
  verdictChanged: boolean;
  oldVerdict: string;
  newVerdict: string;
}

function indexFindings(findings: Finding[]): Map<string, Finding> {
  const map = new Map<string, Finding>();
  for (const f of findings) map.set(f.id, f);
  return map;
}

export function diffReports(reportA: AuditReport, reportB: AuditReport): DiffResult {
  const indexA = indexFindings(reportA.findings);
  const indexB = indexFindings(reportB.findings);
  const findings: DiffFinding[] = [];
  let added = 0, removed = 0, severityChanged = 0, unchanged = 0;
  for (const [id, fA] of indexA) {
    const fB = indexB.get(id);
    if (!fB) { findings.push({ id, title: fA.title, agent: fA.agent, change: 'removed', oldSeverity: fA.severity }); removed++; }
    else if (fA.severity !== fB.severity) { findings.push({ id, title: fB.title, agent: fB.agent, change: 'severity-changed', oldSeverity: fA.severity, newSeverity: fB.severity, file: fB.file, line: fB.line }); severityChanged++; }
    else unchanged++;
  }
  for (const [id, fB] of indexB) {
    if (!indexA.has(id)) { findings.push({ id, title: fB.title, agent: fB.agent, change: 'added', newSeverity: fB.severity }); added++; }
  }
  findings.sort((a, b) => { const order = { added: 0, 'severity-changed': 1, removed: 2 }; return order[a.change] - order[b.change]; });
  return {
    runA: { id: reportA.run.id, timestamp: reportA.run.timestamp, verdict: reportA.verdict },
    runB: { id: reportB.run.id, timestamp: reportB.run.timestamp, verdict: reportB.verdict },
    summary: { totalA: reportA.findings.length, totalB: reportB.findings.length, added, removed, severityChanged, unchanged },
    findings, verdictChanged: reportA.verdict !== reportB.verdict, oldVerdict: reportA.verdict, newVerdict: reportB.verdict,
  };
}

export function buildDiffMarkdown(diff: DiffResult): string {
  const lines: string[] = [];
  lines.push(`# VouchIt Diff — ${diff.runA.id} → ${diff.runB.id}`);
  lines.push('');
  lines.push(`- **Run A:** ${diff.runA.timestamp} · verdict **${diff.runA.verdict}**`);
  lines.push(`- **Run B:** ${diff.runB.timestamp} · verdict **${diff.runB.verdict}**`);
  if (diff.verdictChanged) lines.push(`- **Verdict changed:** ${diff.oldVerdict} → ${diff.newVerdict}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Findings in A | ${diff.summary.totalA} |`);
  lines.push(`| Findings in B | ${diff.summary.totalB} |`);
  lines.push(`| Added | ${diff.summary.added} |`);
  lines.push(`| Removed | ${diff.summary.removed} |`);
  lines.push(`| Severity changed | ${diff.summary.severityChanged} |`);
  lines.push(`| Unchanged | ${diff.summary.unchanged} |`);
  lines.push('');
  if (diff.findings.length === 0) { lines.push('No differences found.'); return lines.join('\n'); }
  lines.push('## Changes');
  lines.push('');
  const addedF = diff.findings.filter((f) => f.change === 'added');
  const changed = diff.findings.filter((f) => f.change === 'severity-changed');
  const removedF = diff.findings.filter((f) => f.change === 'removed');
  if (addedF.length > 0) { lines.push('### Added'); for (const f of addedF) lines.push(`- **${f.id}** [${f.newSeverity}] ${f.title} (${f.agent})`); lines.push(''); }
  if (changed.length > 0) { lines.push('### Severity Changed'); for (const f of changed) lines.push(`- **${f.id}** ${f.oldSeverity} → ${f.newSeverity} — ${f.title} (${f.agent})`); lines.push(''); }
  if (removedF.length > 0) { lines.push('### Removed'); for (const f of removedF) lines.push(`- **${f.id}** [${f.oldSeverity}] ${f.title} (${f.agent})`); lines.push(''); }
  return lines.join('\n');
}