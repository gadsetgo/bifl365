#!/usr/bin/env node

process.env.PIPELINE_RESEARCH_SOURCE ||= 'online';
process.env.PIPELINE_RESEARCH_PROVIDER ||= 'claude';
process.env.PIPELINE_SCORING_PROVIDER ||= 'claude';
process.env.PIPELINE_CONTENT_PROVIDER ||= 'claude';

await import('./pipeline.mjs');
