import assert from 'node:assert/strict';
import test from 'node:test';
import { memoriesFor, memoryKey } from '../../lib/memory/selection.ts';
import type { MemoryEntry } from '../../lib/memory/types.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { runGame } from '../../lib/playtest/run-game.ts';
import { simulationCall } from '../../lib/playtest/simulation.ts';
import {
  type CallModel,
  type GameRecord,
  type Seat,
} from '../../lib/playtest/types.ts';
import { reportFor } from '../../lib/reports/report.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
const seats: Seat[] = [0, 1].map((i) => ({
  enabled: true,
  profile: {
    id: 's' + i,
    name: 'A' + i,
    providerId: 'mock',
    model: 'mock',
    customInstructions: '',
    memoryMode: 'active',
  },
  connection: {
    id: 'mock',
    kind: 'openai-compatible',
    label: 'mock',
    apiKey: 'never-save',
    baseUrl: 'https://example.com',
  },
}));
const rule = { ...BASE_RULE, config: { ...BASE_RULE.config, maxRounds: 2 } };
void test('ten games generate per-seat episodes and exactly one batch memory each', async () => {
  const entries: MemoryEntry[] = [];
  const saved: GameRecord[] = [];
  for (let i = 0; i < 10; i++) {
    const result = await runGame(
      newRecord(seats, rule, i, 'simulation'),
      seats,
      entries,
      {
        call: simulationCall,
        save: async (r) => {
          saved.push(structuredClone(r));
        },
        saveMemory: async () => {},
        onUpdate: () => {},
        signal: new AbortController().signal,
        maxCalls: 200,
        chat: true,
      },
    );
    assert.equal(result.status, 'complete');
    assert.equal(Object.keys(result.reflections).length, 2);
    for (let turn = 1; turn <= result.state.turn; turn++)
      assert.equal(
        result.calls.filter((c) => c.task === 'chat' && c.turn === turn).length,
        seats.length, // Active speech now also uses an independent public call.
      );
    assert.equal(JSON.stringify(result).includes('never-save'), false);
    assert.equal(reportFor(result).mode, 'simulation');
  }
  assert.equal(entries.filter((e) => e.kind === 'episode').length, 20);
  assert.equal(entries.filter((e) => e.kind === 'strategy').length, 2);
  assert.ok(saved.length);
});
void test('interrupted reply preserves the declared action and resumes without re-deciding', async () => {
  const entries: MemoryEntry[] = [];
  let failed = false;
  const pause = new AbortController();
  const faulty: CallModel = async (s, task, input) => {
    if (task === 'chat' && !failed) {
      failed = true;
      pause.abort();
      throw new DOMException('用户暂停', 'AbortError');
    }
    return simulationCall(s, task, input);
  };
  const opts = {
    save: async () => {},
    saveMemory: async () => {},
    onUpdate: () => {},
    signal: new AbortController().signal,
    maxCalls: 200,
    chat: true,
  };
  const paused = await runGame(
    newRecord(seats, rule, 33, 'simulation'),
    seats,
    entries,
    { ...opts, signal: pause.signal, call: faulty },
  );
  assert.equal(paused.status, 'paused');
  assert.ok(paused.pendingDecision);
  const pendingId = paused.pendingDecision.logId;
  assert.ok(pendingId);
  const resumed = await runGame(paused, seats, entries, {
    ...opts,
    call: simulationCall,
  });
  assert.equal(resumed.status, 'complete');
  assert.equal(resumed.decisions?.[0]?.id, pendingId);
  assert.equal(resumed.decisions?.[0]?.status, 'executed');
  const baseline = await runGame(
    newRecord(seats, rule, 33, 'simulation'),
    seats,
    [],
    {
      ...opts,
      call: simulationCall,
    },
  );
  assert.equal(
    resumed.calls.filter((c) => c.task === 'decision' && c.turn === 1).length,
    baseline.calls.filter((c) => c.task === 'decision' && c.turn === 1).length,
  );
});
void test('invalid model action retries once then pauses without moving cards', async () => {
  const record = newRecord(seats, rule, 4, 'api');
  const result = await runGame(record, seats, [], {
    call: async () => ({
      data: { actionId: 'invented' },
      latencyMs: 1,
      usage: { inputTokens: 1, outputTokens: 1 },
    }),
    save: async () => {},
    saveMemory: async () => {},
    onUpdate: () => {},
    signal: new AbortController().signal,
    maxCalls: 100,
    chat: false,
  });
  assert.equal(result.status, 'paused');
  assert.equal(result.calls.length, 2);
  assert.equal(result.state.turn, 1);
});
void test('memory isolates seats, model, rule version and simulation; disabled reads nothing', () => {
  const entry: MemoryEntry = {
    id: 'm',
    agentId: memoryKey(seats[0], rule.id, 'api'),
    ruleVersion: rule.id,
    kind: 'episode',
    content: 'test',
    sourceGameIds: [],
    createdAt: '',
    active: true,
  };
  assert.equal(memoriesFor([entry], seats[0], rule.id, 'api').length, 1);
  assert.equal(memoriesFor([entry], seats[1], rule.id, 'api').length, 0);
  assert.equal(memoriesFor([entry], seats[0], rule.id, 'simulation').length, 0);
  assert.equal(
    memoriesFor(
      [entry],
      { ...seats[0], profile: { ...seats[0].profile, model: 'different' } },
      rule.id,
      'api',
    ).length,
    0,
  );
});
void test('explicit memory grants preserve author, mode, model and rule isolation', () => {
  const entry: MemoryEntry = {
    id: 'shared',
    agentId: memoryKey(seats[0], rule.id, 'api'),
    ruleVersion: rule.id,
    kind: 'episode',
    content: 'edited',
    originalContent: 'original',
    editedAt: 'today',
    author: { seatId: 's0', name: 'A0', provider: 'mock', model: 'mock' },
    mode: 'api',
    allowedReaders: [memoryKey(seats[1], rule.id, 'api')],
    active: true,
    createdAt: '',
    sourceGameIds: [],
  };
  assert.equal(
    memoriesFor([entry], seats[1], rule.id, 'api')[0].author?.name,
    'A0',
  );
  assert.equal(
    memoriesFor([entry], seats[1], rule.id, 'api')[0].content,
    'edited',
  );
  assert.equal(
    memoriesFor([{ ...entry, allowedReaders: [] }], seats[1], rule.id, 'api')
      .length,
    0,
  );
  assert.equal(memoriesFor([entry], seats[1], rule.id, 'simulation').length, 0);
  assert.equal(memoriesFor([entry], seats[1], 'other', 'api').length, 0);
  assert.equal(
    memoriesFor(
      [entry],
      { ...seats[1], profile: { ...seats[1].profile, model: 'other' } },
      rule.id,
      'api',
    ).length,
    0,
  );
  assert.equal(
    memoriesFor([{ ...entry, active: false }], seats[0], rule.id, 'api').length,
    0,
  );
  assert.equal(
    memoriesFor(
      [entry],
      { ...seats[1], profile: { ...seats[1].profile, memoryMode: 'disabled' } },
      rule.id,
      'api',
    ).length,
    0,
  );
});
for (const stopTask of ['decision', 'chat', 'reflection'])
  void test(`termination during ${stopTask} ignores late result and cannot resume`, async () => {
    const abort = new AbortController();
    let reached = false;
    let beforeActions = 0;
    let last: GameRecord | undefined;
    const entries: MemoryEntry[] = [];
    const opts = {
      save: async () => {},
      saveMemory: async () => {},
      onUpdate: (r: GameRecord) => {
        last = r;
      },
      signal: abort.signal,
      maxCalls: 200,
      chat: true,
    };
    const result = await runGame(
      newRecord(seats, rule, 5, 'simulation'),
      seats,
      entries,
      {
        ...opts,
        call: async (s, t, input) => {
          assert.equal(reached, false, 'no further calls after stop');
          const value = await simulationCall(s, t, input);
          if (t === stopTask) {
            beforeActions =
              last?.state.events.filter((e) => e.type === 'action').length || 0;
            reached = true;
            abort.abort('terminate');
          }
          return value;
        },
      },
    );
    assert.ok(reached);
    assert.equal(
      result.status,
      stopTask === 'reflection' ? 'complete' : 'terminated',
    );
    if (stopTask !== 'reflection') assert.ok(result.terminatedAt);
    assert.equal(
      result.state.events.filter((e) => e.type === 'action').length,
      beforeActions,
    );
    assert.equal(entries.length, 0);
    assert.deepEqual(result.reflections, {});
    if (stopTask !== 'reflection')
      assert.equal(reportFor(result).winner, '未完成');
    await assert.rejects(
      () =>
        runGame(result, seats, entries, {
          ...opts,
          signal: new AbortController().signal,
          call: simulationCall,
        }),
      /不能继续/,
    );
  });
void test('termination keeps unsaved final state available if persistence fails', async () => {
  const abort = new AbortController();
  let latest: GameRecord | undefined;
  await assert.rejects(
    () =>
      runGame(newRecord(seats, rule, 4, 'api'), seats, [], {
        signal: abort.signal,
        maxCalls: 20,
        chat: false,
        onUpdate: (r) => {
          latest = r;
        },
        saveMemory: async () => {},
        save: async (r) => {
          if (r.status === 'terminated') throw new Error('disk failure');
        },
        call: async (s, t, i) => {
          abort.abort('terminate');
          return simulationCall(s, t, i);
        },
      }),
    /disk failure/,
  );
  assert.equal(latest?.status, 'terminated');
});
void test('AI can stay silent; action summaries are logged privately and survive resume', async () => {
  let interrupted = false;
  const entries: MemoryEntry[] = [];
  const pause = new AbortController();
  const opts = {
    save: async () => {},
    saveMemory: async () => {},
    onUpdate: () => {},
    signal: new AbortController().signal,
    maxCalls: 200,
    chat: true,
  };
  const call: CallModel = async (s, t, i) => {
    const input = i as Record<string, unknown>;
    assert.equal(input.decisions, undefined);
    assert.equal(input.chatChoices, undefined);
    assert.ok(
      !(JSON.stringify(input.publicChat) || '').includes('PRIVATE_SUMMARY'),
    );
    if (t === 'chat' && !interrupted) {
      interrupted = true;
      pause.abort();
      throw new DOMException('暂停', 'AbortError');
    }
    if (t === 'chat')
      return {
        data: { speak: false, message: 'ignore this message' },
        latencyMs: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    const r = await simulationCall(s, t, i);
    if (t === 'decision')
      r.data = { ...r.data, reason: 'PRIVATE_SUMMARY', publicMessage: '   ' };
    return r;
  };
  const paused = await runGame(
    newRecord(seats, rule, 41, 'api'),
    seats,
    entries,
    { ...opts, signal: pause.signal, call },
  );
  assert.equal(paused.status, 'paused');
  assert.equal(paused.decisions?.length, 1);
  assert.equal(paused.decisions?.[0].status, 'selected');
  const logId = paused.decisions![0].id;
  const resumed = await runGame(paused, seats, entries, { ...opts, call });
  assert.equal(resumed.status, 'complete');
  assert.equal(resumed.chat.length, 0);
  assert.ok(resumed.chatChoices?.length);
  assert.ok(resumed.chatChoices?.every((c) => !c.spoke));
  assert.equal(resumed.decisions?.filter((d) => d.id === logId).length, 1);
  assert.ok(
    resumed.decisions?.every(
      (d) => d.status === 'executed' && d.reason === 'PRIVATE_SUMMARY',
    ),
  );
  // Target/Curse/Cleanup choices are decisions, not additional Interactions.
  for (const event of resumed.state.events.filter((e) => e.type === 'action')) {
    assert.ok(
      resumed.decisions?.some(
        (d) =>
          d.turn === event.turn &&
          JSON.stringify(d.action) === JSON.stringify(event.payload?.action),
      ),
    );
  }
});
