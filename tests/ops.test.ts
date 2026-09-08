import { describe, it, expect } from 'vitest';
import type { ModelFn } from '../src/models/types.js';
import { createOpsAgent } from '../src/agents/ops.js';
import type { AgentInput } from '../src/fleet/agent.js';

function fakeModelFn(response: string): ModelFn { return async () => ({ text: response, tokensUsed: 100 }); }
function badModelFn(): ModelFn { return async () => ({ text: 'I am not a JSON response, just plain text.', tokensUsed: 50 }); }
function makeInput(fileContents: { path: string; content: string }[] = []): AgentInput {
  return { target: 'tests/fixtures/sample-plan.md', kind: 'plan', modelId: 'fake-model', fileContents: fileContents.length > 0 ? fileContents : [{ path: 'sample-plan.md', content: '# Todo API\n\nA simple REST API.' }] };
}

describe('ops agent', () => {
  it('returns findings from valid model output', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'critical', title: 'No health check endpoint', evidence: 'Service has no /health or /ready endpoint', recommendation: 'Add health check for load balancer and container orchestration' }], score: 40, summary: 'Missing critical ops infrastructure' }));
    const agent = createOpsAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].id).toBe('OPS-001');
    expect(result.score).toBe(40);
  });
  it('returns empty findings when model finds no issues', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [], score: 100, summary: 'No ops issues detected' }));
    const agent = createOpsAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(0);
    expect(result.score).toBe(100);
  });
  it('returns low confidence for unparseable model output', async () => {
    const agent = createOpsAgent(badModelFn());
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].title).toContain('unparseable');
    expect(result.score).toBe(0);
  });
  it('handles JSON wrapped in markdown code fences', async () => {
    const payload = JSON.stringify({ findings: [{ severity: 'info', title: 'Logging present', evidence: 'Structured logging configured', recommendation: 'None' }], score: 90, summary: 'Good observability' });
    const modelFn = fakeModelFn('```json\n' + payload + '\n```');
    const agent = createOpsAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.score).toBe(90);
  });
  it('validates zod schema rejects invalid severity', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'disaster', title: 'Bad', evidence: 'Bad', recommendation: 'Fix' }], score: 50, summary: 'Test' }));
    const agent = createOpsAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('validates zod schema rejects missing required fields', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'warning', title: '', evidence: '', recommendation: '' }], score: 50, summary: 'Test' }));
    const agent = createOpsAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('rejects score outside 0-100 range via zod', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [], score: 200, summary: 'Impossible' }));
    const agent = createOpsAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('handles model response with extra whitespace', async () => {
    const modelFn = fakeModelFn('  \n' + JSON.stringify({ findings: [{ severity: 'info', title: 'Deploy configured', evidence: 'CI/CD pipeline defined', recommendation: 'None' }], score: 95, summary: 'Clean' }) + '\n  ');
    const agent = createOpsAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.score).toBe(95);
  });
  it('agent id and displayName are correct', () => {
    const agent = createOpsAgent(fakeModelFn(''));
    expect(agent.id).toBe('ops');
    expect(agent.displayName).toBe('Ops / Reliability');
  });
});