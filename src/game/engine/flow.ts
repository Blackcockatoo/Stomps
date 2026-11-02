/** Pure deterministic street skill; separate from beat streak and Quake Drive. */
export type FlowState = { chain: number; longest: number; level: number; peak: number; recoveryReadyAt: number; recoveryUntil: number; recoverTo: number };
export const RECOVERY_DELAY = 0.2;
export const RECOVERY_WINDOW = 1.8;
export function flowLevel(chain: number): number {
  if (chain <= 0) return 0;
  if (chain >= 14) return 5;
  if (chain >= 9) return 4;
  if (chain >= 5) return 3;
  if (chain >= 2) return 2;
  return 1;
}
export function flowName(level: number): string {
  return ["FIND YOUR FEET", "THE STRUT", "LOCKED IN", "ELECTRIC", "UNTOUCHABLE", "PAVEMENT ROYALTY"][Math.max(0, Math.min(5, level))]!;
}
export function newFlow(): FlowState { return { chain: 0, longest: 0, level: 0, peak: 0, recoveryReadyAt: 0, recoveryUntil: 0, recoverTo: 0 }; }
export function flowHit(state: FlowState): FlowState {
  const chain = state.chain + 1, level = flowLevel(chain);
  return { chain, level, longest: Math.max(state.longest, chain), peak: Math.max(state.peak, level),
    recoveryReadyAt: 0, recoveryUntil: 0, recoverTo: 0 };
}
export function flowMiss(state: FlowState, now: number): FlowState {
  const chain = Math.floor(state.chain / 2);
  return { ...state, chain, level: flowLevel(chain),
    recoverTo: Math.max(0, state.chain - 2), recoveryReadyAt: now + RECOVERY_DELAY,
    recoveryUntil: now + RECOVERY_WINDOW };
}
export function canRecover(state: FlowState, now: number, judgement: string): boolean {
  return state.recoverTo > state.chain && state.recoveryUntil > now && now >= state.recoveryReadyAt &&
    (judgement === "PERFECT" || judgement === "FRESH");
}
export function flowRecover(state: FlowState, now: number, judgement: string): FlowState {
  if (!canRecover(state, now, judgement)) return state;
  const chain = Math.max(state.chain, state.recoverTo), level = flowLevel(chain);
  return { chain, level, longest: Math.max(state.longest, chain), peak: Math.max(state.peak, level),
    recoveryReadyAt: 0, recoveryUntil: 0, recoverTo: 0 };
}
export function flowMultiplier(state: FlowState): number { return 1 + Math.max(0, Math.min(5, state.level) - 1) * 0.15; }
