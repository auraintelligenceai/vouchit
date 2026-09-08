export interface Finding {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  agent: string;
  title: string;
  evidence: string;
  file?: string;
  line?: number;
  recommendation: string;
}

export interface AgentRun {
  agent: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  durationMs: number;
}

export interface AuditReport {
  schema: string;
  run: {
    id: string;
    model: string;
    agents: string[];
    timestamp: string;
    inputHash: string;
    seed: string;
    gitCommit?: string;
    gitDirty?: boolean;
    nodeVersion: string;
    tsVersion: string;
  };
  findings: Finding[];
  rankings: AgentRun[];
  verdict: 'block' | 'review' | 'clear';
}