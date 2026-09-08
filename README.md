# VouchIt

Verification layer for AI-generated work. A fleet of specialist agents (security, edge cases, ops/reliability, quality) audits a plan file or codebase and delivers one ranked risk report with a full audit trail.

## Install

```bash
npm i -g vouchit
```

Or run without installing:

```bash
npx vouchit <target>
```

## Quickstart

```bash
export OPENROUTER_API_KEY="sk-or-..."

# Audit a plan document
vouchit plan.md

# Audit a codebase directory
vouchit src/

# Audit current directory
vouchit .

# Emit JSON instead of markdown
vouchit src/ --json

# Run specific agents only
vouchit src/ --agents security,edge
```

## Fleet Agents

| Agent | Focus |
|-------|-------|
| **security** | Red-team audit: secrets exposure, injection, auth bypass, supply chain, data handling |
| **edge** | Edge-case hunter: boundary conditions, race conditions, timezone pitfalls, off-by-one |
| **ops** | Ops/reliability: deployment, scaling, observability, error handling, performance |
| **quality** | Quality review: maintainability, naming, dead code, test signals, API design |

## Report Format

Reports are written as both `report.json` (machine-readable, diffable) and `report.md` (human-readable):

- **Verdict:** `clear` (0 critical) · `review` (1-2 critical or 5+ warnings) · `block` (3+ critical)
- **Findings:** Ranked by severity with agent attribution, file location, and fix recommendations
- **Audit trail:** Git commit, Node/TS version, input hash, per-agent timing and token usage

## Diff

Compare two audit runs to track regressions:

```bash
vouchit diff run_abc123.json run_def456.json
vouchit diff run_abc123.json run_def456.json -o diff.json
```

## Config

Create a `.vouchit.json` in your project root:

```bash
vouchit init
```

```json
{
  "models": {
    "default": "deepseek/deepseek-chat-v3-0324",
    "backup": ["openrouter/deepseek/deepseek-v4-flash-free"],
    "agents": {
      "security": "deepseek/deepseek-chat-v3-0324"
    }
  },
  "output": {
    "dir": "./verify-output",
    "format": "both"
  }
}
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `VOUCHIT_API_KEY` or `OPENROUTER_API_KEY` | API key for model provider |
| `VOUCHIT_MODEL` | Default model override |
| `VOUCHIT_BASE_URL` | Custom API base URL |

CLI flags override config, config overrides env, env overrides defaults.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | **clear** — no critical findings |
| `1` | **review** — findings need human review |
| `2` | **block** — critical issues found, do not ship |

## Roadmap

- [ ] CI/CD gate mode (fail builds on block verdict)
- [ ] Incremental verification (watch mode)
- [ ] Custom agent plugins
- [ ] Hosted dashboard tier
- [ ] Multi-repo / monorepo support

## License

MIT