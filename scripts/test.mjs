import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function discover(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory()
      ? discover(file)
      : entry.name.endsWith('.test.ts')
        ? [file]
        : [];
  });
}
const files = discover('tests').sort();
if (!files.length) throw new Error('No test files discovered');
console.log(`Discovered ${files.length} test files`);
const result = spawnSync(
  process.execPath,
  ['--test', '--experimental-strip-types', ...process.argv.slice(2), ...files],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
