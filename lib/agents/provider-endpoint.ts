import type { ProviderConnection } from './types.ts';

export function providerBaseUrl(connection: ProviderConnection) {
  const fixed =
    connection.kind === 'openai'
      ? 'https://api.openai.com/v1'
      : connection.kind === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : connection.baseUrl;
  let url: URL;
  try {
    url = new URL(fixed?.trim() || '');
  } catch {
    throw new Error('请输入完整 HTTPS 接口地址，例如 https://zenmux.ai/api/v1');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i.test(
      url.hostname,
    ) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)
  )
    throw new Error('API 地址必须是公开 HTTPS 地址');
  url.pathname = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/(models|chat\/completions|responses|messages)$/, '');
  if (/\/docs(?:\/|$)/i.test(url.pathname))
    throw new Error('这里填写 API 接口地址，不能填写文档网页地址');
  return url.toString().replace(/\/$/, '');
}

export function credentialEndpoint(
  connection: ProviderConnection,
): string | null {
  if (
    typeof connection.id !== 'string' ||
    !connection.id.trim() ||
    !['openai', 'anthropic', 'openai-compatible'].includes(connection.kind)
  )
    return null;
  try {
    return JSON.stringify([
      connection.id,
      connection.kind,
      providerBaseUrl(connection),
    ]);
  } catch {
    return null;
  }
}

export function sameCredentialEndpoint(
  previous: ProviderConnection,
  next: ProviderConnection,
) {
  const endpoint = credentialEndpoint(previous);
  return endpoint !== null && endpoint === credentialEndpoint(next);
}

export function editProviderConnection(
  previous: ProviderConnection,
  next: ProviderConnection,
): ProviderConnection {
  return sameCredentialEndpoint(previous, next)
    ? next
    : { ...next, apiKey: '' };
}
