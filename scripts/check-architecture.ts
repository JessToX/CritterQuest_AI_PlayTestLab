import { fileURLToPath } from 'node:url';
import { analyzeSources, readSources } from './architecture.ts';

const sources = readSources(fileURLToPath(new URL('../', import.meta.url)));
const issues = analyzeSources(sources);
for (const issue of issues)
  console.error(`${issue.file}:${issue.line}: ${issue.message}`);
if (issues.length) process.exitCode = 1;
else
  console.log(
    `Architecture OK: ${sources.size} source files; module boundaries, browser dependencies and runtime cycles checked.`,
  );
