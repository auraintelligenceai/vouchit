import { Command } from 'commander';
import { resolve, dirname } from 'node:path';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { version, name, nodeVersion, tsVersion } from '../lib/meta.js';
import { detectKind, readTarget } from '../lib/context.js';
import { sha256 } from '../lib/hash.js';
import { getGitInfo } from '../lib/git.js';
import { loadConfig } from '../lib/config.js';
import { createModelFnWithFallback, getModelUsage } from '../models/router.js';
import { loadAgents } from '../fleet/registry.js';
import { runFleet } from '../fleet/runner.js';
import { mergeFindings } from '../report/merge.js';
import { buildMarkdown } from '../report/markdown.js';
import { writeReportJson } from '../report/json.js';
import { diffReports, buildDiffMarkdown } from '../report/diff.js';
import type { AuditReport } from '../report/schema.js';

const program = new Command();

program
  .name(name)
  .description('Verification layer for AI-generated work')
  .version(version);

program
  .command('run')
  .description('audit a plan file or codebase directory')
  .argument('<target>', 'path to a plan file or directory to audit')
  .option('-a, --agents <list>', 'comma-separated agent selection (security,edge,ops,quality)')
  .option('-m, --model <name>', 'primary model id override')
  .option('-b, --backup <name>', 'additional backup model id')
  .option('--json', 'emit report.json instead of report.md')
  .option('-o, --output <dir>', 'output directory')
  .option('--config <path>', 'custom config file path')
  .action(async (target, opts) => {
    try {
      const targetPath = resolve(target);
      const kind = detectKind(targetPath);
      const fileContents = readTarget(targetPath, kind);
      const inputHash = sha256(fileContents.map((f) => f.content).join('\n'));
      const config = loadConfig(opts.config ? dirname(resolve(opts.config)) : undefined);
      const backupModels = opts.backup ? [opts.backup] : (config.models?.backup ?? []);
      const modelFn = createModelFnWithFallback({
        ...config,
        models: { ...config.models, ...(opts.model && { default: opts.model }), backup: backupModels },
      }, 'default', opts.model);
      const agents = loadAgents(opts.agents, modelFn);
      const agentInput = { target, kind, modelId: opts.model ?? config.models?.default ?? process.env.VOUCHIT_MODEL ?? 'deepseek/deepseek-chat-v3-0324', fileContents };
      const timedResults = await runFleet(agents, agentInput);
      const { findings, rankings, verdict } = mergeFindings(timedResults);
      const gitInfo = getGitInfo(targetPath);
      const report: AuditReport = {
        schema: 'vouchit-report-v1',
        run: {
          id: `run_${Date.now().toString(36)}`, model: agentInput.modelId, agents: agents.map((a) => a.id),
          timestamp: new Date().toISOString(), inputHash: `sha256:${inputHash}`, seed: String(Date.now()),
          nodeVersion, tsVersion,
          ...(gitInfo.commit && { gitCommit: gitInfo.commit }),
          ...(gitInfo.dirty !== undefined && { gitDirty: gitInfo.dirty }),
        },
        findings, rankings, verdict,
      };
      const outputDir = resolve(opts.output ?? config.output?.dir ?? './verify-output');
      const format = config.output?.format ?? 'both';
      if (opts.json || format === 'json') { const outPath = resolve(outputDir, `${report.run.id}.json`); writeReportJson(report, outPath); console.log(`Report written: ${outPath}`); }
      if (!opts.json && format !== 'json') { const md = buildMarkdown(report); const outPath = resolve(outputDir, `${report.run.id}.md`); mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, md, 'utf-8'); console.log(md); console.log(`\nReport written: ${outPath}`); }
      if (opts.json && format === 'both') { const jsonPath = resolve(outputDir, `${report.run.id}.json`); writeReportJson(report, jsonPath); console.log(`JSON written: ${jsonPath}`); }
      const usage = getModelUsage(modelFn);
      if (usage.length > 0) {
        const totalTokens = usage.reduce((s, u) => s + u.tokensUsed, 0);
        const totalMs = usage.reduce((s, u) => s + u.durationMs, 0);
        const models = [...new Set(usage.map((u) => u.model))];
        console.log(`\nModels used: ${models.join(', ')}`);
        console.log(`Tokens: ${totalTokens} total · ${totalMs}ms total`);
        for (const u of usage) { const status = u.success ? 'ok' : `FAIL: ${u.error}`; console.log(`  ${u.model}: ${u.tokensUsed} tokens, ${u.durationMs}ms — ${status}`); }
      }
      console.log(`\nVerdict: ${verdict.toUpperCase()}`);
      console.log(`Findings: ${findings.length} (${findings.filter((f) => f.severity === 'critical').length} critical, ${findings.filter((f) => f.severity === 'warning').length} warning)`);
      if (verdict === 'block') process.exit(2);
      if (verdict === 'review') process.exit(1);
      process.exit(0);
    } catch (err) { console.error(`Error: ${err instanceof Error ? err.message : err}`); process.exit(2); }
  });

program
  .command('diff')
  .description('show what changed between two audit runs')
  .argument('<runA>', 'earlier run report.json path')
  .argument('<runB>', 'later run report.json path')
  .option('-o, --output <path>', 'output diff.json path (optional)')
  .action(async (a, b, opts) => {
    try {
      const reportA: AuditReport = JSON.parse(readFileSync(resolve(a), 'utf-8'));
      const reportB: AuditReport = JSON.parse(readFileSync(resolve(b), 'utf-8'));
      const diff = diffReports(reportA, reportB);
      const md = buildDiffMarkdown(diff);
      console.log(md);
      if (opts.output) { const outPath = resolve(opts.output); mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, JSON.stringify(diff, null, 2), 'utf-8'); console.log(`\nDiff written: ${outPath}`); }
    } catch (err) { console.error(`Error: ${err instanceof Error ? err.message : err}`); process.exit(1); }
  });

program
  .command('init')
  .description('write a .vouchit.json config template')
  .action(async () => {
    const config = {
      models: {
        default: 'deepseek/deepseek-chat-v3-0324',
        backup: ['openrouter/deepseek/deepseek-v4-flash-free', 'qwen/qwen3-8b'],
        agents: { security: 'deepseek/deepseek-chat-v3-0324', edge: 'deepseek/deepseek-chat-v3-0324', ops: 'deepseek/deepseek-chat-v3-0324', quality: 'deepseek/deepseek-chat-v3-0324' },
      },
      output: { dir: './verify-output', format: 'both' },
    };
    writeFileSync('.vouchit.json', JSON.stringify(config, null, 2), 'utf-8');
    console.log('Created .vouchit.json');
  });

program.parse(process.argv);