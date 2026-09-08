import { describe, it, expect } from 'vitest';
import { diffReports, buildDiffMarkdown } from '../src/report/diff.js';
import type { AuditReport } from '../src/report/schema.js';

function makeReport(findings: AuditReport['findings'], verdict: AuditReport['verdict'] = 'clear'): AuditReport {
  return { schema: 'vouchit-report-v1', run: { id: 'test-run', model: 'test-model', agents: ['security'], timestamp: '2025-01-01T00:00:00.000Z', inputHash: 'sha256:test', seed: '123', nodeVersion: 'v20.0.0', tsVersion: '5.0.0' }, findings, rankings: [{ agent: 'security', score: 100, confidence: 'high', durationMs: 100 }], verdict };
}

describe('diffReports', () => {
  it('detects added findings', () => {
    const reportA = makeReport([]);
    const reportB = makeReport([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'New issue', evidence: 'Found', recommendation: 'Fix' }]);
    const diff = diffReports(reportA, reportB);
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.removed).toBe(0);
    expect(diff.findings[0].change).toBe('added');
  });
  it('detects removed findings', () => {
    const reportA = makeReport([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'Old issue', evidence: 'Found', recommendation: 'Fix' }]);
    const reportB = makeReport([]);
    const diff = diffReports(reportA, reportB);
    expect(diff.summary.removed).toBe(1);
    expect(diff.findings[0].change).toBe('removed');
  });
  it('detects severity changes', () => {
    const reportA = makeReport([{ id: 'SEC-001', severity: 'info', agent: 'security', title: 'Minor', evidence: 'Minor', recommendation: 'Keep' }]);
    const reportB = makeReport([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'Minor', evidence: 'Minor', recommendation: 'Keep' }]);
    const diff = diffReports(reportA, reportB);
    expect(diff.summary.severityChanged).toBe(1);
    expect(diff.findings[0].change).toBe('severity-changed');
    expect(diff.findings[0].oldSeverity).toBe('info');
    expect(diff.findings[0].newSeverity).toBe('critical');
  });
  it('counts unchanged findings', () => {
    const reportA = makeReport([{ id: 'SEC-001', severity: 'warning', agent: 'security', title: 'Same', evidence: 'Same', recommendation: 'Same' }]);
    const reportB = makeReport([{ id: 'SEC-001', severity: 'warning', agent: 'security', title: 'Same', evidence: 'Same', recommendation: 'Same' }]);
    const diff = diffReports(reportA, reportB);
    expect(diff.summary.unchanged).toBe(1);
  });
  it('detects verdict changes', () => {
    const reportA = makeReport([], 'clear');
    const reportB = makeReport([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'A', evidence: 'A', recommendation: 'A' }, { id: 'SEC-002', severity: 'critical', agent: 'security', title: 'B', evidence: 'B', recommendation: 'B' }, { id: 'SEC-003', severity: 'critical', agent: 'security', title: 'C', evidence: 'C', recommendation: 'C' }], 'block');
    const diff = diffReports(reportA, reportB);
    expect(diff.verdictChanged).toBe(true);
    expect(diff.oldVerdict).toBe('clear');
    expect(diff.newVerdict).toBe('block');
  });
  it('handles multiple change types', () => {
    const reportA = makeReport([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'Remove me', evidence: 'X', recommendation: 'X' }, { id: 'SEC-002', severity: 'info', agent: 'security', title: 'Change severity', evidence: 'X', recommendation: 'X' }, { id: 'SEC-003', severity: 'warning', agent: 'security', title: 'Keep me', evidence: 'X', recommendation: 'X' }]);
    const reportB = makeReport([{ id: 'SEC-002', severity: 'critical', agent: 'security', title: 'Change severity', evidence: 'X', recommendation: 'X' }, { id: 'SEC-003', severity: 'warning', agent: 'security', title: 'Keep me', evidence: 'X', recommendation: 'X' }, { id: 'SEC-004', severity: 'warning', agent: 'security', title: 'New finding', evidence: 'X', recommendation: 'X' }]);
    const diff = diffReports(reportA, reportB);
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.removed).toBe(1);
    expect(diff.summary.severityChanged).toBe(1);
    expect(diff.summary.unchanged).toBe(1);
  });
  it('sorts findings by change type', () => {
    const reportA = makeReport([{ id: 'SEC-001', severity: 'info', agent: 'security', title: 'Will change', evidence: 'X', recommendation: 'X' }, { id: 'SEC-002', severity: 'warning', agent: 'security', title: 'Will be removed', evidence: 'X', recommendation: 'X' }]);
    const reportB = makeReport([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'Will change', evidence: 'X', recommendation: 'X' }, { id: 'SEC-003', severity: 'info', agent: 'security', title: 'New', evidence: 'X', recommendation: 'X' }]);
    const diff = diffReports(reportA, reportB);
    expect(diff.findings[0].change).toBe('added');
    expect(diff.findings[1].change).toBe('severity-changed');
    expect(diff.findings[2].change).toBe('removed');
  });
  it('includes run metadata', () => {
    const reportA = makeReport([]); reportA.run.id = 'run-aaa';
    const reportB = makeReport([]); reportB.run.id = 'run-bbb';
    const diff = diffReports(reportA, reportB);
    expect(diff.runA.id).toBe('run-aaa');
    expect(diff.runB.id).toBe('run-bbb');
  });
});
describe('buildDiffMarkdown', () => {
  it('renders empty diff', () => { const diff = diffReports(makeReport([]), makeReport([])); expect(buildDiffMarkdown(diff)).toContain('No differences found'); });
  it('renders added findings', () => {
    const diff = diffReports(makeReport([]), makeReport([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'New', evidence: 'X', recommendation: 'Fix' }]));
    const md = buildDiffMarkdown(diff);
    expect(md).toContain('### Added');
    expect(md).toContain('SEC-001');
  });
  it('renders severity changes', () => {
    const diff = diffReports(makeReport([{ id: 'SEC-001', severity: 'info', agent: 'security', title: 'Changed', evidence: 'X', recommendation: 'X' }]), makeReport([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'Changed', evidence: 'X', recommendation: 'X' }]));
    expect(buildDiffMarkdown(diff)).toContain('info → critical');
  });
  it('renders verdict change', () => {
    const diff = diffReports(makeReport([], 'clear'), makeReport([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'A', evidence: 'A', recommendation: 'A' }, { id: 'SEC-002', severity: 'critical', agent: 'security', title: 'B', evidence: 'B', recommendation: 'B' }, { id: 'SEC-003', severity: 'critical', agent: 'security', title: 'C', evidence: 'C', recommendation: 'C' }], 'block'));
    expect(buildDiffMarkdown(diff)).toContain('clear → block');
  });
});