import type { Finding } from '../report/schema.js';
import type { FileContent } from '../lib/context.js';

export interface AgentInput {
  target: string;
  kind: 'plan' | 'codebase';
  modelId: string;
  fileContents: FileContent[];
}

export interface AgentResult {
  findings: Finding[];
  score: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface VouchItAgent {
  id: 'security' | 'edge' | 'ops' | 'quality';
  displayName: string;
  audit(input: AgentInput): Promise<AgentResult>;
}