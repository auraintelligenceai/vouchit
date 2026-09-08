import { describe, it, expect } from 'vitest';
import type { ModelFn } from '../src/models/types.js';
import { createSecurityAgent } from '../src/agents/security.js';
import type { AgentInput } from '../src/fleet/agent.js';

function fakeModelFn(response: string): ModelFn {
  return async () => ({ text: response, tokensUsed: 100 });
}
function badModelFn(): ModelFn {
  return async () => ({ text: 'I am not a JSON response, just plain text.', tokensUsed: 50 });
}
function makeInput(fileContents: { path: string; content: string }[] = []): AgentInput {
  return { target: 'tests/fixtures/sample-plan.md', kind: 'plan', modelId: 'fake-model', fileContents: fileContents.length > 0 ? fileContents : [{ path: 'sample-plan.md', content: '# Todo API\n\nA simple REST API.' }] };
}

describe('security agent', () => {
  it('returns findings from valid model output', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'warning', title: 'JWT stored in memory', evidence: 'Token not persisted in HTTP-only cookie', recommendation: 'Use HTTP-only secure cookies for JWT storage' }], score: 75, summary: 'Minor auth concern' }));
    const agent = createSecurityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('warning');
    expect(result.findings[0].id).toBe('SEC-001');
    expect(result.score).toBe(75);
  });
  it('returns empty findings when model finds no issues', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [], score: 100, summary: 'No issues found' }));
    const agent = createSecurityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(0);
    expect(result.score).toBe(100);
  });
  it('handles multiple findings with correct IDs', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [
      { severity: 'critical', title: 'Exposed API key', evidence: 'Hardcoded key on line 5', recommendation: 'Use env vars' },
      { severity: 'warning', title: 'Weak CORS', evidence: 'Allows all origins', recommendation: 'Restrict to domain' },
      { severity: 'info', title: 'Debug logging', evidence: 'Console.log in production path', recommendation: 'Remove or gate behind flag' },
    ], score: 40, summary: 'Mixed issues' }));
    const agent = createSecurityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(3);
    expect(result.findings[0].id).toBe('SEC-001');
    expect(result.findings[1].id).toBe('SEC-002');
    expect(result.findings[2].id).toBe('SEC-003');
    expect(result.score).toBe(40);
  });
  it('returns low confidence for unparseable model output', async () => {
    const agent = createSecurityAgent(badModelFn());
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].title).toContain('unparseable');
    expect(result.score).toBe(0);
  });
  it('handles JSON wrapped in markdown code fences', async () => {
    const payload = JSON.stringify({ findings: [{ severity: 'info', title: 'Test', evidence: 'Evidence text', recommendation: 'Do something' }], score: 90, summary: 'Looks good' });
    const modelFn = fakeModelFn('```json\n' + payload + '\n```');
    const agent = createSecurityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.score).toBe(90);
  });
  it('validates zod schema rejects invalid severity', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'super-critical', title: 'Bad', evidence: 'Bad', recommendation: 'Fix' }], score: 50, summary: 'Test' }));
    const agent = createSecurityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('validates zod schema rejects missing required fields', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [{ severity: 'warning', title: '', evidence: '', recommendation: '' }], score: 50, summary: 'Test' }));
    const agent = createSecurityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('rejects score outside 0-100 range via zod', async () => {
    const modelFn = fakeModelFn(JSON.stringify({ findings: [], score: 150, summary: 'Impossible score' }));
    const agent = createSecurityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.score).toBe(0);
  });
  it('handles model response with extra whitespace', async () => {
    const modelFn = fakeModelFn('  \n' + JSON.stringify({ findings: [{ severity: 'info', title: 'Minor', evidence: 'Minor thing', recommendation: 'Keep' }], score: 95, summary: 'Clean' }) + '\n  ');
    const agent = createSecurityAgent(modelFn);
    const result = await agent.audit(makeInput());
    expect(result.findings).toHaveLength(1);
    expect(result.score).toBe(95);
  });
  it('agent id and displayName are correct', () => {
    const agent = createSecurityAgent(fakeModelFn(''));
    expect(agent.id).toBe('security');
    expect(agent.displayName).toBe('Security Red-Team');
  });
});