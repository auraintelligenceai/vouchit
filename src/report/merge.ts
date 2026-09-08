import type { Finding, AuditReport, AgentRun } from './schema.js';
import type { TimedAgentResult } from '../fleet/runner.js';

const SEVERITY_WEIGHT: Record<Finding['severity'], number> = { critical: 10, warning: 3, info: 1 };

export function mergeFindings(results: TimedAgentResult[]): {
  findings: Finding[];
  rankings: AgentRun[];
  verdict: AuditReport['verdict'];
} {
  const allFindings: Finding[] = [];
  const rankings: AgentRun[] = [];
  for (const { agentId, result, durationMs } of results) {
    allFindings.push(...result.findings);
    rankings.push({ agent: agentId, score: result.score, confidence: result.confidence, durationMs });
  }
  const sorted = allFindings.sort((a, b) => (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0));
  const criticalCount = sorted.filter((f) => f.severity === 'critical').length;
  const warningCount = sorted.filter((f) => f.severity === 'warning').length;
  let verdict: AuditReport['verdict'];
  if (criticalCount >= 3) verdict = 'block';
  else if (criticalCount >= 1 || warningCount >= 5) verdict = 'review';
  else verdict = 'clear';
  return { findings: sorted, rankings, verdict };
}