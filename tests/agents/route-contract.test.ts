import assert from 'node:assert/strict';
import test from 'node:test';
import { POST as respond } from '../../app/api/agents/respond/route.ts';

void test('the model route checks origin before validating the task', async () => {
  const url = 'https://workbench.example/api/agents/respond';
  for (const origin of [
    undefined,
    'https://workbench.example',
    'https://other.example',
  ]) {
    const request = new Request(url, {
      method: 'POST',
      headers: origin ? { origin } : {},
      body: JSON.stringify({ task: 'unknown' }),
    });
    const response = await respond(request);
    const crossOrigin = origin === 'https://other.example';
    assert.equal(response.status, crossOrigin ? 403 : 400);
    assert.deepEqual(await response.json(), {
      error: crossOrigin ? '跨站请求被拒绝' : '任务类型无效',
    });
  }
});
