import assert from 'node:assert/strict';
import test from 'node:test';
import { newRecord } from '../../lib/playtest/record.ts';
import { analytics } from '../../lib/reports/analytics.ts';
import { seats, shortRule } from '../fixtures/playtest.ts';
void test('analytics excludes aborted games from wins and distinguishes cancellations and unknown usage', () => {
  const g = newRecord(seats.slice(0, 2), shortRule, 3, 'api');
  g.calls = [
    {
      seatId: 's0',
      task: 'chat',
      turn: 1,
      latencyMs: 90000,
      inputTokens: 0,
      outputTokens: 0,
      error: 'The operation was aborted due to timeout',
    },
    {
      seatId: 's0',
      task: 'decision',
      turn: 1,
      latencyMs: 1,
      inputTokens: 0,
      outputTokens: 0,
      error: 'cancel',
      details: { code: 'cancelled', message: 'cancelled', retryable: false },
      usageKnown: false,
    },
  ];
  g.status = 'terminated';
  const a = analytics([g]);
  assert.equal(a.groups[0].winRate, null);
  assert.equal(
    a.models.reduce((n, m) => n + m.timeouts, 0),
    1,
  );
  assert.equal(
    a.models.reduce((n, m) => n + m.cancelled, 0),
    1,
  );
  assert.equal(
    a.models.reduce((n, m) => n + m.unknown, 0),
    2,
  );
});
