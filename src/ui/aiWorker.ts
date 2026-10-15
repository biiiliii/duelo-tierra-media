import { chooseAction, type AiLevel } from '../engine/ai';
import type { Action, GameState } from '../engine/types';

export interface AiRequest { state: GameState; level: AiLevel }

// Runs the AI search off the main thread so the page keeps responding while it thinks.
const scope = self as unknown as { onmessage: ((e: MessageEvent<AiRequest>) => void) | null; postMessage(action: Action): void };
scope.onmessage = (e) => scope.postMessage(chooseAction(e.data.state, e.data.level));
