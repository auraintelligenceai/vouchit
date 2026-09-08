import { describe, it, expect } from 'vitest';
import type { ModelFn } from '../src/models/types.js';
import { createEdgeAgent } from '../src/agents/edge.js';
import type { AgentInput } from '../src/fleet/agent.js';

function fakeModelFn(response: string): ModelFn { return async () => ({ text: response, tokensUsed: 100 }); }
function badModelFn(): ModelFn { return async () => ({ text: 'I am not a JSON response, just plain text.', tokensUsed: 50 }); }
function makeInput(fileContents: { path: string; content: string }[] = []): AgentInput {
  return { target: 'tests/fixtures/sample-plan.md', kind: 'plan', modelId: 'fake-model', fileContents: fileContents.length > 0 ? fileContents : [{ path: 'sample-plan.md', content: '# Todo API\n\nA simple REST API.' }] };
}

describe('edge agent', () => {
  it('returns findings from valid model output', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'warning', title: 'No pagination limit', evidence: 'API endpoint /api/todos accepts no limit parameter', recommendation: 'Add max limit of 100 items per page' }], score: 75, summary: 'Minor edge-case gaps' }));
    const agent = createEdgeAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('warning');
    expect(result.findings[0].id).toBe('EDG-001');
    expect(result.score).toBe(75);
  });
  it('returns empty findings when model finds no issues', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [], score: 100, summary: 'No edge-case issues detected' }));
    const agent = createEdgeAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(0);
    expect(result.score).toBe(100);
  });
  it('returns low confidence for unparseable model output', async () => {
    const agent = createEdgeAgent(badModelFn());
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].title).toContain('unparseable');
    expect(result.score).toBe(0);
  });
  it('handles JSON wrapped in markdown code fences', async () => {
    const payload = JSON.stringify({ findings: [{ severity: 'info', title: 'Handled', evidence: 'Empty input guarded', recommendation: 'None needed' }], score: 90, summary: 'Well covered' });
    const modelFn = fakeModelFn('```json\n' + payload + '\n```');
    const agent = createEdgeAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.score).toBe(90);
  });
  it('validates zod schema rejects invalid severity', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'fatal', title: 'Bad', evidence: 'Bad', recommendation: 'Fix' }], score: 50, summary: 'Test' }));
    const agent = createEdgeAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('validates zod schema rejects missing required fields', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'warning', title: '', evidence: '', recommendation: '' }], score: 50, summary: 'Test' }));
    const agent = createEdgeAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('rejects score outside 0-100 range via zod', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [], score: -10, summary: 'Negative score' }));
    const agent = createEdgeAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('handles model response with extra whitespace', async () => {
    const modelFn = fakeModelFn('  \n' + JSON.stringify({ findings: [{ severity: 'info', title: 'Handled', evidence: 'Race condition prevented', recommendation: 'Keep mutex' }], score: 95, summary: 'Clean' }) + '\n  ');
    const agent = createEdgeAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.score).toBe(95);
  });
  it('agent id and displayName are correct', () => {
    const agent = createEdgeAgent(fakeModelFn(''));
    expect(agent.id).toBe('edge');
    expect(agent.displayName).toBe('Edge-Case Hunter');
  });
});