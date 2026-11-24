import { isBuiltin } from 'node:module';

function group(file: string) {
  const parts = file.split('/');
  if (parts[0] === 'lib' || parts[0] === 'features')
    return parts.slice(0, 2).join('/');
  return parts[0];
}

// Provider wire requests and transport belong on the server; shared types/diagnostics remain usable
// by both browser and server. Type-only edges never enter a browser bundle.
export function serverOnly(file: string) {
  return /^(?:db\/|dev\/|app\/api\/|lib\/agents\/(?:model|model-request|providers)\.ts$)/.test(
    file,
  );
}
export function serverPackage(specifier: string) {
  return (
    isBuiltin(specifier) ||
    /^(?:cloudflare:|undici(?:\/|$)|drizzle-orm(?:\/|$)|server-only$)/.test(
      specifier,
    )
  );
}

const domainDependencies: Record<string, string[]> = {
  'lib/game': ['lib/game'],
  'lib/agents': ['lib/agents', 'lib/game', 'lib/memory'],
  'lib/rules': ['lib/rules', 'lib/game', 'rules'],
  'lib/memory': ['lib/memory'],
  'lib/playtest': [
    'lib/playtest',
    'lib/game',
    'lib/agents',
    'lib/memory',
    'lib/rules',
  ],
  'lib/reports': ['lib/reports', 'lib/game', 'lib/agents', 'lib/memory'],
  'lib/records': ['lib/records'],
  'lib/client': [
    'lib/client',
    'lib/records',
    'lib/agents',
    'lib/memory',
    'lib/rules',
    'lib/game',
  ],
  'lib/utils.ts': [],
};
const typeDependencies: Record<string, string[]> = {
  'lib/memory': ['lib/playtest'],
  'lib/reports': ['lib/playtest'],
  'lib/records': ['lib/playtest', 'lib/memory', 'lib/rules'],
  'lib/client': ['lib/playtest'],
};

export function allowedDependency(
  file: string,
  edge: { target: string; typeOnly: boolean },
) {
  const from = group(file),
    to = group(edge.target);
  if (edge.target.startsWith('lib/game/engines/') && from !== 'lib/game')
    return false;
  if (from.startsWith('features/'))
    return (
      to === 'components' ||
      to.startsWith('lib/') ||
      (to.startsWith('features/') &&
        (from === 'features/workspace' || from === to))
    );
  if (from.startsWith('lib/')) {
    if (
      from !== 'lib/agents' &&
      from !== 'lib/client' &&
      serverOnly(edge.target)
    )
      return false;
    return (
      domainDependencies[from]?.includes(to) ||
      (edge.typeOnly && typeDependencies[from]?.includes(to)) ||
      false
    );
  }
  if (file.startsWith('components/ui/'))
    return (
      edge.target.startsWith('components/ui/') || edge.target === 'lib/utils.ts'
    );
  if (from === 'components')
    return to === 'components' || to.startsWith('lib/');
  if (from === 'db') return to === 'db' || to === 'lib/records';
  if (from === 'dev')
    return (
      to === 'dev' || to === 'lib/agents' || edge.target.startsWith('app/api/')
    );
  if (from === 'rules') return to === 'rules';
  if (from === 'app') return to !== 'dev';
  return false;
}
