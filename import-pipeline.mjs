#!/usr/bin/env node

process.env.PIPELINE_RESEARCH_SOURCE ||= 'import';
process.env.PIPELINE_IMPORT_DIR ||= './research-drop';
process.env.PIPELINE_SCORING_PROVIDER ||= 'ollama';
process.env.PIPELINE_CONTENT_PROVIDER ||= 'ollama';

await import('./pipeline.mjs');
