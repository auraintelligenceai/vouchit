import { defineConfig } from 'tsup';

export default defineConfig({ entry: ['src/cli/index.ts'], format: ['esm'], outDir: 'dist', target: 'node20', platform: 'node', splitting: false, clean: true, sourcemap: false, banner: { js: '#!/usr/bin/env node' }, noExternal: [] });