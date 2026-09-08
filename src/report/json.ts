import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuditReport } from './schema.js';

export function writeReportJson(report: AuditReport, outputPath: string): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}