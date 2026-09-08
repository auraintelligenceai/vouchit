import { describe, it, expect } from 'vitest';
import type { ModelFn } from '../src/models/types.js';
import { loadAgents } from '../src/fleet/registry.js';
import { runFleet } from '../src/fleet/runner.js';
import { mergeFindings } from '../src/report/merge.js';
import type { AgentInput } from '../src/fleet/agent.js';

function fakeModelFn(response: string): ModelFn { return async () => ({ text: response, tokensUsed: 100 }); }
function makeInput(): AgentInput { return { target: 'tests/fixtures/sample-plan.md', kind: 'plan', modelId: 'fake-model', fileContents: [{ path: 'sample-plan.md', content: '# Todo API\n\nA simple REST API with auth.' }] }; }

describe('fleet integration', () => {
  it('loads all 4 agents', () => {
    const agents = loadAgents(undefined, fakeModelFn(''));
    expect(agents).toHaveLength(4);
    expect(agents.map((a) => a.id)).toEqual(['security', 'edge', 'ops', 'quality']);
  });
  it('runs all 4 agents in parallel via runFleet', async () => {
    const cleanResponse = JSON.stringify({ findings: [], score: 100, summary: 'No issues' });
    const agents = loadAgents(undefined, fakeModelFn(cleanResponse));
    const results = await runFleet(agents, makeInput());
    expect(results).toHaveLength(4);
    for (const result of results) { expect(result.result.findings).toHaveLength(0); expect(result.result.score).toBe(100); expect(result.durationMs).toBeGreaterThanOrEqual(0); }
  });
  it('each agent produces correct finding IDs', async () => {
    const findingResponse = JSON.stringify({ findings: [{ severity: 'info', title: 'Test', evidence: 'Evidence', recommendation: 'Rec' }], score: 85, summary: 'Test' });
    const agents = loadAgents(undefined, fakeModelFn(findingResponse));
    const results = await runFleet(agents, makeInput());
    expect(results[0].result.findings[0].id).toBe('SEC-001');
    expect(results[1].result.findings[0].id).toBe('EDG-001');
    expect(results[2].result.findings[0].id).toBe('OPS-001');
    expect(results[3].result.findings[0].id).toBe('QUA-001');
  });
  it('merges results from all agents correctly', async () => {
    const agents = loadAgents(undefined, fakeModelFn(JSON.stringify({ findings: [{ severity: 'warning', title: 'Issue', evidence: 'Found', recommendation: 'Fix' }], score: 70, summary: 'Some issues' })));
    const results = await runFleet(agents, makeInput());
    const { findings, rankings, verdict } = mergeFindings(results);
    expect(findings).toHaveLength(4);
    expect(rankings).toHaveLength(4);
    expect(rankings.map((r) => r.agent)).toEqual(['security', 'edge', 'ops', 'quality']);
    expect(['clear', 'review', 'block']).toContain(verdict);
  });
  it('filters agents by selection', () => {
    const agents = loadAgents('security,quality', fakeModelFn(''));
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.id)).toEqual(['security', 'quality']);
  });
});