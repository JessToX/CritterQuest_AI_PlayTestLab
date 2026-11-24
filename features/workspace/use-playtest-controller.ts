'use client';
import {
  engineRegistration,
  UNSUPPORTED_RELEASE_VERSION,
} from '@/lib/game/registry';
import { apiCall, reserveApiCall } from '@/lib/client/model-call';
import { removeRecord, save } from '@/lib/client/records';
import {
  forgetKeys,
  rememberKeys,
  restoreHistoricalKeys,
  restoreKeys,
} from '@/lib/client/saved-keys';
import { readPortrait } from '@/lib/client/seat-portraits';
import { loadWorkspace } from '@/lib/client/workspace';
import type { MemoryEntry } from '@/lib/memory/types';
import { runBatch } from '@/lib/playtest/batch';
import {
  needsResumeInput,
  resumeSeats,
  summarySeats,
} from '@/lib/playtest/resume';
import { runGame } from '@/lib/playtest/run-game';
import { simulationCall } from '@/lib/playtest/simulation';
import { type GameRecord, type Seat } from '@/lib/playtest/types';
import { isOfficialGame } from '@/lib/rules/scope';
import { BASE_RULE } from '@/lib/rules/versions';
import { useEffect, useRef, useState } from 'react';
import { initialSeats } from '../playtest/configuration.ts';
import { useConfiguration } from '../playtest/use-configuration.ts';
import type { ResumePrompt } from '../playtest/view-types.ts';
import { useModelContext } from '../playtest/use-model-context.ts';
export function usePlaytestController() {
  const [resumePrompt, setResumePrompt] = useState<ResumePrompt>(null);
  const [resumeError, setResumeError] = useState('');
  const [terminateConfirm, setTerminateConfirm] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [unsavedGame, setUnsavedGame] = useState<GameRecord | null>(null);
  const pendingSave = useRef<GameRecord | null>(null);
  const [retryingSave, setRetryingSave] = useState(false);
  const retryingSaveRef = useRef(false);
  const [games, setGames] = useState<GameRecord[]>([]),
    [current, setCurrent] = useState<GameRecord | null>(null),
    [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [message, setMessage] = useState('正在读取本地记录…'),
    [running, setRunning] = useState(false),
    [ready, setReady] = useState(false);
  const configuration = useConfiguration(setMessage);
  const {
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
    update,
    saveProfiles,
    savingProfiles,
    savePreset,
    loadPreset,
    testConnection,
  } = configuration;
  const [tab, setTab] = useState('table');
  const [summarizing, setSummarizing] = useState(false);
  const controller = useRef<AbortController | null>(null),
    memoryRef = useRef<MemoryEntry[]>([]);
  const [unsupportedRecords, setUnsupportedRecords] = useState(0);
  const rule = BASE_RULE;
  const ruleId = rule.id;
  useModelContext(ruleId, seats, running);
  useEffect(() => {
    void loadWorkspace(initialSeats)
      .then(({ games, memories, presets, seats: loadedSeats, unsupported }) => {
        setExperimentPresets(presets);
        setGames(games);
        setMemories(memories);
        memoryRef.current = memories;
        setUnsupportedRecords(unsupported);
        let keyNotice = '';
        try {
          setSeats(restoreKeys(loadedSeats, window.localStorage));
        } catch {
          setSeats(loadedSeats);
          keyNotice = '浏览器无法读取已保存的 Key，请重新填写。';
        }
        setReady(true);
        setMessage(keyNotice);
      })
      .catch((e) => setMessage(String(e.message)));
    return () => controller.current?.abort('page-unload');
  }, [setSeats, setExperimentPresets]);
  function requireSavedGame() {
    if (!pendingSave.current) return true;
    setMessage('请先在实时对局中重试保存，避免丢失当前记录');
    setTab('live');
    return false;
  }
  async function persistGame(g: GameRecord) {
    if (pendingSave.current && pendingSave.current.id !== g.id)
      throw new Error('请先重试保存待保存的对局');
    try {
      await save(g.id, 'game', g);
      if (pendingSave.current?.id === g.id) {
        pendingSave.current = null;
        setUnsavedGame(null);
      }
    } catch (e) {
      pendingSave.current = structuredClone(g);
      setUnsavedGame(pendingSave.current);
      setGames((old) => [
        structuredClone(g),
        ...old.filter((item) => item.id !== g.id),
      ]);
      throw e;
    }
  }
  async function persistMemory(entry: MemoryEntry) {
    await save(entry.id, 'memory', entry);
    memoryRef.current = memoryRef.current.some(
      (candidate) => candidate.id === entry.id,
    )
      ? memoryRef.current.map((candidate) =>
          candidate.id === entry.id ? entry : candidate,
        )
      : [...memoryRef.current, entry];
    setMemories(memoryRef.current);
  }
  async function deleteMemory(entry: MemoryEntry) {
    await removeRecord(entry.id, 'memory');
    memoryRef.current = memoryRef.current.filter(
      (candidate) => candidate.id !== entry.id,
    );
    setMemories(memoryRef.current);
  }
  function pauseRun() {
    controller.current?.abort('user-pause');
  }
  async function retryUnsavedGame() {
    const pending = pendingSave.current;
    if (!pending || controller.current || retryingSaveRef.current) return;
    retryingSaveRef.current = true;
    setRetryingSave(true);
    try {
      await persistGame(pending);
      setMessage('已重新保存对局');
    } catch {
      setMessage('保存仍失败，请重试');
    } finally {
      retryingSaveRef.current = false;
      setRetryingSave(false);
    }
  }
  function selectGame(game: GameRecord) {
    if (!isOfficialGame(game)) {
      setMessage(UNSUPPORTED_RELEASE_VERSION);
      return;
    }
    setCurrent(game);
    setTab('live');
  }
  function replaceGame(game: GameRecord) {
    setGames((old) =>
      old.map((candidate) => (candidate.id === game.id ? game : candidate)),
    );
    setCurrent((selected) => (selected?.id === game.id ? game : selected));
  }
  function upsertGame(game: GameRecord) {
    setGames((old) => [
      game,
      ...old.filter((candidate) => candidate.id !== game.id),
    ]);
  }
  function removeGameFromState(game: GameRecord) {
    setGames((old) => old.filter((candidate) => candidate.id !== game.id));
    setCurrent((selected) => (selected?.id === game.id ? null : selected));
  }
  async function deletePreset(id: string) {
    await removeRecord(id, 'preset');
    setExperimentPresets((old) => old.filter((preset) => preset.id !== id));
  }
  function clearSavedKeys() {
    try {
      forgetKeys(window.localStorage);
      setSeats((old) =>
        old.map((seat) => ({
          ...seat,
          connection: { ...seat.connection, apiKey: '' },
        })),
      );
      setMessage('所有已保存的 API Key 已从此浏览器清除，模型配置保留。');
    } catch {
      setMessage('清除失败，请检查浏览器的网站存储设置。');
    }
  }
  async function repairSummaries(
    g: GameRecord,
    target?: {
      kind: 'checkpoint' | 'reflection';
      round: number;
      playerId?: string;
    },
    owner: AbortController | null = null,
    confirmedSeats?: Seat[],
  ) {
    if (controller.current !== owner || !requireSavedGame()) return;
    if (
      confirmedSeats &&
      needsResumeInput(
        confirmedSeats.filter(
          (_, index) =>
            !target?.playerId || g.state.players[index]?.id === target.playerId,
        ),
        g.mode,
      )
    ) {
      setMessage('请确认 HTTPS 接口并填写对应的 API Key，再补生成总结。');
      return;
    }
    const restored = confirmedSeats || summarySeats(g, seats, target?.playerId);
    if (!restored) {
      if (g.mode === 'api' && !owner) {
        setResumePrompt({
          game: g,
          seats: resumeSeats(g, seats),
          summary: true,
          playerId: target?.playerId,
          confirm: (selected) =>
            void repairSummaries(g, target, null, selected),
        });
        setResumeError('');
      } else {
        setMessage(
          '对局记录已保留。可在报告页补生成总结；如缺少 API Key，按提示重新填写。',
        );
      }
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setStopping(false);
    setSummarizing(true);
    setTab('live');
    try {
      const result = await runGame(g, restored, memoryRef.current, {
        call: g.mode === 'simulation' ? simulationCall : apiCall,
        reserveCall: g.mode === 'api' ? reserveApiCall : undefined,
        signal: abort.signal,
        maxCalls,
        chat: false,
        summaryOnly: true,
        summaryTarget: target,
        save: persistGame,
        onUpdate: setCurrent,
        saveMemory: persistMemory,
      });
      setCurrent(result);
      setGames((old) => [result, ...old.filter((x) => x.id !== g.id)]);
      setMessage(result.error || '总结处理完成；失败条目可单独重试');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '总结保存失败');
    } finally {
      if (controller.current === abort) {
        controller.current = owner;
        if (!owner) setRunning(false);
        setSummarizing(false);
      }
    }
  }
  async function terminateGame() {
    setTerminateConfirm(false);
    if (controller.current) {
      setStopping(true);
      setMessage('正在终止并保存…');
      controller.current.abort('terminate');
      return;
    }
    if (!current || !requireSavedGame()) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setStopping(true);
    setMessage('正在终止并保存…');
    const stopped: GameRecord = {
      ...current,
      status: 'terminated',
      terminatedAt: new Date().toISOString(),
      terminationReason: '用户终止对局及批次',
      error: '对局已终止',
    };
    setCurrent(stopped);
    setGames((old) => [stopped, ...old.filter((g) => g.id !== stopped.id)]);
    try {
      await persistGame(stopped);
      setMessage('对局已终止并保存，开始收尾总结');
      await repairSummaries(stopped, undefined, abort);
    } catch {
      setMessage('对局已终止，但保存失败，请重试保存');
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setRunning(false);
        setStopping(false);
      }
    }
  }
  async function start(
    mode: GameRecord['mode'],
    resume?: GameRecord,
    suppliedSeats?: Seat[],
  ) {
    if (resume && !isOfficialGame(resume)) {
      setMessage(UNSUPPORTED_RELEASE_VERSION);
      return;
    }
    if (!resume && savingProfiles) {
      setMessage('正在保存配置，完成后即可开局。');
      return;
    }
    if (controller.current || running) {
      setMessage('请先暂停当前对局，再继续另一局');
      return;
    }
    if (!requireSavedGame()) return;
    if (
      !resume &&
      (!Number.isInteger(experiment.memoryBudgetChars) ||
        experiment.memoryBudgetChars < 1 ||
        experiment.memoryBudgetChars > 64000)
    ) {
      setMessage('记忆预算须为 1–64000 的整数');
      return;
    }
    if (resume?.status === 'terminated' || resume?.status === 'complete') {
      setMessage('已结束的对局不能继续');
      return;
    }
    let selected: Seat[];
    try {
      selected = resume
        ? suppliedSeats || resumeSeats(resume, seats)
        : seats.filter((s) => s.enabled);
      if (resume && mode === 'api' && !suppliedSeats) {
        try {
          selected = restoreHistoricalKeys(
            resume,
            selected,
            window.localStorage,
          );
        } catch {
          /* Prompt for missing keys below. */
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '无法恢复旧局配置');
      return;
    }
    if (resume && needsResumeInput(selected, mode)) {
      setResumePrompt({
        game: resume,
        seats: selected,
        confirm: (confirmed) => void start(mode, resume, confirmed),
      });
      setResumeError('');
      return;
    }
    const minimum = engineRegistration((resume?.rule ?? rule).config)
      .capabilities.minimumPlayers;
    if (
      selected.length < minimum ||
      selected.length > 4 ||
      selected.some((s) => !s)
    ) {
      setMessage(`当前规则请选择 ${minimum}–4 个有效座位`);
      return;
    }
    if (
      mode === 'api' &&
      selected.some(
        (s) => !s.profile.model.trim() || !s.connection.apiKey.trim(),
      )
    ) {
      setMessage('请为每个启用的座位填写模型名称和 API Key');
      return;
    }
    if (rule.unsupported.length && !resume) {
      setMessage('该规则版本含尚未支持的机制，不能开始自动对战');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setTab('live');
    setMessage('正在准备对局…');
    try {
      if (!resume) await save('profiles', 'profiles', { seats });
      if (mode === 'api') {
        try {
          rememberKeys(selected, window.localStorage);
        } catch {
          /* Gameplay can continue with an in-memory key. */
        }
      }
      await runBatch({
        mode,
        resume,
        seats: selected,
        portraitForSeat: readPortrait,
        rule,
        experiment,
        count,
        maxCalls,
        chat,
        memories: memoryRef.current,
        signal: abort.signal,
        call: mode === 'simulation' ? simulationCall : apiCall,
        reserveCall: mode === 'api' ? reserveApiCall : undefined,
        saveExperiment: (record) => save(record.id, 'experiment', record),
        persistGame,
        persistMemory,
        onCurrent: setCurrent,
        onGame: upsertGame,
        onMessage: setMessage,
        onTerminated: (game) => repairSummaries(game, undefined, abort),
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '运行失败');
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setRunning(false);
        setStopping(false);
      }
    }
  }
  const panel = 'cq-panel';
  const completed = games.filter(
    (g) => g.status === 'complete' && g.rule.id === ruleId,
  );

  return {
    rule,
    running,
    message,
    tab,
    setTab,
    seats,
    panel,
    update,
    setEdit,
    count,
    setCount,
    maxCalls,
    setMaxCalls,
    experiment,
    setExperiment,
    busy,
    experimentPresets,
    savePreset,
    loadPreset,
    chat,
    setChat,
    ready,
    start,
    stopping,
    pauseRun,
    current,
    summarizing,
    setTerminateConfirm,
    unsavedGame,
    retryUnsavedGame,
    retryingSave,
    setMessage,
    repairSummaries,
    ruleId,
    unsupportedRecords,
    memories,
    games,
    persistMemory,
    deleteMemory,
    completed,
    selectGame,
    replaceGame,
    removeGameFromState,
    resumePrompt,
    setResumePrompt,
    resumeError,
    setResumeError,
    terminateConfirm,
    terminateGame,
    edit,
    modelsLoading,
    setModelsRefresh,
    modelOptions,
    modelsMessage,
    testConnection,
    saveProfiles,
    savingProfiles,
    deletePreset,
    clearSavedKeys,
  };
}
