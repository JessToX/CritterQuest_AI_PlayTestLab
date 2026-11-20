import assert from 'node:assert/strict';
import test from 'node:test';
import { startTurn, legalActions } from '../../lib/game/engine.ts';
import { memoryKey } from '../../lib/memory/selection.ts';
import type { MemoryEntry } from '../../lib/memory/types.ts';
import { runGame } from '../../lib/playtest/run-game.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { seats, shortRule, opts, passCall } from '../fixtures/playtest.ts';
import { publicChatInput } from '../../lib/playtest/public-chat.ts';
import {
  publicReplyMessage,
  validatePublicChatInput,
} from '../../lib/agents/public-output.ts';
import { BASE_RULE as V71_RULE } from '../../lib/rules/versions.ts';
const secret = 'SYNTHETIC_PRIVATE_SECRET_123';
const chatReply = {
  speak: true,
  message: '公开市场的鱼很有吸引力，要不要先抢订单？',
};

void test('public builder excludes every private source with V7.1 rule parameters', () => {
  for (const rule of [shortRule, V71_RULE]) {
    const r = newRecord(seats.slice(0, 2), rule, 41, 'api');
    r.chat.push({
      speaker: 'public player',
      message: '公开对话',
      turn: 1,
      channel: 'public-table-v1',
    });
    const before = publicChatInput(r, 0);
    r.chat.push({ speaker: secret, message: secret, turn: 1 }); // Unknown legacy provenance.
    r.pendingDecision = {
      index: 0,
      action: { type: 'end_buy' },
      reason: secret,
      publicMessage: secret,
    };
    r.seats[0].customInstructions = secret;
    r.observations[r.state.players[0].id] = [secret];
    r.reflections[r.state.players[0].id] = secret;
    r.summaryJobs = [
      {
        id: 'stage',
        playerId: r.state.players[0].id,
        kind: 'checkpoint',
        round: 1,
        status: 'complete',
        content: secret,
        input: { secret },
      },
    ];
    r.frozenMemories = {
      [seats[0].profile.id]: [
        {
          id: 'f',
          agentId: 'f',
          ruleVersion: rule.id,
          kind: 'strategy',
          content: secret,
          sourceGameIds: [],
          createdAt: '',
          active: true,
        },
      ],
    };
    r.decisions = [
      {
        id: 'd',
        seatId: 's0',
        name: 'A',
        model: 'm',
        turn: 1,
        action: { type: 'end_buy' },
        label: secret,
        reason: secret,
        status: 'selected',
      },
    ];
    const p = r.state.players[0];
    p.knownMissions = {
      secret: {
        id: secret,
        pattern: '4',
        requirements: { fish: 4, bone: 0, seed: 0, cheese: 0 },
      },
    };
    if (p.mission) p.mission.id = secret;
    if (p.hand[0]) p.hand[0].id = secret;
    r.state.rngState = 987654;
    r.state.initialDeckOrder = [secret];
    r.state.events.push({
      id: secret,
      turn: 1,
      round: 1,
      type: 'chat',
      publicText: secret,
    });
    if (r.state.events[0]) {
      r.state.events[0].privateTextByPlayer = { [p.id]: secret };
      r.state.events[0].payload = { secret };
    }
    const after = publicChatInput(r, 0);
    assert.deepEqual(after, before);
    assert.ok(!JSON.stringify(after).includes(secret));
    assert.ok(after.publicChat.some((c) => c.message === '公开对话'));
  }
});

void test('public and private calls stay separate; free table talk does not alter engine timing', async () => {
  const selected = structuredClone(seats.slice(0, 2));
  selected[0].profile.customInstructions = secret;
  const original = newRecord(selected, shortRule, 41, 'api');
  original.observations[original.state.players[0].id] = [secret + 'history'];
  original.summaryJobs = [
    {
      id: 'checkpoint',
      playerId: original.state.players[0].id,
      round: 0,
      kind: 'checkpoint',
      status: 'complete',
      content: secret + 'stage',
    },
  ];
  const entries: MemoryEntry[] = ['strategy', 'episode'].map((kind, n) => ({
    id: String(n),
    agentId: memoryKey(selected[0], shortRule.id, 'api'),
    ruleVersion: shortRule.id,
    kind: kind as MemoryEntry['kind'],
    content: secret + kind,
    sourceGameIds: [],
    createdAt: '2026-11-12',
    active: true,
  }));
  const privateInputs: string[] = [];
  const result = await runGame(original, selected, entries, {
    ...opts(),
    chat: true,
    call: async (seat, task, input, signal) => {
      if (task === 'chat') {
        assert.equal(seat.profile.customInstructions, '');
        assert.equal(seat.profile.memoryMode, 'disabled');
        validatePublicChatInput(input);
        assert.ok(!JSON.stringify(input).includes(secret));
        assert.equal(
          (input as { rulebook: string }).rulebook,
          original.rule.text,
        );
        return {
          data: chatReply,
          latencyMs: 0,
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      }
      if (task === 'decision') privateInputs.push(JSON.stringify(input));
      const value = await passCall(seat, task, input, signal);
      if (task === 'decision')
        value.data = { ...value.data, reason: secret, publicMessage: secret };
      return value;
    },
  });
  assert.equal(result.status, 'complete');
  for (const source of ['strategy', 'episode', 'history', 'stage'])
    assert.ok(privateInputs.some((x) => x.includes(secret + source)));
  assert.ok(result.decisions!.some((d) => d.reason === secret));
  assert.ok(result.chat.length > 0);
  assert.ok(
    result.chat.every(
      (c) => c.message === chatReply.message && c.channel === 'public-table-v1',
    ),
  );
  assert.ok(!JSON.stringify(result.chat).includes(secret));
  assert.equal(
    new Set(result.chatChoices!.map((c) => c.speaker + '|' + c.turn)).size,
    result.chatChoices!.length,
  );
  assert.equal(
    result.calls.filter((c) => c.task === 'chat').length,
    result.chatChoices!.length,
  );
  const baseline = await runGame(original, selected, entries, {
    ...opts(),
    call: passCall,
  });
  assert.deepEqual(result.state, baseline.state);
});

void test('resume retries only unfinished public speakers and never publishes old private pending prose', async () => {
  const selected = structuredClone(seats.slice(0, 2));
  const original = newRecord(selected, shortRule, 42, 'api');
  original.state = startTurn(original.state);
  original.pendingDecision = {
    index: original.state.players.findIndex(
      (p) => p.id === original.state.decisionPlayerId,
    ),
    action: legalActions(original.state)[0].action,
    reason: secret,
    publicMessage: secret,
  };
  const abort = new AbortController();
  let count = 0;
  const activeSpeaker =
    original.state.players[original.state.activePlayerIndex].name;
  const call: ReturnType<typeof opts>['call'] = async (
    seat,
    task,
    input,
    signal,
  ) => {
    if (task === 'chat') {
      assert.ok(!JSON.stringify(input).includes(secret));
      if (++count === 2) {
        abort.abort();
        throw new DOMException('暂停', 'AbortError');
      }
      return {
        data: chatReply,
        latencyMs: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }
    return passCall(seat, task, input, signal);
  };
  const paused = await runGame(original, selected, [], {
    ...opts(),
    chat: true,
    signal: abort.signal,
    call,
    onUpdate: (r) => assert.equal(r.pendingDecision?.publicMessage || '', ''),
  });
  assert.equal(paused.status, 'paused');
  assert.equal(paused.chat.length, 1);
  const resumed = await runGame(paused, selected, [], {
    ...opts(),
    chat: true,
    call,
  });
  assert.equal(resumed.status, 'complete');
  assert.equal(
    resumed.chat.filter(
      (c) => c.turn === original.state.turn && c.speaker === activeSpeaker,
    ).length,
    1,
  );
  assert.ok(!JSON.stringify(resumed.chat).includes(secret));
  const legacy = structuredClone(paused);
  delete legacy.publicTalkVersion;
  legacy.chat[0] = {
    speaker: activeSpeaker,
    message: secret,
    turn: original.state.turn,
  };
  legacy.pendingDecision!.publicMessage = secret;
  const oldResumed = await runGame(legacy, selected, [], {
    ...opts(),
    chat: true,
    call,
  });
  assert.equal(oldResumed.status, 'complete');
  assert.equal(
    oldResumed.chat.filter(
      (c) => c.turn === original.state.turn && c.speaker === activeSpeaker,
    ).length,
    1,
  );
});

void test('private response shapes and malformed chat input fail closed without secret matching', () => {
  assert.equal(
    publicReplyMessage({
      actionId: 'x',
      reason: secret,
      publicMessage: secret,
    }),
    '',
  );
  assert.equal(
    publicReplyMessage({ speak: true, message: secret, reason: secret }),
    '',
  );
  assert.equal(publicReplyMessage({ speak: false, message: secret }), '');
  assert.equal(publicReplyMessage(chatReply), chatReply.message);
  assert.throws(() => validatePublicChatInput({ memories: [secret] }));
});
