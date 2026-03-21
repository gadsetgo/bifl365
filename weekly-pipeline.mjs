#!/usr/bin/env node

process.env.PIPELINE_RESEARCH_SOURCE ||= 'online';
process.env.PIPELINE_RESEARCH_PROVIDER ||= 'gemini';
process.env.PIPELINE_SCORING_PROVIDER ||= 'gemini';
process.env.PIPELINE_CONTENT_PROVIDER ||= 'gemini';

await import('./pipeline.mjs');
