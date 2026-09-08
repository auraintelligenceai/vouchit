import type { VouchItAgent } from './agent.js';
import type { ModelFn } from '../models/types.js';
import { createSecurityAgent } from '../agents/security.js';
import { createEdgeAgent } from '../agents/edge.js';
import { createOpsAgent } from '../agents/ops.js';
import { createQualityAgent } from '../agents/quality.js';

export function loadAgents(selection: string | undefined, modelFn: ModelFn): VouchItAgent[] {
  const all: VouchItAgent[] = [
    createSecurityAgent(modelFn),
    createEdgeAgent(modelFn),
    createOpsAgent(modelFn),
    createQualityAgent(modelFn),
  ];
  if (!selection) return all;
  const wanted = new Set(selection.split(',').map((s) => s.trim().toLowerCase()));
  return all.filter((a) => wanted.has(a.id));
}