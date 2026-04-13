#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runConfiguredSheetNotes } from './sheets/apply-sheet-notes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = resolve(__dirname, '..', 'hirayama-jyusei-strategy', 'config', 'jbiz04-sheet-notes.json');

runConfiguredSheetNotes({
  argv: process.argv.slice(2),
  configPath: CONFIG_PATH,
}).catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
