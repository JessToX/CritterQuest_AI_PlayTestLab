'use client';
import { ScrollText } from 'lucide-react';
import type { ReactNode } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { adjudicationsFor } from '@/lib/rules/versions';
import {
  engineRegistration,
  UNSUPPORTED_RELEASE_VERSION,
} from '@/lib/game/registry';
import type { RuleVersion } from '@/lib/rules/types';

function RuleReading({
  text,
  versionControls,
}: {
  text: string;
  versionControls: ReactNode;
}) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (
      line.startsWith('|') &&
      /^\|[\s:|-]+\|$/.test(lines[i + 1]?.trim() || '')
    ) {
      const cells = (value: string) =>
        value
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((part) => part.trim());
      const head = cells(line),
        rows: string[][] = [];
      const key = i;
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|'))
        rows.push(cells(lines[i++]));
      i--;
      blocks.push(
        <div className="overflow-x-auto" key={key}>
          <table className="w-full text-left">
            <thead>
              <tr>
                {head.map((cell, n) => (
                  <th key={n}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, n) => (
                <tr key={n}>
                  {row.map((cell, c) => (
                    <td key={c}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (i === 0 || /^(?:#{1,6}\s|\d{2}\s)/.test(line)) {
      blocks.push(
        <h3 key={i} id={`rule-section-${i}`} tabIndex={-1}>
          {line.replace(/^#{1,6}\s/, '')}
        </h3>,
      );
    } else
      blocks.push(
        <p className="whitespace-pre-wrap" key={i}>
          {line}
        </p>,
      );
  }
  const chapters = lines.flatMap((raw, index) => {
    const text = raw.trim();
    return /^(?:#{1,6}\s|\d{2}\s)/.test(text)
      ? [{ id: `rule-section-${index}`, label: text.replace(/^#{1,6}\s/, '') }]
      : [];
  });
  const chapterLinks = chapters.map((chapter) => (
    <a key={chapter.id} href={`#${chapter.id}`}>
      {chapter.label}
    </a>
  ));
  return (
    <div className="cq-rule-document">
      <aside className="cq-rule-chapters">
        {versionControls}
        {chapters.length > 0 && (
          <>
            <nav className="cq-rule-desktop-index" aria-label="规则章节">
              {chapterLinks}
            </nav>
            <details className="cq-rule-mobile-index">
              <summary>按章节跳转</summary>
              <nav aria-label="规则章节">{chapterLinks}</nav>
            </details>
          </>
        )}
      </aside>
      <div className="cq-rule-reading cq-rule-paper">{blocks}</div>
    </div>
  );
}

export function RulesPanel({
  panel,
  rule,
}: {
  panel: string;
  rule: RuleVersion;
}) {
  const { ruleSummary } = engineRegistration(rule.config).capabilities;
  return (
    <TabsContent value="rules" className="space-y-4 mt-5">
      <div className="cq-rules-grid">
        <section>
          <RuleReading
            text={rule.text}
            versionControls={
              <div className="cq-rule-version-controls">
                <strong>{rule.label}</strong>
                <p
                  className="mt-3 text-xs text-muted-foreground"
                  title={rule.hash}
                >
                  来源 SHA-256
                  <br />
                  {rule.hash.slice(0, 12)}…{rule.hash.slice(-6)}
                </p>
              </div>
            }
          />
          <p className="text-xs text-muted-foreground mt-4">{ruleSummary}</p>
          <details className="mt-5">
            <summary>查看规则参数</summary>
            <pre className="whitespace-pre-wrap text-xs max-h-80 overflow-auto">
              {JSON.stringify(rule.config, null, 2)}
            </pre>
          </details>
          <details className="mt-3">
            <summary>查看实现与测试口径</summary>
            <pre className="whitespace-pre-wrap text-xs max-h-80 overflow-auto">
              {adjudicationsFor(rule.config)}
            </pre>
          </details>
        </section>
        <aside className={panel}>
          <h3 className="flex gap-2 items-center font-semibold mb-3">
            <ScrollText size={16} aria-hidden="true" />
            支持的规则
          </h3>
          <p className="text-xs text-muted-foreground leading-loose">
            {UNSUPPORTED_RELEASE_VERSION}
          </p>
        </aside>
      </div>
    </TabsContent>
  );
}
