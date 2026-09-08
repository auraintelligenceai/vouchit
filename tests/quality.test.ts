import { describe, it, expect } from 'vitest';
import type { ModelFn } from '../src/models/types.js';
import { createQualityAgent } from '../src/agents/quality.js';
import type { AgentInput } from '../src/fleet/agent.js';

function fakeModelFn(response: string): ModelFn { return async () => ({ text: response, tokensUsed: 100 }); }
function badModelFn(): ModelFn { return async () => ({ text: 'I am not a JSON response, just plain text.', tokensUsed: 50 }); }
function makeInput(fileContents: { path: string; content: string }[] = []): AgentInput {
  return { target: 'tests/fixtures/sample-plan.md', kind: 'plan', modelId: 'fake-model', fileContents: fileContents.length > 0 ? fileContents : [{ path: 'sample-plan.md', content: '# Todo API\n\nA simple REST API.' }] };
}

describe('quality agent', () => {
  it('returns findings from valid model output', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'warning', title: 'Inconsistent naming convention', evidence: 'Mixed camelCase and snake_case in API responses', recommendation: 'Standardize on one naming convention' }], score: 70, summary: 'Minor quality issues' }));
    const agent = createQualityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('warning');
    expect(result.findings[0].id).toBe('QUA-001');
    expect(result.score).toBe(70);
  });
  it('returns empty findings when model finds no issues', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [], score: 100, summary: 'No quality issues detected' }));
    const agent = createQualityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(0);
    expect(result.score).toBe(100);
  });
  it('returns low confidence for unparseable model output', async () => {
    const agent = createQualityAgent(badModelFn());
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].title).toContain('unparseable');
    expect(result.score).toBe(0);
  });
  it('handles JSON wrapped in markdown code fences', async () => {
    const payload = JSON.stringify({ findings: [{ severity: 'info', title: 'Clean code', evidence: 'Well structured', recommendation: 'None' }], score: 95, summary: 'Excellent quality' });
    const modelFn = fakeModelFn('```json\n' + payload + '\n```');
    const agent = createQualityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.score).toBe(95);
  });
  it('validates zod schema rejects invalid severity', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'blocker', title: 'Bad', evidence: 'Bad', recommendation: 'Fix' }], score: 50, summary: 'Test' }));
    const agent = createQualityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('validates zod schema rejects missing required fields', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'info', title: '', evidence: '', recommendation: '' }], score: 50, summary: 'Test' }));
    const agent = createQualityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('rejects score outside 0-100 range via zod', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [], score: -5, summary: 'Negative' }));
    const agent = createQualityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('handles model response with extra whitespace', async () => {
    const modelFn = fakeModelFn('  \n' + JSON.stringify({ findings: [{ severity: 'info', title: 'Well documented', evidence: 'JSDoc on public APIs', recommendation: 'None' }], score: 98, summary: 'Clean' }) + '\n  ');
    const agent = createQualityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.score).toBe(98);
  });
  it('agent id and displayName are correct', () => {
    const agent = createQualityAgent(fakeModelFn(''));
    expect(agent.id).toBe('quality');
    expect(agent.displayName).toBe('Quality Reviewer');
  });
});