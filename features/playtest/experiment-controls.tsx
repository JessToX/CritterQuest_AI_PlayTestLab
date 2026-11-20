'use client';
import { useState } from 'react';
import type {
  ModelSettings,
  ProviderConnection,
} from '../../lib/agents/types.ts';
import {
  DEFAULT_EXPERIMENT,
  type ExperimentConfig,
  type ExperimentPreset,
} from '../../lib/playtest/experiment.ts';
const field = 'cq-field';
export function ExperimentControls({
  value,
  onChange,
  disabled,
  presets,
  onSave,
  onLoad,
  onDelete,
}: {
  value: ExperimentConfig;
  onChange: (v: ExperimentConfig) => void;
  disabled: boolean;
  presets: ExperimentPreset[];
  onSave: (name: string) => Promise<void>;
  onLoad: (p: ExperimentPreset) => void;
  onDelete: (p: ExperimentPreset) => Promise<void>;
}) {
  const [name, setName] = useState(''),
    [notice, setNotice] = useState('');
  const change = (patch: Partial<ExperimentConfig>) =>
    onChange({ ...value, ...patch });
  return (
    <fieldset
      disabled={disabled}
      className="cq-experiment-fields my-5 space-y-4"
    >
      <legend className="font-bold">公平性与实验设置</legend>
      <div className="grid gap-4 md:grid-cols-3">
        <label>
          随机方式
          <select
            className={field}
            value={value.randomMode}
            onChange={(e) =>
              change({
                randomMode: e.target.value as ExperimentConfig['randomMode'],
              })
            }
          >
            <option value="random">每次开始自动生成新种子</option>
            <option value="fixed">固定种子，复现分配</option>
          </select>
        </label>
      </div>
      {value.randomMode === 'fixed' && (
        <label className="block">
          种子（0–4294967295）
          <input
            className={field}
            type="number"
            min={0}
            max={4294967295}
            value={value.seed}
            onChange={(e) => change({ seed: Number(e.target.value) })}
          />
        </label>
      )}
      <label className="block">
        长期记忆输入预算（字符）
        <input
          className={field}
          type="number"
          min={1}
          max={64000}
          step={1}
          aria-describedby="memory-budget-help"
          value={value.memoryBudgetChars}
          onChange={(e) =>
            change({ memoryBudgetChars: Number(e.target.value) })
          }
        />
      </label>
      <p id="memory-budget-help" className="text-sm text-slate-400">
        可填 1–64000 的整数。只引入预算内放得下的完整记忆；例如填 200 时，超过
        200 字符的单条记忆不会引入，不会删除已保存记忆。
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="实验预设名称"
          className={field + ' max-w-64'}
          placeholder="实验预设名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="rounded border px-3 py-2"
          disabled={!name.trim()}
          onClick={async () => {
            try {
              await onSave(name.trim());
              setNotice('预设已保存（不含密钥）');
            } catch (e) {
              setNotice(String(e));
            }
          }}
        >
          保存当前预设
        </button>
        <button
          className="rounded border px-3 py-2"
          onClick={() => onChange({ ...DEFAULT_EXPERIMENT })}
        >
          恢复实验默认值
        </button>
      </div>
      {presets.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            {p.name} · {p.count} 局
          </span>
          <button className="underline" onClick={() => onLoad(p)}>
            应用
          </button>
          <button
            className="underline"
            onClick={async () => {
              try {
                await onDelete(p);
              } catch (e) {
                setNotice(String(e));
              }
            }}
          >
            删除预设
          </button>
        </div>
      ))}
      {notice && <output>{notice}</output>}
    </fieldset>
  );
}
export function ModelControls({
  value = {},
  onChange,
  connection,
}: {
  value?: ModelSettings;
  onChange: (v: ModelSettings) => void;
  connection: ProviderConnection;
}) {
  const number = (
    key: Exclude<keyof ModelSettings, 'stream'>,
    label: string,
    fallback: number | string,
    min = 1,
    max = 600,
  ) => (
    <label key={key}>
      {label}
      <input
        className={field}
        type="number"
        min={min}
        max={max}
        value={value[key] ?? ''}
        placeholder={`默认 ${fallback}`}
        onChange={(e) =>
          onChange({
            ...value,
            [key]: e.target.value === '' ? undefined : Number(e.target.value),
          })
        }
      />
    </label>
  );
  return (
    <details className="space-y-3">
      <summary className="cursor-pointer font-bold">
        等待时限与模型高级参数
      </summary>
      <div className="grid gap-3 sm:grid-cols-2">
        {number('decisionTimeoutSeconds', '决策等待上限（秒）', 180)}
        {number('chatTimeoutSeconds', '桌聊等待上限（秒）', 60)}
        {number('summaryTimeoutSeconds', '总结等待上限（秒）', 180)}
        {number(
          'maxOutputTokens',
          '输出 Token 预算',
          connection.kind === 'anthropic' ? 4096 : '供应商原设置',
          256,
          131072,
        )}
      </div>
      <p className="text-sm text-slate-400">
        留空保留供应商原设置。输出预算可能同时包含思考 Token；过低可能截断
        JSON。手动参数须由当前模型支持，接口拒绝时会显示具体错误，不会静默修改参数或更换模型。
      </p>
      {connection.kind === 'openai-compatible' &&
        /^https:\/\/api\.deepseek\.com(?:\/|$)/i.test(
          connection.baseUrl || '',
        ) && (
          <p className="text-sm text-slate-400">
            DeepSeek 决策时限留空且开启流式接收时：连续 180
            秒无生成进展才中断，总等待最多 600
            秒。手动填写时限后按填写的总上限执行。
          </p>
        )}
      {connection.kind === 'openai-compatible' && (
        <label className="block">
          <input
            type="checkbox"
            checked={value.stream ?? true}
            onChange={(e) => onChange({ ...value, stream: e.target.checked })}
          />{' '}
          流式接收（建议开启，降低等待完整响应造成的网关超时；接口不支持时可关闭）
        </label>
      )}
      {connection.kind !== 'anthropic' && (
        <label className="block">
          思考强度
          <select
            className={field}
            value={value.reasoningEffort || ''}
            onChange={(e) =>
              onChange({
                ...value,
                reasoningEffort: e.target.value || undefined,
              })
            }
          >
            <option value="">供应商默认</option>
            {['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </label>
      )}
      {/deepseek/i.test(connection.baseUrl || '') && (
        <label className="block">
          DeepSeek 思考模式
          <select
            className={field}
            value={value.thinking || ''}
            onChange={(e) =>
              onChange({
                ...value,
                thinking: (e.target.value ||
                  undefined) as ModelSettings['thinking'],
              })
            }
          >
            <option value="">供应商默认</option>
            <option value="enabled">开启</option>
            <option value="disabled">关闭</option>
          </select>
        </label>
      )}
    </details>
  );
}
