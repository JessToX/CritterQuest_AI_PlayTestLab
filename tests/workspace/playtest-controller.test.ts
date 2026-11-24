import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { usePlaytestController } from '../../features/workspace/use-playtest-controller.ts';
import type { GameRecord } from '../../lib/playtest/types.ts';
import type { runBatch } from '../../lib/playtest/batch.ts';
import type { runGame } from '../../lib/playtest/run-game.ts';

function compileHook(filename: string) {
  const source = readFileSync(
    new URL('../../features/workspace/' + filename, import.meta.url),
    'utf8',
  );
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ESNext,
    },
  }).outputText;
}
const controllerCode = compileHook('use-playtest-controller.ts');
const recordsCode = compileHook('use-workspace-records.ts');

function game(id: string, status: GameRecord['status'] = 'complete') {
  return { id, status, mode: 'simulation', rule: { id: 'v71' } } as GameRecord;
}

// Retain state and refs across renders while controlling each asynchronous boundary.
function mount({
  save = async () => {},
  batch,
  summary,
}: {
  save?: (id: string, kind: string) => Promise<void>;
  batch: typeof runBatch;
  summary: typeof runGame;
}) {
  const slots: unknown[] = [];
  let cursor = 0;
  const modules: Record<string, object> = {
    react: {
      useState(initial: unknown) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = initial;
        return [
          slots[i],
          (value: unknown) => {
            slots[i] = typeof value === 'function' ? value(slots[i]) : value;
          },
        ];
      },
      useRef(initial: unknown) {
        const i = cursor++;
        return (slots[i] ??= { current: initial });
      },
      useEffect() {},
      useCallback<T>(callback: T) {
        return callback;
      },
    },
    '@/lib/game/registry': {
      engineRegistration: () => ({ capabilities: { minimumPlayers: 2 } }),
    },
    '@/lib/client/records': { save },
    '@/lib/playtest/batch': { runBatch: batch },
    '@/lib/playtest/run-game': { runGame: summary },
    '@/lib/playtest/resume': { summarySeats: () => [] },
    '@/lib/rules/versions': { BASE_RULE: { id: 'v71', unsupported: [] } },
    '../playtest/use-model-context.ts': { useModelContext() {} },
    '../playtest/use-configuration.ts': {
      useConfiguration: () => ({
        seats: [{ enabled: true }, { enabled: true }],
        experiment: { memoryBudgetChars: 100 },
      }),
    },
  };
  const exports = {} as { usePlaytestController: typeof usePlaytestController };
  function evaluate(code: string, moduleExports: object) {
    runInNewContext(code, {
      exports: moduleExports,
      require: (path: string) => modules[path] ?? {},
      AbortController,
      structuredClone,
      Error,
    });
  }
  const records = {};
  evaluate(recordsCode, records);
  modules['./use-workspace-records.ts'] = records;
  evaluate(controllerCode, exports);
  return () => {
    cursor = 0;
    return exports.usePlaytestController();
  };
}

void test('failed save survives attempts to write and start another game', async () => {
  let rejectA = true;
  let summaries = 0;
  let batches = 0;
  const render = mount({
    save: async (id, kind) => {
      if (kind === 'game' && id === 'A' && rejectA)
        throw new Error('disk unavailable');
    },
    batch: async (options) => {
      batches++;
      options.onCurrent(game('A'));
      await options.persistGame(game('A'));
    },
    summary: async (record, _seats, _entries, options) => {
      summaries++;
      await options.save(record);
      return record;
    },
  });
  await render().start('simulation');
  assert.equal(render().unsavedGame?.id, 'A');
  await render().repairSummaries(game('B'));
  assert.equal(render().unsavedGame?.id, 'A');
  assert.equal(summaries, 0);
  await render().start('simulation');
  assert.equal(batches, 1);
  await render().retryUnsavedGame();
  assert.equal(render().unsavedGame?.id, 'A');
  rejectA = false;
  await render().retryUnsavedGame();
  assert.equal(render().unsavedGame, null);
});

void test('a terminated batch owns cancellation until its final save settles', async () => {
  const enteredBatch = Promise.withResolvers<void>();
  const enteredFinalSave = Promise.withResolvers<void>();
  const finishFinalSave = Promise.withResolvers<void>();
  const enteredSummary = Promise.withResolvers<void>();
  const exitSummary = Promise.withResolvers<void>();
  const startedB = Promise.withResolvers<void>();
  const finishB = Promise.withResolvers<void>();
  let batches = 0;
  let batchSignal: AbortSignal | undefined;
  let summarySignal: AbortSignal | undefined;
  let secondSignal: AbortSignal | undefined;
  const render = mount({
    batch: async (options) => {
      if (++batches === 1) {
        batchSignal = options.signal;
        const terminated = new Promise<void>((resolve) => {
          options.signal.addEventListener('abort', () => resolve(), {
            once: true,
          });
        });
        enteredBatch.resolve();
        await terminated;
        await options.onTerminated(game('A', 'terminated'));
        enteredFinalSave.resolve();
        await finishFinalSave.promise;
      } else {
        secondSignal = options.signal;
        startedB.resolve();
        await finishB.promise;
      }
    },
    summary: async (record, _seats, _entries, options) => {
      summarySignal = options.signal;
      enteredSummary.resolve();
      await exitSummary.promise;
      return record;
    },
  });
  const first = render().start('simulation');
  await enteredBatch.promise;
  await render().terminateGame();
  await enteredSummary.promise;
  render().pauseRun();
  assert.equal(summarySignal?.reason, 'user-pause');
  assert.equal(batchSignal?.reason, 'terminate');
  exitSummary.resolve();
  await enteredFinalSave.promise;
  try {
    assert.equal(render().running, true);
    await render().start('simulation');
    assert.equal(batches, 1);
  } finally {
    finishFinalSave.resolve();
    await first;
  }
  const second = render().start('simulation');
  await startedB.promise;
  render().pauseRun();
  assert.equal(secondSignal?.reason, 'user-pause');
  finishB.resolve();
  await second;
});

void test('retry shares one pending write across rerenders and concurrent clicks', async () => {
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  let writes = 0;
  const render = mount({
    save: async (_id, kind) => {
      if (kind !== 'game') return;
      if (++writes === 1) throw new Error('storage unavailable');
      entered.resolve();
      await finish.promise;
    },
    batch: async (options) => {
      await options.persistGame(game('pending'));
    },
    summary: async (record) => record,
  });
  await render().start('simulation');
  const retry = render().retryUnsavedGame();
  try {
    await entered.promise;
    assert.equal(render().retryingSave, true);
    await render().retryUnsavedGame();
    assert.equal(writes, 2);
  } finally {
    finish.resolve();
    await retry;
  }
  assert.equal(render().unsavedGame, null);
  assert.equal(render().retryingSave, false);
});
