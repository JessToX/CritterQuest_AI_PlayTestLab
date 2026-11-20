import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelFailure } from '../../lib/agents/diagnostics.ts';
import type { MemoryEntry } from '../../lib/memory/types.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { runGame } from '../../lib/playtest/run-game.ts';
import { simulationCall } from '../../lib/playtest/simulation.ts';
import { type CallModel } from '../../lib/playtest/types.ts';
import {
  longGame,
  opts,
  passCall,
  seats,
  shortRule,
} from '../fixtures/playtest.ts';
void test('ten full rounds trigger independent summaries exactly once and memory modes control feedback', async () => {
  const players = structuredClone(seats.slice(0, 3));
  players[1].profile.memoryMode = 'frozen';
  players[2].profile.memoryMode = 'disabled';
  const seen: Array<{ seat: string; stage: unknown; round: number }> = [];
  const result = await runGame(longGame(), players, [], {
    ...opts(),
    call: async (s, t, i, signal) => {
      const v = i as { stageMemory?: unknown; visibleState: { round: number } };
      if (t === 'decision')
        seen.push({
          seat: s.profile.id,
          stage: v.stageMemory,
          round: v.visibleState.round,
        });
      return passCall(s, t, i, signal);
    },
  });
  assert.equal(result.status, 'complete');
  assert.deepEqual(
    result.summaryJobs
      ?.filter((j) => j.kind === 'checkpoint')
      .map((j) => j.round),
    [10, 10, 10, 20, 20, 20],
  );
  assert.equal(Object.keys(result.reflections).length, 3);
  assert.ok(seen.some((v) => v.seat === 's0' && v.round > 10 && v.stage));
  assert.ok(seen.filter((v) => v.seat !== 's0').every((v) => !v.stage));
  assert.ok(!JSON.stringify(result).includes('DO_NOT_SAVE'));
});
void test('summary failure preserves completion; retry only missing player and uses saved observations', async () => {
  let fails = true;
  const entries: MemoryEntry[] = [];
  const call: CallModel = async (s, t, i, signal) => {
    if (t === 'reflection' && s.profile.id === 's0' && fails)
      throw new ModelFailure({
        code: 'http',
        status: 401,
        message: 'bad key',
        retryable: false,
      });
    return simulationCall(s, t, i, signal);
  };
  const result = await runGame(
    newRecord(seats.slice(0, 2), shortRule, 2, 'api'),
    seats.slice(0, 2),
    entries,
    { ...opts(), call },
  );
  assert.equal(result.status, 'complete');
  assert.equal(Object.keys(result.reflections).length, 1);
  assert.equal(
    result.summaryJobs?.filter((j) => j.status === 'failed').length,
    1,
  );
  const previous = result.calls.length;
  fails = false;
  const fixed = await runGame(result, seats.slice(0, 2), entries, {
    ...opts(),
    call,
    summaryOnly: true,
  });
  assert.equal(Object.keys(fixed.reflections).length, 2);
  assert.equal(fixed.calls.length, previous + 1);
  assert.equal(entries.length, 2);
});
void test('terminated game can generate partial reflection without becoming complete or joining ten-game memory', async () => {
  const r = newRecord(seats.slice(0, 2), shortRule, 3, 'simulation');
  r.status = 'terminated';
  const entries: MemoryEntry[] = [];
  const result = await runGame(r, seats.slice(0, 2), entries, {
    ...opts(),
    summaryOnly: true,
  });
  assert.equal(result.status, 'terminated');
  assert.equal(Object.keys(result.reflections).length, 2);
  assert.ok(entries.every((e) => e.outcome === 'terminated'));
});
void test('checkpoint repair uses immutable round-ten input after later turns', async () => {
  let expected: unknown;
  const r = await runGame(longGame(2), seats.slice(0, 2), [], {
    ...opts(),
    call: async (s, t, input, signal) => {
      if (
        t === 'checkpoint' &&
        s.profile.id === 's0' &&
        (input as { completedRounds: number }).completedRounds === 10
      ) {
        expected = structuredClone(input);
        throw new ModelFailure({
          code: 'http',
          status: 401,
          message: 'bad key',
          retryable: false,
        });
      }
      return passCall(s, t, input, signal);
    },
  });
  const job = r.summaryJobs!.find(
    (j) =>
      j.playerId === r.state.players[0].id &&
      j.kind === 'checkpoint' &&
      j.round === 10,
  )!;
  assert.equal(job.status, 'failed');
  assert.deepEqual(job.input, expected);
  const before = r.calls.length;
  const repaired = await runGame(r, seats.slice(0, 2), [], {
    ...opts(),
    summaryOnly: true,
    summaryTarget: { kind: 'checkpoint', round: 10, playerId: job.playerId },
    call: async (s, t, input, signal) => {
      assert.equal(t, 'checkpoint');
      assert.deepEqual(input, expected);
      return simulationCall(s, t, input, signal);
    },
  });
  assert.equal(repaired.calls.length, before + 1);
  assert.equal(
    repaired.summaryJobs!.find((j) => j.id === job.id)!.status,
    'complete',
  );
  assert.equal(repaired.state.turn, r.state.turn);
});
void test('deleting a ten-game strategy does not summarize its episodes twice', async () => {
  const entries: MemoryEntry[] = [];
  let batchCalls = 0;
  for (let i = 0; i < 11; i++) {
    if (i === 10)
      for (let j = entries.length - 1; j >= 0; j--)
        if (entries[j].kind === 'strategy') entries.splice(j, 1);
    const r = newRecord(seats.slice(0, 2), shortRule, 100 + i, 'simulation');
    r.status = 'complete';
    r.state.players.forEach((p) => {
      r.reflections[p.id] = '测试反思';
    });
    await runGame(r, seats.slice(0, 2), entries, {
      ...opts(),
      summaryOnly: true,
      call: async (s, t, input, signal) => {
        if (t === 'batch') batchCalls++;
        return simulationCall(s, t, input, signal);
      },
    });
  }
  assert.equal(batchCalls, 2);
  assert.equal(entries.filter((e) => e.strategyBatchId).length, 20);
  assert.ok(
    entries.filter((e) => e.strategyBatchId).every((e) => e.batchOrdinal === 1),
  );
});
