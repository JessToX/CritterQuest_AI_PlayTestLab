import { execFileSync } from 'node:child_process';
import { Agent, EnvHttpProxyAgent, fetch as transportFetch } from 'undici';

function currentProxy(): string | undefined {
  const explicit = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (explicit) return explicit;
  if (process.platform !== 'darwin') return;
  try {
    const settings = execFileSync('/usr/sbin/scutil', ['--proxy'], {
      encoding: 'utf8',
      timeout: 2000,
    });
    const host = settings.match(/HTTPSProxy\s*:\s*(\S+)/)?.[1];
    const port = settings.match(/HTTPSPort\s*:\s*(\d+)/)?.[1];
    if (/HTTPSEnable\s*:\s*1/.test(settings) && host && port)
      return `http://${host}:${port}`;
  } catch {
    /* No readable system proxy: use a direct connection. */
  }
}

// Re-select transport before each request; never replay a potentially billable request.
// Keep old dispatchers alive until shutdown so a proxy change does not abort in-flight games.
export function createModelTransport(resolveProxy = currentProxy) {
  const dispatchers = new Map<string, Agent | EnvHttpProxyAgent>();
  const fetch: typeof globalThis.fetch = (input, init) => {
    const proxy = resolveProxy();
    const key = proxy || '';
    let dispatcher = dispatchers.get(key);
    if (!dispatcher) {
      dispatcher = proxy
        ? new EnvHttpProxyAgent({
            httpsProxy: proxy,
            httpProxy: proxy,
            noProxy:
              process.env.NO_PROXY ||
              process.env.no_proxy ||
              'localhost,127.0.0.1,::1,[::1]',
          })
        : new Agent();
      dispatchers.set(key, dispatcher);
    }
    return transportFetch(
      input as Parameters<typeof transportFetch>[0],
      { ...init, dispatcher } as Parameters<typeof transportFetch>[1],
    ) as unknown as Promise<Response>;
  };
  return {
    fetch,
    close: () => Promise.all([...dispatchers.values()].map((d) => d.close())),
  };
}
