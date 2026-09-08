import { describe, it, expect } from 'vitest';
import { loadAgents } from '../src/fleet/registry.js';
import type { ModelFn } from '../src/models/types.js';

const fakeModel: ModelFn = async () => ({ text: '', tokensUsed: 0 });

describe('loadAgents', () => {
  it('loads all agents when no selection', () => {
    const agents = loadAgents(undefined, fakeModel);
    expect(agents).toHaveLength(4);
    expect(agents.map((a) => a.id)).toEqual(['security', 'edge', 'ops', 'quality']);
  });
  it('filters by selection', () => {
    const agents = loadAgents('security,edge', fakeModel);
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.id)).toEqual(['security', 'edge']);
  });
  it('filters single agent', () => {
    const agents = loadAgents('quality', fakeModel);
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('quality');
  });
  it('returns empty for unknown agent', () => {
    const agents = loadAgents('nonexistent', fakeModel);
    expect(agents).toHaveLength(0);
  });
});