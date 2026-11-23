'use client';
import {
  editProviderConnection,
  sameCredentialEndpoint,
} from '@/lib/agents/provider-endpoint';
import { apiCall } from '@/lib/client/model-call';
import { save } from '@/lib/client/records';
import { rememberKeys } from '@/lib/client/saved-keys';
import {
  DEFAULT_EXPERIMENT,
  type ExperimentConfig,
  type ExperimentPreset,
} from '@/lib/playtest/experiment';
import { type Seat } from '@/lib/playtest/types';
import type { Dispatch, SetStateAction } from 'react';
import { useRef, useState } from 'react';
import { initialSeats } from './configuration.ts';
import { useModelOptions } from './use-model-options.ts';
export function useConfiguration(setMessage: Dispatch<SetStateAction<string>>) {
  const [seats, setSeats] = useState(initialSeats);
  const [editing, setEditing] = useState<{ seat: number } | null>(null);
  const edit = editing?.seat ?? null;
  const setEdit = (seat: number | null) =>
    setEditing(seat === null ? null : { seat });
  const { modelOptions, modelsLoading, setModelsRefresh, modelsMessage } =
    useModelOptions(edit === null ? null : seats[edit].connection, edit);
  const [count, setCount] = useState(1),
    [maxCalls, setMaxCalls] = useState(1500),
    [chat, setChat] = useState(true),
    [experiment, setExperiment] = useState<ExperimentConfig>({
      ...DEFAULT_EXPERIMENT,
    });
  const [experimentPresets, setExperimentPresets] = useState<
    ExperimentPreset[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [savingProfiles, setSavingProfiles] = useState(false);
  const savingProfilesRef = useRef(false);
  const update = (index: number, patch: Partial<Seat>) =>
    setSeats((old) =>
      old.map((s, i) =>
        i === index
          ? {
              ...s,
              ...patch,
              connection: patch.connection
                ? editProviderConnection(s.connection, patch.connection)
                : s.connection,
            }
          : s,
      ),
    );
  async function saveProfiles() {
    if (savingProfilesRef.current) return;
    savingProfilesRef.current = true;
    setSavingProfiles(true);
    try {
      await save('profiles', 'profiles', { seats });
      try {
        rememberKeys(seats, window.localStorage);
      } catch {
        throw new Error(
          '模型配置已保存，但浏览器未能保存 API Key。请允许此网站使用本地存储后重试。',
        );
      }
      setEditing((current) => (current === editing ? null : current));
      setMessage(
        '配置和 API Key 已保存。下次用同一浏览器打开此地址会自动加载。',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '配置保存失败，请重试',
      );
    } finally {
      savingProfilesRef.current = false;
      setSavingProfiles(false);
    }
  }
  async function savePreset(name: string) {
    const preset: ExperimentPreset = {
      id: crypto.randomUUID(),
      name,
      config: experiment,
      count,
      chat,
      maxCalls,
      seats: seats.map((s) => ({
        enabled: s.enabled,
        profile: structuredClone(s.profile),
        connection: {
          id: s.connection.id,
          label: s.connection.label,
          kind: s.connection.kind,
          baseUrl: s.connection.baseUrl,
        },
      })),
    };
    await save(preset.id, 'preset', preset);
    setExperimentPresets((old) => [preset, ...old]);
  }
  function loadPreset(p: ExperimentPreset) {
    setExperiment(p.config);
    setCount(p.count);
    setChat(p.chat);
    setMaxCalls(p.maxCalls);
    setSeats(
      p.seats.map((s) => ({
        ...s,
        connection: {
          ...s.connection,
          apiKey:
            seats.find(
              (old) =>
                old.profile.id === s.profile.id &&
                sameCredentialEndpoint(old.connection, {
                  ...s.connection,
                  apiKey: '',
                }),
            )?.connection.apiKey || '',
        },
      })),
    );
    setMessage(`已应用预设：${p.name}；密钥仅在接口匹配时沿用`);
  }
  async function testConnection(index: number) {
    setBusy(true);
    try {
      const result = await apiCall(seats[index], 'test', {});
      if (result.data.ok !== true) throw new Error('模型未返回预期响应');
      setMessage(
        seats[index].profile.name +
          ' · ' +
          seats[index].profile.model +
          ' 连接成功，耗时 ' +
          result.latencyMs +
          ' ms',
      );
    } catch (e) {
      setMessage(
        seats[index].profile.name +
          ' · ' +
          seats[index].profile.model +
          '：' +
          (e instanceof Error ? e.message : '连接失败'),
      );
    } finally {
      setBusy(false);
    }
  }
  return {
    seats,
    setSeats,
    edit,
    setEdit,
    modelOptions,
    modelsLoading,
    setModelsRefresh,
    modelsMessage,
    count,
    setCount,
    maxCalls,
    setMaxCalls,
    chat,
    setChat,
    experiment,
    setExperiment,
    experimentPresets,
    setExperimentPresets,
    busy,
    setBusy,
    update,
    saveProfiles,
    savingProfiles,
    savePreset,
    loadPreset,
    testConnection,
  };
}
