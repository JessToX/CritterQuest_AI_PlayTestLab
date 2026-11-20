import { readdirSync, readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const roots = ['app', 'components', 'features', 'lib', 'db', 'dev', 'rules'];
const sourceExtension = /\.(?:[cm]?[jt]s|[jt]sx)$/;
type Dependency = { specifier: string; typeOnly: boolean; line: number };
type Edge = Dependency & { target: string };
export type ArchitectureIssue = { file: string; line: number; message: string };

export function readSources(root: string): Map<string, string> {
  const sources = new Map<string, string>();
  function visit(directory: string) {
    for (const entry of readdirSync(path.join(root, directory), {
      withFileTypes: true,
    })) {
      const file = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (sourceExtension.test(file) && !file.endsWith('.d.ts'))
        sources.set(file, readFileSync(path.join(root, file), 'utf8'));
    }
  }
  roots.forEach(visit);
  return sources;
}

function dependencies(file: string, source: string) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports: Dependency[] = [];
  const issues: ArchitectureIssue[] = [];
  function add(node: ts.Node, value: ts.Node | undefined, typeOnly = false) {
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    if (value && ts.isStringLiteralLike(value))
      imports.push({ specifier: value.text, typeOnly, line });
    else
      issues.push({
        file,
        line,
        message: 'Use a literal module path so dependencies can be checked.',
      });
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        !!clause &&
        (clause.phaseModifier === ts.SyntaxKind.TypeKeyword ||
          (!clause.name &&
            !!bindings &&
            ts.isNamedImports(bindings) &&
            bindings.elements.length > 0 &&
            bindings.elements.every((e) => e.isTypeOnly)));
      add(node, node.moduleSpecifier, typeOnly);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;
      const typeOnly =
        node.isTypeOnly ||
        (!!clause &&
          ts.isNamedExports(clause) &&
          clause.elements.length > 0 &&
          clause.elements.every((e) => e.isTypeOnly));
      add(node, node.moduleSpecifier, typeOnly);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node, node.moduleReference.expression, node.isTypeOnly);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      add(node, node.argument.literal, true);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    )
      add(node, node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const client = ast.statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === 'use client',
  );
  return { imports, issues, client };
}

function group(file: string) {
  const parts = file.split('/');
  if (parts[0] === 'lib' || parts[0] === 'features')
    return parts.slice(0, 2).join('/');
  return parts[0];
}

// These modules perform provider requests; shared types/diagnostics remain usable
// by both browser and server. Type-only edges never enter a browser bundle.
function serverOnly(file: string) {
  return /^(?:db\/|dev\/|app\/api\/|lib\/agents\/(?:model|providers)\.ts$)/.test(
    file,
  );
}
function serverPackage(specifier: string) {
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

function allowedDependency(file: string, edge: Edge) {
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

function resolveLocal(
  file: string,
  specifier: string,
  sources: Map<string, string>,
) {
  const base = specifier.startsWith('@/')
    ? specifier.slice(2)
    : specifier.startsWith('.')
      ? path.posix.normalize(
          path.posix.join(path.posix.dirname(file), specifier),
        )
      : undefined;
  if (base === undefined) return undefined;
  const extensions = [
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
  ];
  const candidates = [
    base,
    ...extensions.map((ext) => base + ext),
    ...extensions.map((ext) => base + '/index' + ext),
  ];
  if (/\.[cm]?js$/.test(base)) candidates.push(base.replace(/js$/, 'ts'));
  return candidates.find((candidate) => sources.has(candidate)) ?? base;
}

export function analyzeSources(
  sources: Map<string, string>,
): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];
  const graph = new Map<string, Edge[]>();
  const external = new Map<string, Dependency[]>();
  const browserRoots: string[] = [];
  for (const [file, source] of sources) {
    const parsed = dependencies(file, source);
    issues.push(...parsed.issues);
    if (parsed.client || /^(?:features|components|lib\/client)\//.test(file))
      browserRoots.push(file);
    const edges: Edge[] = [],
      packages: Dependency[] = [];
    for (const dependency of parsed.imports) {
      const target = resolveLocal(file, dependency.specifier, sources);
      if (target === undefined) {
        packages.push(dependency);
        if (
          file.startsWith('lib/') &&
          !file.startsWith('lib/client/') &&
          (serverPackage(dependency.specifier) ||
            /^(?:react(?:-dom)?|next|vinext)(?:\/|$)/.test(
              dependency.specifier,
            ))
        )
          issues.push({
            file,
            line: dependency.line,
            message: `Core modules cannot import runtime/framework package ${dependency.specifier}.`,
          });
        continue;
      }
      const edge = { ...dependency, target };
      // Assets obey ownership rules but do not form runtime code cycles.
      if (/\.(?:css|json)$/.test(target)) {
        if (!allowedDependency(file, edge))
          issues.push({
            file,
            line: edge.line,
            message: `Forbidden asset dependency ${file} -> ${target}.`,
          });
        continue;
      }
      if (!sources.has(target))
        issues.push({
          file,
          line: edge.line,
          message: `Unresolved local module ${dependency.specifier}.`,
        });
      else {
        edges.push(edge);
        if (!allowedDependency(file, edge))
          issues.push({
            file,
            line: edge.line,
            message: `Forbidden dependency ${file} -> ${target}. See docs/ARCHITECTURE.md.`,
          });
      }
    }
    graph.set(file, edges);
    external.set(file, packages);
  }

  // Check transitive browser reachability, including re-exports and dynamic imports.
  const seen = new Set<string>();
  function visitBrowser(file: string, route: string[]) {
    if (seen.has(file)) return;
    seen.add(file);
    const chain = [...route, file];
    if (serverOnly(file)) {
      issues.push({
        file,
        line: 1,
        message: `Server module is browser-reachable: ${chain.join(' -> ')}.`,
      });
      return;
    }
    for (const dependency of external.get(file) ?? [])
      if (!dependency.typeOnly && serverPackage(dependency.specifier))
        issues.push({
          file,
          line: dependency.line,
          message: `Server package is browser-reachable: ${chain.join(' -> ')} -> ${dependency.specifier}.`,
        });
    for (const edge of graph.get(file) ?? [])
      if (!edge.typeOnly) visitBrowser(edge.target, chain);
  }
  browserRoots.forEach((file) => visitBrowser(file, []));

  // Tarjan SCC: report each runtime cycle once; type-only contracts can refer back.
  let next = 0;
  const index = new Map<string, number>(),
    low = new Map<string, number>();
  const stack: string[] = [],
    active = new Set<string>();
  function visit(file: string) {
    index.set(file, next);
    low.set(file, next++);
    stack.push(file);
    active.add(file);
    const edges = (graph.get(file) ?? []).filter((edge) => !edge.typeOnly);
    for (const { target } of edges) {
      if (!index.has(target)) {
        visit(target);
        low.set(file, Math.min(low.get(file)!, low.get(target)!));
      } else if (active.has(target))
        low.set(file, Math.min(low.get(file)!, index.get(target)!));
    }
    if (low.get(file) !== index.get(file)) return;
    const members: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      active.delete(member);
      members.push(member);
    } while (member !== file);
    if (members.length > 1 || edges.some((edge) => edge.target === file))
      issues.push({
        file,
        line: 1,
        message: `Runtime import cycle: ${members.sort().join(', ')}.`,
      });
  }
  for (const file of sources.keys()) if (!index.has(file)) visit(file);
  return issues.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.message.localeCompare(b.message),
  );
}
