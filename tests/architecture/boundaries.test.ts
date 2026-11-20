import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeSources, readSources } from '../../scripts/architecture.ts';

function messages(sources: Record<string, string>) {
  return analyzeSources(new Map(Object.entries(sources))).map(
    (issue) => issue.message,
  );
}

void test('production source tree satisfies the architecture contract', () => {
  assert.deepEqual(analyzeSources(readSources(process.cwd())), []);
});

void test('core game cannot depend on UI, including alias type imports', () => {
  assert.ok(
    messages({
      'lib/game/types.ts':
        "import type { View } from '@/features/playtest/view';",
      'features/playtest/view.ts': 'export type View = string;',
    }).some((message) => message.includes('Forbidden dependency')),
  );
});

void test('report policy cannot import browser persistence', () => {
  assert.ok(
    messages({
      'lib/reports/management.ts':
        "export { save } from '../client/records.ts';",
      'lib/client/records.ts': 'export const save = () => {};',
    }).some((message) => message.includes('Forbidden dependency')),
  );
});

void test('workspace can compose features; sibling features cannot depend on one another', () => {
  const sources = {
    'features/workspace/workspace.ts':
      "import '../reports/panel.ts'; import '../playtest/panel.ts';",
    'features/reports/panel.ts': '',
    'features/playtest/panel.ts': '',
  };
  assert.deepEqual(messages(sources), []);
  sources['features/playtest/panel.ts'] = "import '../reports/panel.ts';";
  assert.equal(messages(sources).length, 1);
});

void test('game engine internals are private outside the game module', () => {
  assert.ok(
    messages({
      'lib/playtest/simulation.ts': "import '../game/engines/v71.ts';",
      'lib/game/engines/v71.ts': '',
    }).some((message) => message.includes('Forbidden dependency')),
  );
});

void test('server model code cannot enter the browser through a re-export', () => {
  assert.ok(
    messages({
      'features/playtest/panel.ts': "import '@/lib/agents/bridge';",
      'lib/agents/bridge.ts': "export * from './model.ts';",
      'lib/agents/model.ts': '',
    }).some((message) =>
      message.includes('Server module is browser-reachable'),
    ),
  );
});

void test('dynamic imports, require and side-effect imports cannot bring Node into UI', () => {
  for (const expression of [
    "import('node:fs')",
    "require('fs')",
    "import 'node:fs'",
  ])
    assert.ok(
      messages({ 'features/playtest/panel.ts': expression }).some((message) =>
        message.includes('Server package is browser-reachable'),
      ),
    );
});

void test('type-only edges do not create runtime cycles; mixed imports do', () => {
  const sources = {
    'lib/game/a.ts': "import { type State } from './b.ts';",
    'lib/game/b.ts': "export { run } from './a.ts';",
  };
  assert.deepEqual(messages(sources), []);
  sources['lib/game/a.ts'] = "import { type State, run } from './b.ts';";
  assert.ok(
    messages(sources).some((message) =>
      message.includes('Runtime import cycle'),
    ),
  );
});

void test('type re-exports and import type expressions remain erased dependencies', () => {
  assert.deepEqual(
    messages({
      'lib/game/a.ts':
        "export { type State } from './b.ts'; type Other = import('./b.ts').State;",
      'lib/game/b.ts': "import './a.ts';",
    }),
    [],
  );
});

void test('missing local modules and nonliteral dynamic imports fail closed', () => {
  assert.ok(
    messages({ 'lib/game/a.ts': "import './missing.ts';" }).some((message) =>
      message.includes('Unresolved local module'),
    ),
  );
  assert.ok(
    messages({ 'features/playtest/panel.ts': 'import(moduleName)' }).some(
      (message) => message.includes('literal module path'),
    ),
  );
});
