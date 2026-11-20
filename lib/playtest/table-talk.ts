import { publicChatInput } from './public-chat.ts';
import { publicReplyMessage } from '../agents/public-output.ts';
import type { ModelCaller, RuntimeContext } from './runtime.ts';
export const chatMessage = publicReplyMessage;
export function createReply(
  { r, seats, options, publish }: RuntimeContext,
  call: ModelCaller,
) {
  const reply = async (i: number, turn: number) => {
    if (r.replies.includes(seats[i].profile.id)) return;
    try {
      const value = await call(i, 'chat', publicChatInput(r, i));
      const message = chatMessage(value);
      r.chatChoices!.push({
        speaker: seats[i].profile.name,
        turn,
        spoke: !!message,
      });
      if (message)
        r.chat.push({
          speaker: seats[i].profile.name,
          message,
          turn,
          channel: 'public-table-v1',
        });
    } catch (error) {
      if (options.signal.aborted) throw error;
      r.chatChoices!.push({
        speaker: seats[i].profile.name,
        turn,
        spoke: false,
        failed: true,
        error: '未取得发言',
      });
    }
    r.replies.push(seats[i].profile.id);
    await publish();
  };
  return reply;
}
