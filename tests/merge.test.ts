import { describe, it, expect } from 'vitest';
import { mergeFindings } from '../src/report/merge.js';
import type { AgentResult } from '../src/fleet/agent.js';
import type { TimedAgentResult } from '../src/fleet/runner.js';

function makeResult(findings: AgentResult['findings'], score: number): AgentResult { return { findings, score, confidence: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low' }; }
function timed(agentId: string, result: AgentResult, durationMs = 100): TimedAgentResult { return { agentId, result, durationMs }; }

describe('mergeFindings', () => {
  it('merges findings from multiple agents', () => {
    const results = [
      timed('security', makeResult([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'Exposed key', evidence: 'Key in source', recommendation: 'Use env' }, { id: 'SEC-002', severity: 'warning', agent: 'security', title: 'Weak CORS', evidence: 'Allow all', recommendation: 'Restrict' }], 50)),
      timed('edge', makeResult([{ id: 'EDG-001', severity: 'info', agent: 'edge', title: 'Missing null check', evidence: 'Could NPE', recommendation: 'Guard' }], 85)),
    ];
    const { findings, rankings, verdict } = mergeFindings(results);
    expect(findings).toHaveLength(3);
    expect(rankings).toHaveLength(2);
    expect(findings[0].severity).toBe('critical');
    expect(findings[1].severity).toBe('warning');
    expect(findings[2].severity).toBe('info');
    expect(verdict).toBe('review');
  });
  it('returns clear verdict for no critical findings', () => {
    const results = [timed('security', makeResult([{ id: 'SEC-001', severity: 'info', agent: 'security', title: 'Minor', evidence: 'Minor', recommendation: 'Keep' }], 90))];
    const { verdict } = mergeFindings(results);
    expect(verdict).toBe('clear');
  });
  it('returns block verdict for 3+ critical findings', () => {
    const results = [timed('security', makeResult([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'A', evidence: 'A', recommendation: 'A' }, { id: 'SEC-002', severity: 'critical', agent: 'security', title: 'B', evidence: 'B', recommendation: 'B' }, { id: 'SEC-003', severity: 'critical', agent: 'security', title: 'C', evidence: 'C', recommendation: 'C' }], 10))];
    const { verdict } = mergeFindings(results);
    expect(verdict).toBe('block');
  });
  it('returns review for 1 critical finding', () => {
    const results = [timed('security', makeResult([{ id: 'SEC-001', severity: 'critical', agent: 'security', title: 'A', evidence: 'A', recommendation: 'A' }], 50))];
    const { verdict } = mergeFindings(results);
    expect(verdict).toBe('review');
  });
  it('returns review for 5+ warnings', () => {
    const findings = Array.from({ length: 5 }, (_, i) => ({ id: `SEC-${String(i + 1).padStart(3, '0')}`, severity: 'warning' as const, agent: 'security', title: `Warning ${i}`, evidence: 'Evidence', recommendation: 'Fix' }));
    const results = [timed('security', makeResult(findings, 60))];
    const { verdict } = mergeFindings(results);
    expect(verdict).toBe('review');
  });
  it('sorts findings by severity weight', () => {
    const results = [timed('security', makeResult([{ id: 'SEC-001', severity: 'info', agent: 'security', title: 'Info', evidence: 'Info', recommendation: 'Info' }, { id: 'SEC-002', severity: 'critical', agent: 'security', title: 'Crit', evidence: 'Crit', recommendation: 'Crit' }, { id: 'SEC-003', severity: 'warning', agent: 'security', title: 'Warn', evidence: 'Warn', recommendation: 'Warn' }], 50))];
    const { findings } = mergeFindings(results);
    expect(findings[0].severity).toBe('critical');
    expect(findings[1].severity).toBe('warning');
    expect(findings[2].severity).toBe('info');
  });
  it('includes durationMs in rankings', () => {
    const results = [timed('security', makeResult([], 100), 250), timed('edge', makeResult([], 95), 120)];
    const { rankings } = mergeFindings(results);
    expect(rankings[0].durationMs).toBe(250);
    expect(rankings[1].durationMs).toBe(120);
  });
});