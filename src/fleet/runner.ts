import type { AgentInput, AgentResult, VouchItAgent } from './agent.js';

export interface TimedAgentResult {
  agentId: string;
  result: AgentResult;
  durationMs: number;
}

export async function runFleet(agents: VouchItAgent[], input: AgentInput): Promise<TimedAgentResult[]> {
  return Promise.all(
    agents.map(async (agent) => {
      const start = performance.now();
      const result = await agent.audit(input);
      const durationMs = Math.round(performance.now() - start);
      return { agentId: agent.id, result, durationMs };
    }),
  );
}