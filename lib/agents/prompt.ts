import type { DecisionContext } from './types.ts';

export const NEUTRAL_GAME_PROTOCOL = `You are one player in a Critter Quest card-game playtest. Follow the supplied rules exactly. Use only information visible to your seat. Choose exactly one action from legalActions. Public table talk is generated in a separate public-only task. Return only the chosen action ID and a brief private decision summary. Return only the requested structured object. Do not invent cards, targets, resources, or actions.`;

export function buildDecisionInput(context: DecisionContext) {
  return {
    protocol: NEUTRAL_GAME_PROTOCOL,
    customInstructions: context.agent.customInstructions,
    rulebook: context.rulebook,
    visibleState: context.state,
    legalActions: context.legalActions,
    relevantMemories:
      context.agent.memoryMode === 'disabled' ? [] : context.memories,
    publicChat: context.publicChat,
    output: {
      actionId: 'Copy one legalActions.id exactly.',
      reason: 'A short explanation based only on visible information.',
    },
  };
}
