import { z } from 'zod';
import type { VouchItAgent, AgentInput, AgentResult } from '../fleet/agent.js';
import type { ModelFn } from '../models/types.js';
import type { Finding } from '../report/schema.js';

const FindingSchema = z.object({ severity: z.enum(['critical', 'warning', 'info']), title: z.string().min(1), evidence: z.string().min(1), file: z.string().optional(), line: z.number().int().positive().optional(), recommendation: z.string().min(1) });
const LLMResponseSchema = z.object({ findings: z.array(FindingSchema), score: z.number().min(0).max(100), summary: z.string() });

const SYSTEM_PROMPT = `You are a code quality reviewer. Given a plan document or codebase, identify maintainability issues, design problems, and quality concerns.\n\nFocus on: Maintainability, Naming/clarity, Dead/duplicate code, Cohesion/coupling, Test signals, API design, Documentation freshness, Dependency hygiene.\n\nRESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no wrapping):\n{\"findings\": [{\"severity\": \"critical\" | \"warning\" | \"info\", \"title\": \"short title\", \"evidence\": \"quality issue\", \"file\": \"path/to/file\", \"line\": 42, \"recommendation\": \"how to improve\"}], \"score\": <0-100>, \"summary\": \"one-line summary\"}\n\nRules: critical = will cause bugs/unmaintainable. warning = tech debt. info = observation. score: 100=exemplary, 75=minor nits, 50=needs refactor, 25=serious debt, 0=unmaintainable.`;

function buildUserPrompt(input: AgentInput, fileContents: string): string {
  const header = input.kind === 'plan' ? `AUDIT TARGET: Plan document \"${input.target}\"` : `AUDIT TARGET: Codebase directory \"${input.target}\"`;
  return `${header}\n\nAnalyze the following content for code quality and maintainability issues.\n\n---\n${fileContents.slice(0, 12000)}\n---\n\nProvide your findings in the exact JSON format specified.`;
}

function mapFindings(raw: z.infer<typeof FindingSchema>[], agentName: string): Finding[] {
  return raw.map((f, i) => ({ id: `${agentName.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`, severity: f.severity, agent: agentName, title: f.title, evidence: f.evidence, file: f.file, line: f.line, recommendation: f.recommendation }));
}

function deriveConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

export function createQualityAgent(modelFn: ModelFn): VouchItAgent {
  return {
    id: 'quality', displayName: 'Quality Reviewer',
    async audit(input: AgentInput): Promise<AgentResult> {
      const fileContents = input.fileContents.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n');
      const userPrompt = buildUserPrompt(input, fileContents);
      const { text } = await modelFn(SYSTEM_PROMPT, userPrompt, { maxTokens: 4096, temperature: 0.2 });
      let parsed: z.infer<typeof LLMResponseSchema>;
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = LLMResponseSchema.parse(JSON.parse(cleaned));
      } catch {
        return { findings: [{ id: 'QUA-000', severity: 'info', agent: 'quality', title: 'Quality agent returned unparseable output', evidence: text.slice(0, 500), recommendation: 'Retry with a different model or check model availability' }], score: 0, confidence: 'low' };
      }
      return { findings: mapFindings(parsed.findings, 'quality'), score: parsed.score, confidence: deriveConfidence(parsed.score) };
    },
  };
}