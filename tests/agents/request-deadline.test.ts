import assert from 'node:assert/strict';
import test from 'node:test';
import {
  requestDeadline,
  requestLimits,
} from '../../lib/agents/request-deadline.ts';
import { readChatStream } from '../../lib/agents/response.ts';
const connection = {
  id: 'd',
  label: 'DeepSeek',
  kind: 'openai-compatible' as const,
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
};
void test('adaptive waiting only applies to default official DeepSeek streaming decisions', () => {
  assert.equal(requestLimits(connection, 'decision').totalMs, 600000);
  assert.equal(
    requestLimits(connection, 'decision', { decisionTimeoutSeconds: 180 })
      .totalMs,
    180000,
  );
  assert.equal(
    requestLimits(connection, 'decision', { stream: false }).adaptive,
    false,
  );
  assert.equal(requestLimits(connection, 'chat').totalMs, 60000);
  assert.equal(
    requestLimits(
      { ...connection, baseUrl: 'https://api.deepseek.com.example.org' },
      'decision',
    ).adaptive,
    false,
  );
});
void test('progress extends idle deadline but cannot extend total deadline', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const deadline = requestDeadline({
    idleMs: 180,
    totalMs: 600,
    adaptive: true,
  });
  for (let i = 0; i < 3; i++) {
    t.mock.timers.tick(150);
    deadline.progress();
    assert.equal(deadline.signal.aborted, false);
  }
  t.mock.timers.tick(150);
  assert.equal(deadline.signal.aborted, true);
  assert.match(deadline.reason(), /总上限/);
  deadline.close();
});
void test('no progress stops waiting and closing cleans up timers', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const deadline = requestDeadline({
    idleMs: 180,
    totalMs: 600,
    adaptive: true,
  });
  t.mock.timers.tick(180);
  assert.equal(deadline.signal.aborted, true);
  assert.match(deadline.reason(), /没有新的生成内容/);
  deadline.close();
  const closed = requestDeadline({ idleMs: 180, totalMs: 600, adaptive: true });
  closed.close();
  t.mock.timers.tick(1000);
  assert.equal(closed.signal.aborted, false);
});
void test('SSE heartbeats do not extend waiting, actual reasoning and answer deltas do', async () => {
  let progress = 0;
  const text =
    ': heartbeat\n\ndata: {"choices":[{"delta":{"content":"   "}}]}\n\ndata: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\ndata: {"choices":[{"delta":{"content":"{}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
  const result = await readChatStream(new Response(text), () => progress++);
  assert.equal(progress, 2);
  assert.equal(result.choices?.[0].message?.content?.trim(), '{}');
});
