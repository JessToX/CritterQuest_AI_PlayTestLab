// Stable engine entry point. Mechanics stay in focused, one-way modules.
export { V71_CONFIG, createMainCards, createOrders } from './v71/cards.ts';
export { createGame } from './v71/setup.ts';
export { startTurn } from './v71/flow.ts';
export { legalActions, applyAction } from './v71/actions.ts';
export { visibleStateFor } from './v71/view.ts';
// Preserve the previous module API for historical tests and external callers.
export {
  isFood,
  marketCardLabel,
  marketPrice,
  canSubmit,
  publicMarket,
  marketDecisionView,
} from '../market.ts';
