'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { ModelControls } from '@/features/playtest/experiment-controls';
import { type Seat } from '@/lib/playtest/types';
import {
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { presets } from './configuration.ts';
import { CritterPortrait } from '@/components/lab/critter-portrait';

interface Props {
  edit: number | null;
  setEdit: (index: number | null) => void;
  seats: Seat[];
  update: (index: number, patch: Partial<Seat>) => void;
  modelsLoading: boolean;
  setModelsRefresh: Dispatch<SetStateAction<number>>;
  modelOptions: string[];
  modelsMessage: string;
  message: string;
  running: boolean;
  busy: boolean;
  clearSavedKeys: () => void;
  testConnection: (index: number) => Promise<void>;
  saveProfiles: () => Promise<void>;
  savingProfiles: boolean;
  returnFocus: RefObject<HTMLButtonElement | null>;
}
export function SeatDialog({
  edit,
  setEdit,
  seats,
  update,
  modelsLoading,
  setModelsRefresh,
  modelOptions,
  modelsMessage,
  message,
  running,
  busy,
  clearSavedKeys,
  testConnection,
  saveProfiles,
  savingProfiles,
  returnFocus,
}: Props) {
  const title = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog
      open={edit !== null}
      onOpenChange={(open) => {
        if (!open) setEdit(null);
      }}
    >
      <DialogContent
        className="cq-dialog cq-seat-editor"
        initialFocus={title}
        finalFocus={returnFocus}
      >
        <DialogHeader>
          <DialogTitle ref={title} tabIndex={-1}>
            配置 {edit !== null ? seats[edit].profile.name : 'API Agent'}
          </DialogTitle>
        </DialogHeader>
        {edit !== null && (
          <div className="cq-seat-editor-body">
            <div className="cq-config-cut">
              <CritterPortrait index={edit} />
              <div>
                <span>座位特写</span>
                <p>
                  模型与记忆，
                  <br />
                  在这一格配好。
                </p>
              </div>
            </div>
            <div className="cq-seat-editor-fields">
              <DialogDescription>
                点击“保存配置”会将 API Key
                保存在本机此浏览器中，下次打开同一地址自动加载。清除网站数据或使用无痕模式可能丢失。连接测试会调用一次模型。
              </DialogDescription>
              {(() => {
                const s = seats[edit];
                return (
                  <div className="space-y-4">
                    <fieldset
                      disabled={savingProfiles}
                      className="min-w-0 space-y-4"
                    >
                      <div>
                        <Label htmlFor="name">名称</Label>
                        <Input
                          id="name"
                          value={s.profile.name}
                          onChange={(e) =>
                            update(edit, {
                              profile: { ...s.profile, name: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="provider">供应商</Label>
                        <NativeSelect
                          id="provider"
                          value={s.connection.id}
                          onChange={(e) => {
                            const p = presets.find(
                              (p) => p.id === e.target.value,
                            )!;
                            update(edit, {
                              connection: { ...p, apiKey: '' },
                              profile: {
                                ...s.profile,
                                providerId: p.id,
                                model: '',
                                modelSettings: undefined,
                              },
                            });
                          }}
                        >
                          {presets.map((p) => (
                            <NativeSelectOption key={p.id} value={p.id}>
                              {p.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </div>
                      <div>
                        <Label htmlFor="key">API Key</Label>
                        <Input
                          id="key"
                          type="password"
                          autoComplete="off"
                          value={s.connection.apiKey}
                          onChange={(e) =>
                            update(edit, {
                              connection: {
                                ...s.connection,
                                apiKey: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      {s.connection.id === 'custom' && (
                        <div>
                          <Label htmlFor="url">API 地址（HTTPS）</Label>
                          <Input
                            id="url"
                            placeholder="例如 https://zenmux.ai/api/v1"
                            value={s.connection.baseUrl}
                            onChange={(e) =>
                              update(edit, {
                                connection: {
                                  ...s.connection,
                                  baseUrl: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        {s.connection.id === 'custom' && (
                          <p className="text-sm text-cyan-200">
                            填写供应商的 Base URL；粘贴以 /models 或
                            /chat/completions
                            结尾的完整接口地址也可自动识别。不要填写文档网页。
                          </p>
                        )}
                        <Label htmlFor="model-list">选择模型</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            modelsLoading ||
                            !s.connection.apiKey.trim() ||
                            (s.connection.kind === 'openai-compatible' &&
                              !s.connection.baseUrl?.trim())
                          }
                          onClick={() => setModelsRefresh((value) => value + 1)}
                        >
                          {modelsLoading ? '正在获取…' : '重新获取'}
                        </Button>
                        <NativeSelect
                          id="model-list"
                          disabled={modelsLoading || !modelOptions.length}
                          value={
                            modelOptions.includes(s.profile.model)
                              ? s.profile.model
                              : ''
                          }
                          onChange={(e) =>
                            update(edit, {
                              profile: { ...s.profile, model: e.target.value },
                            })
                          }
                        >
                          <NativeSelectOption value="">
                            {modelsLoading ? '正在获取…' : '请选择模型'}
                          </NativeSelectOption>
                          {modelOptions.map((model) => (
                            <NativeSelectOption key={model} value={model}>
                              {model}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>

                        <Label htmlFor="model">模型 ID（可手动填写）</Label>
                        <Input
                          id="model"
                          value={s.profile.model}
                          placeholder="选择后自动填入；不要填写网址"
                          onChange={(e) =>
                            update(edit, {
                              profile: { ...s.profile, model: e.target.value },
                            })
                          }
                        />
                        {/^https?:/i.test(s.profile.model.trim()) && (
                          <p role="alert" className="text-sm text-amber-300">
                            这里需要模型 ID，不是 /models
                            网址。请从上方列表选择。
                          </p>
                        )}
                        {s.connection.id === 'doubao' && (
                          <p className="text-sm text-cyan-200">
                            如使用豆包推理接入点，请填写控制台中的 Endpoint ID。
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="memory">记忆模式</Label>
                        <NativeSelect
                          id="memory"
                          value={s.profile.memoryMode}
                          onChange={(e) =>
                            update(edit, {
                              profile: {
                                ...s.profile,
                                memoryMode: e.target
                                  .value as Seat['profile']['memoryMode'],
                              },
                            })
                          }
                        >
                          <NativeSelectOption value="active">
                            读取并学习（默认）
                          </NativeSelectOption>
                          <NativeSelectOption value="frozen">
                            冻结，只读取
                          </NativeSelectOption>
                          <NativeSelectOption value="disabled">
                            关闭
                          </NativeSelectOption>
                        </NativeSelect>
                      </div>
                      <div>
                        <Label htmlFor="prompt">
                          特殊测试提示词（默认空白）
                        </Label>
                        <Input
                          id="prompt"
                          value={s.profile.customInstructions}
                          onChange={(e) =>
                            update(edit, {
                              profile: {
                                ...s.profile,
                                customInstructions: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <ModelControls
                        value={s.profile.modelSettings}
                        connection={s.connection}
                        onChange={(modelSettings) =>
                          update(edit, {
                            profile: { ...s.profile, modelSettings },
                          })
                        }
                      />
                    </fieldset>
                    <output className="cq-notice cq-dialog-feedback">
                      {savingProfiles ? '正在保存配置…' : message}
                    </output>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        disabled={running || busy || savingProfiles}
                        onClick={clearSavedKeys}
                      >
                        清除所有已保存 Key
                      </Button>
                      <Button
                        disabled={
                          busy ||
                          savingProfiles ||
                          !s.profile.model.trim() ||
                          /^https?:/i.test(s.profile.model.trim())
                        }
                        variant="outline"
                        onClick={() => void testConnection(edit)}
                      >
                        测试真实连接
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {edit !== null && (
          <div className="cq-seat-editor-footer">
            <output className="block text-sm text-cyan-200">
              {modelsMessage}
            </output>
            <Button variant="outline" onClick={() => setEdit(null)}>
              取消
            </Button>
            <Button
              disabled={savingProfiles}
              focusableWhenDisabled
              onClick={() => void saveProfiles()}
            >
              {savingProfiles ? '正在保存配置…' : '保存配置'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
