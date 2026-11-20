import { ModelFailure } from './diagnostics.ts';

export interface PublicChatInput {
  channel: 'public-table-v1';
  speaker: string;
  rulebook: string;
  tableText: string;
  publicChat: Array<{ speaker: string; message: string; turn: number }>;
}
// Fail closed if a private decision context is accidentally sent as a chat task.
// Content provenance is established by the playtest builder, not by this schema.
export function validatePublicChatInput(input: unknown): PublicChatInput {
  const value = input as Partial<PublicChatInput> | null;
  const keys = ['channel', 'speaker', 'rulebook', 'tableText', 'publicChat'];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((k) => !keys.includes(k)) ||
    value.channel !== 'public-table-v1' ||
    typeof value.speaker !== 'string' ||
    value.speaker.length > 1000 ||
    typeof value.rulebook !== 'string' ||
    value.rulebook.length > 100000 ||
    typeof value.tableText !== 'string' ||
    value.tableText.length > 100000 ||
    !Array.isArray(value.publicChat) ||
    value.publicChat.length > 12 ||
    value.publicChat.some(
      (c) =>
        !c ||
        typeof c !== 'object' ||
        Object.keys(c).length !== 3 ||
        Object.keys(c).some(
          (k) => !['speaker', 'message', 'turn'].includes(k),
        ) ||
        typeof c.speaker !== 'string' ||
        c.speaker.length > 1000 ||
        typeof c.message !== 'string' ||
        c.message.length > 500 ||
        !Number.isSafeInteger(c.turn),
    )
  )
    throw new ModelFailure({
      code: 'invalid_json',
      message: '公开桌聊输入不符合独立通道契约',
      retryable: false,
    });
  return structuredClone(value as PublicChatInput);
}
// Private-context prose is never a public source, even when nonempty.
export function publicDecisionMessage(_value: unknown) {
  return '';
}
export function publicReplyMessage(reply: Record<string, unknown>) {
  if (
    Object.keys(reply).some((k) => !['speak', 'message'].includes(k)) ||
    reply.speak !== true ||
    typeof reply.message !== 'string'
  )
    return '';
  return reply.message.trim().slice(0, 500);
}
export function boundPublicOutput(
  data: Record<string, unknown>,
  task?: string,
) {
  if (task === 'chat') {
    const message = publicReplyMessage(data);
    return { speak: !!message, message };
  }
  if (task === 'decision')
    return { actionId: data.actionId, reason: data.reason, publicMessage: '' };
  return data;
}
