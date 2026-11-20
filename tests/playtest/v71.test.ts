import assert from 'node:assert/strict';
import test from 'node:test';
import { newRecord } from '../../lib/playtest/record.ts';
import { runGame } from '../../lib/playtest/run-game.ts';
import { runBatch } from '../../lib/playtest/batch.ts';
import { normalizeExperiment } from '../../lib/playtest/experiment.ts';
import { simulationCall } from '../../lib/playtest/simulation.ts';
import { packRecord, unpackRecord } from '../../lib/records/codec.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import type { GameRecord } from '../../lib/playtest/types.ts';
import type { PublicMarketState } from '../../lib/game/market-types.ts';
import { opts, seats, snapshot } from '../fixtures/playtest.ts';
import { buy, fixture, invariant, market, top } from '../fixtures/v71.ts';

void test('V7.1 normalizes obsolete role-rotation settings and locks quick mode and no-cap experiments into the saved rule', () => {
  const experiment = {
    ...snapshot,
    missionMode: 'rotation' as const,
    firstPlayer: 1,
    turnDirection: 'counterclockwise' as const,
    pattern: '4' as const,
    ordersToWin: 2 as const,
    foodLimitOverride: 0 as const,
  };
  const normalized = normalizeExperiment(BASE_RULE.config, experiment);
  assert.equal(normalized.missionMode, 'fair');
  assert.equal(normalized.pattern, '2+1+1');
  assert.equal(normalized.firstPlayer, 'random');
  assert.equal(normalized.turnDirection, 'clockwise');
  const r = newRecord(
    seats.slice(0, 2),
    BASE_RULE,
    71,
    'simulation',
    experiment,
  );
  assert.equal(r.state.marketGame!.ordersToWin, 2);
  assert.equal(r.rule.config.ordersToWin, 2);
  assert.equal(r.rule.config.foodLimit, 0);
  assert.equal(r.state.turnDirection, 1);
  assert.ok(
    r.state.players.every((p) => p.character === null && p.mission === null),
  );
  assert.equal(BASE_RULE.config.foodLimit, 6);
  assert.equal(BASE_RULE.config.ordersToWin, 3);
});

void test('V7.1 recipient decision resumes through compressed storage with no second payment, refill or Super draw', async () => {
  const r = newRecord(seats.slice(0, 2), BASE_RULE, 71, 'simulation');
  r.state = market(fixture(), 'super-1');
  top(r.state, 'seed-normal-12', 'super-2', 'rotten-1');
  r.state = buy(r.state, 'super-1', 'player-2');
  r.state.id = r.id;
  r.state.config.maxRounds = 1;
  r.observations['player-1'] = ['x'.repeat(210000)];
  const controller = new AbortController();
  let persisted: GameRecord | undefined;
  const paused = await runGame(r, seats.slice(0, 2), [], {
    ...opts(),
    signal: controller.signal,
    call: async (seat, task, input, signal) => {
      if (task === 'decision') {
        const context = input as {
          visibleState: { self: { id: string }; marketGame: PublicMarketState };
        };
        if (context.visibleState.marketGame.resolving === 'rotten_choice') {
          assert.equal(seat.profile.id, 's1');
          assert.equal(context.visibleState.self.id, 'player-2');
          const json = JSON.stringify(context.visibleState);
          assert.ok(
            !json.includes('"character"') &&
              !json.includes('"mission"') &&
              !json.includes('rngState'),
          );
        }
      }
      return simulationCall(seat, task, input, signal);
    },
    save: async (current) => {
      const packed = packRecord(current);
      assert.equal(
        (packed as { recordEncoding: string }).recordEncoding,
        'gzip-base64-v1',
      );
      persisted = unpackRecord(
        JSON.parse(JSON.stringify(packed)),
      ) as GameRecord;
      if (current.pendingDecision?.action.type === 'rotten_discard')
        controller.abort();
    },
  });
  assert.equal(paused.status, 'paused');
  assert.equal(persisted!.pendingDecision!.action.type, 'rotten_discard');
  const resumed = await runGame(persisted!, seats.slice(0, 2), [], opts());
  const uninterrupted = await runGame(r, seats.slice(0, 2), [], opts());
  assert.equal(resumed.status, 'complete');
  assert.deepEqual(
    JSON.parse(JSON.stringify(resumed.state)),
    JSON.parse(JSON.stringify(uninterrupted.state)),
  );
  assert.equal(
    resumed.state.events.filter(
      (e) => e.payload?.v71 === 'purchase' && e.payload.cardId === 'super-1',
    ).length,
    1,
  );
  assert.equal(
    resumed.state.events.filter((e) => e.payload?.v71 === 'super').length,
    2,
  );
  assert.ok(!JSON.stringify(resumed).includes('DO_NOT_SAVE'));
  invariant(resumed.state);
});

void test('V7.1 batch executes requested game count with mock models, preserving separate memory/version records', async () => {
  const results: GameRecord[] = [];
  await runBatch({
    mode: 'simulation',
    seats: seats.slice(0, 2),
    rule: { ...BASE_RULE, config: { ...BASE_RULE.config, maxRounds: 2 } },
    experiment: { ...snapshot, missionMode: 'rotation', ordersToWin: 2 },
    count: 2,
    maxCalls: 1000,
    chat: false,
    memories: [],
    signal: new AbortController().signal,
    call: simulationCall,
    saveExperiment: async (batch) => {
      assert.equal(batch.plannedGames, 2);
    },
    persistGame: async () => {},
    persistMemory: async (entry) => {
      assert.equal(entry.ruleVersion, BASE_RULE.id);
    },
    onCurrent: () => {},
    onGame: (record) => {
      results.push(record);
    },
    onMessage: () => {},
    onTerminated: async () => {},
  });
  assert.equal(results.length, 2);
  for (const r of results) {
    assert.equal(r.status, 'complete');
    assert.equal(r.engineVersion, 'v7.1-engine-1');
    assert.equal(r.rule.config.ordersToWin, 2);
    invariant(r.state);
  }
});
