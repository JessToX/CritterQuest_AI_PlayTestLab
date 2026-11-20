import { validatePublicChatInput } from '../../lib/agents/public-output.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelFailure } from '../../lib/agents/diagnostics.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { runGame } from '../../lib/playtest/run-game.ts';
import { simulationCall } from '../../lib/playtest/simulation.ts';
import { opts, seats, shortRule } from '../fixtures/playtest.ts';
void test('chat timeouts retry once then continue without pretending AI chose silence', async () => {
  const result = await runGame(
    newRecord(seats.slice(0, 2), shortRule, 2, 'api'),
    seats.slice(0, 2),
    [],
    {
      ...opts(),
      chat: true,
      call: async (s, t, i, signal) => {
        if (t === 'chat') {
          validatePublicChatInput(i);
          assert.equal(s.profile.customInstructions, '');
          throw new ModelFailure({
            code: 'timeout',
            message: 'timeout',
            retryable: true,
          });
        }
        return simulationCall(s, t, i, signal);
      },
    },
  );
  assert.equal(result.status, 'complete');
  assert.ok(result.chatChoices?.some((c) => c.failed && !c.spoke));
  assert.ok(
    result.calls
      .filter((c) => c.task === 'chat')
      .every((c) => c.error?.includes('mock') && c.usageKnown === false),
  );
  assert.equal(
    result.calls.filter((c) => c.task === 'chat').length,
    result.chatChoices!.filter((c) => c.failed).length * 2,
  );
});
void test('mixed invalid output and timeout has two total attempts, then pauses without applying action', async () => {
  let calls = 0;
  const result = await runGame(
    newRecord(seats.slice(0, 2), shortRule, 2, 'api'),
    seats.slice(0, 2),
    [],
    {
      ...opts(),
      call: async () => {
        if (++calls === 1)
          return {
            data: { actionId: 'invalid' },
            latencyMs: 0,
            usage: { inputTokens: 2, outputTokens: 3 },
          };
        throw new ModelFailure({
          code: 'timeout',
          message: 'timeout',
          retryable: true,
        });
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.status, 'paused');
  assert.equal(result.decisions?.length, 0);
  assert.equal(result.calls[0].inputTokens, 2);
});

void test('API retries spend slots and a resumed record cannot raise its original limit', async () => {
  const pair = seats.slice(0, 2);
  const record = newRecord(pair, shortRule, 2, 'api');
  let sends = 0;
  const reservation = async (id: string, limit: number, used: number) => {
    assert.equal(id, record.id);
    assert.equal(limit, 2);
    assert.equal(used, sends);
    return used + 1;
  };
  const call = async () => {
    sends++;
    throw new ModelFailure({
      code: 'timeout',
      message: 'synthetic timeout',
      retryable: true,
    });
  };
  const paused = await runGame(record, pair, [], {
    ...opts(),
    maxCalls: 2,
    reserveCall: reservation,
    call,
  });
  assert.equal(paused.status, 'paused');
  assert.equal(paused.reservedCallCount, 2);
  assert.equal(paused.calls.length, 2);
  const reopened = await runGame(structuredClone(paused), pair, [], {
    ...opts(),
    maxCalls: 200,
    reserveCall: reservation,
    call,
  });
  assert.equal(reopened.status, 'paused');
  assert.match(reopened.error!, /固定调用上限/);
  assert.equal(sends, 2);
});

void test('a slot reserved before a pause is not dispatched or refunded', async () => {
  const pair = seats.slice(0, 2);
  const controller = new AbortController();
  let sends = 0;
  const paused = await runGame(newRecord(pair, shortRule, 2, 'api'), pair, [], {
    ...opts(),
    signal: controller.signal,
    maxCalls: 1,
    reserveCall: async () => {
      controller.abort('user-pause');
      return 1;
    },
    call: async () => {
      sends++;
      throw new Error('Unexpected dispatch');
    },
  });
  assert.equal(paused.status, 'paused');
  assert.equal(paused.reservedCallCount, 1);
  assert.equal(paused.calls.length, 0);
  assert.equal(sends, 0);
});
