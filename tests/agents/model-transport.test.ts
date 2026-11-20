import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { createModelTransport } from '../../dev/model-transport.ts';
import { failureDetails } from '../../lib/agents/diagnostics.ts';

void test('network diagnostics classify nested causes without exposing credentials', () => {
  for (const [code, expected] of [
    ['ECONNREFUSED', 'network'],
    ['UND_ERR_BODY_TIMEOUT', 'timeout'],
    ['CERT_HAS_EXPIRED', 'network'],
  ]) {
    const failure = failureDetails(
      new TypeError('fetch failed secret-key', {
        cause: Object.assign(new Error('secret-key'), { code }),
      }),
    );
    assert.equal(failure.code, expected);
    assert.ok(failure.message.includes(code));
    assert.ok(!failure.message.includes('secret-key'));
    assert.equal(failure.retryable, code !== 'CERT_HAS_EXPIRED');
  }
});

void test('local transport observes proxy changes on successive requests without restarting', async () => {
  const server = createServer((_req, res) => res.end('ok'));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  let checks = 0;
  const transport = createModelTransport(() => {
    checks++;
    return checks === 2 ? 'http://127.0.0.1:1' : undefined;
  });
  try {
    // Loopback stays direct even when a system proxy is selected.
    for (let i = 0; i < 3; i++) {
      const response = await transport.fetch(
        `http://127.0.0.1:${address.port}`,
      );
      assert.equal(await response.text(), 'ok');
    }
    assert.equal(checks, 3);
  } finally {
    await transport.close();
    server.close();
  }
});
