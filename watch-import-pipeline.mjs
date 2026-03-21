#!/usr/bin/env node

import { mkdirSync, watch, readdirSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';

const importDir = resolve(process.cwd(), process.env.PIPELINE_IMPORT_DIR || './research-drop');
mkdirSync(importDir, { recursive: true });

let isRunning = false;
let shouldRunAgain = false;

function runImporter(reason) {
  if (isRunning) {
    shouldRunAgain = true;
    return;
  }

  isRunning = true;
  console.log(`[watch] Running import pipeline (${reason})`);

  const child = spawn(process.execPath, ['import-pipeline.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env
  });

  child.on('exit', () => {
    isRunning = false;
    if (shouldRunAgain) {
      shouldRunAgain = false;
      setTimeout(() => runImporter('queued changes'), 250);
    }
  });
}

console.log(`[watch] Watching ${importDir} for JSON research bundles...`);
console.log('[watch] Drop files into research-drop and leave this process running.');

watch(importDir, (eventType, filename) => {
  if (!filename || !filename.toLowerCase().endsWith('.json')) return;
  runImporter(`${eventType}: ${filename}`);
});

const existingFiles = readdirSync(importDir).filter((f) => f.toLowerCase().endsWith('.json'));
if (existingFiles.length > 0) {
  runImporter('startup');
} else {
  console.log('[watch] No pending JSON files at startup — waiting for drops.');
}

