import type { Plugin } from 'vite';
import { POST as respond } from '../app/api/agents/respond/route.ts';
import { POST as models } from '../app/api/providers/models/route.ts';
import { POST as test } from '../app/api/providers/test/route.ts';
import { configureLocalModelFetch } from '../lib/agents/model.ts';
import { createModelTransport } from './model-transport.ts';
import { createSingleMoveHandler } from '../app/api/agents/single-move/handler.ts';

// Only used by the local development server. Credentials stay in request memory.
export function localApi(): Plugin {
  return {
    name: 'local-api-system-proxy',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      const transport = createModelTransport();
      configureLocalModelFetch(transport.fetch);
      server.httpServer?.once('close', () => {
        void transport.close();
      });
      const routes: Record<string, (request: Request) => Promise<Response>> = {
        '/api/providers/models': models,
        '/api/providers/test': test,
        '/api/agents/respond': respond,
        '/api/agents/single-move': createSingleMoveHandler(),
      };
      server.middlewares.use(async (req, res, next) => {
        const handler = routes[req.url?.split('?')[0] || ''];
        if (!handler || req.method !== 'POST') return next();
        const abort = new AbortController();
        res.on('close', () => {
          if (!res.writableEnded) abort.abort();
        });
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 5 * 1024 * 1024) {
              res.writeHead(413);
              res.end();
              return;
            }
            chunks.push(Buffer.from(chunk));
          }
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            if (value)
              headers.set(
                name,
                Array.isArray(value) ? value.join(', ') : value,
              );
          }
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: 'POST',
            headers,
            body: Buffer.concat(chunks),
            signal: abort.signal,
          });
          const response = await handler(request);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: '本地 API 连接失败，请检查系统代理是否运行。',
            }),
          );
        }
      });
    },
  };
}
