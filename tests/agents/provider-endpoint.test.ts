import assert from 'node:assert/strict';
import test from 'node:test';
import {
  credentialEndpoint,
  editProviderConnection,
} from '../../lib/agents/provider-endpoint.ts';
import type { ProviderConnection } from '../../lib/agents/types.ts';

const original: ProviderConnection = {
  id: 'custom',
  kind: 'openai-compatible',
  label: 'Synthetic provider',
  baseUrl: 'https://one.example/service/v1',
  apiKey: 'synthetic-fixture',
};

void test('credentials are retained only for the same valid provider endpoint', () => {
  const equivalent = { ...original, baseUrl: original.baseUrl + '/' };
  assert.equal(
    editProviderConnection(original, equivalent).apiKey,
    original.apiKey,
  );
  for (const update of [
    { baseUrl: 'https://two.example/service/v1' },
    { baseUrl: 'https://one.example/other/v1' },
    { baseUrl: 'https://one.example:8443/service/v1' },
    { baseUrl: 'invalid' },
    { id: 'another-provider' },
    { kind: 'openai' as const },
  ]) {
    assert.equal(
      editProviderConnection(original, { ...original, ...update }).apiKey,
      '',
    );
  }
});

void test('an incomplete endpoint cannot hold a credential or restore one on return', () => {
  const invalid = editProviderConnection(original, {
    ...original,
    baseUrl: '',
  });
  assert.equal(credentialEndpoint(invalid), null);
  assert.equal(
    editProviderConnection(invalid, { ...invalid, apiKey: 'new-fixture' })
      .apiKey,
    '',
  );
  const returned = editProviderConnection(invalid, {
    ...invalid,
    baseUrl: original.baseUrl,
  });
  assert.equal(returned.apiKey, '');
  assert.equal(
    editProviderConnection(returned, { ...returned, apiKey: 'new-fixture' })
      .apiKey,
    'new-fixture',
  );
});
