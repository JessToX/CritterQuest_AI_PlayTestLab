import assert from 'node:assert/strict';
import test from 'node:test';
import { createBatchPlan } from '../../lib/playtest/batch.ts';
import { DEFAULT_EXPERIMENT } from '../../lib/playtest/experiment.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { seats, snapshot } from '../fixtures/playtest.ts';

void test('batch plan keeps a fixed seed and the requested number of games', () => {
  const count = 6;
  const plan = createBatchPlan({
    experiment: {
      ...DEFAULT_EXPERIMENT,
      randomMode: 'fixed',
      missionMode: 'fair',
      seed: 42,
    },
    count,
    batchId: 'batch-test',
  });
  assert.equal(plan.batchSeed, 42);
  assert.equal(plan.plannedGames, count);
  assert.equal(plan.batch.id, 'batch-test');
  assert.deepEqual(plan.batch.gameIds, []);
});

void test('resuming runs one game and preserves its original batch seed', () => {
  const game = newRecord(
    seats.slice(0, 2),
    BASE_RULE,
    9,
    'simulation',
    snapshot,
  );
  const plan = createBatchPlan({
    resume: game,
    experiment: { ...DEFAULT_EXPERIMENT, seed: 999 },
    count: 100,
    batchId: 'resume-test',
  });
  assert.equal(plan.batchSeed, snapshot.batchSeed);
  assert.equal(plan.plannedGames, 1);
});
