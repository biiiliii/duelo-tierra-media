import { useEffect, useState } from 'react';
import type { AiLevel } from '../engine/ai';
import { otherSide } from '../engine/data';
import { IllegalAction, applyAction, newGame } from '../engine/engine';
import { SIDE_NAMES } from '../engine/labels';
import { encodeRecord } from '../engine/replay';
import type { Action, Expansion, GameState, Side } from '../engine/types';
import type { AiRequest } from './aiWorker';
import { GameScreen } from './GameScreen';

export const AI_LEVEL_NAMES: Record<AiLevel, string> = { easy: 'Fàcil', normal: 'Normal', hard: 'Difícil', impossible: 'Impossible', apocalypse: 'Apocalipsi' };

interface Props {
  level: AiLevel;
  you: Side;
  /** Promo tiles to play with. */
  expansions: Expansion[];
  onExit: () => void;
}

/** One player against the computer. The AI shows each move after a short pause so its plays can be followed. */
/** A position and the move that led to it (none for the deal). */
interface Step { state: GameState; action: Action | null }

function deal(expansions: Expansion[]): { seed: number; history: Step[] } {
  const seed = Date.now() | 0;
  return { seed, history: [{ state: newGame(seed, expansions), action: null }] };
}

export function AiGame({ level, you, expansions, onExit }: Props) {
  const [game, setGame] = useState(() => deal(expansions));
  const [undos, setUndos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const history = game.history;
  const state = history[history.length - 1].state;
  const setHistory = (update: (h: Step[]) => Step[]) => setGame((g) => ({ ...g, history: update(g.history) }));
  const aiTurn = !state.winner && state.current !== you;

  useEffect(() => {
    if (!aiTurn) return;
    // It thinks in a worker during the pause, so a long search does not freeze the page.
    const worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
    const shown = Date.now() + (state.prompt ? 650 : 1000);
    let timer = 0;
    worker.onmessage = (e: MessageEvent<Action>) => {
      worker.terminate();
      const action = e.data;
      const next = applyAction(state, action);
      timer = window.setTimeout(() => {
        // Ignore the move if the game changed meanwhile (undo, new game).
        setHistory((h) => (h[h.length - 1].state === state ? [...h, { state: next, action }] : h));
      }, Math.max(0, shown - Date.now()));
    };
    worker.postMessage({ state, level } satisfies AiRequest);
    return () => {
      worker.terminate();
      window.clearTimeout(timer);
    };
  }, [state, aiTurn, level]);

  const onAction = (action: Action) => {
    if (aiTurn) return;
    try {
      const next = applyAction(state, action);
      setHistory((h) => [...h, { state: next, action }]);
      setError(null);
    } catch (e) {
      if (e instanceof IllegalAction) setError(e.message);
      else throw e;
    }
  };

  // Undo goes back to your previous decision, skipping the AI's moves in between.
  let undoTo = -1;
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].state.current === you && !history[i].state.winner) { undoTo = i; break; }
  }

  const restart = () => {
    if (state.winner || window.confirm('Vols començar una partida nova? Es perdrà la partida actual.')) {
      setGame(deal(expansions));
      setUndos(0);
      setError(null);
    }
  };

  const aiName = `la IA (${AI_LEVEL_NAMES[level]})`;

  // The readable log plus a code from which the whole game, face-down cards included, can be rebuilt.
  const copyLog = () => [
    `Duelo por la Tierra Media: ${SIDE_NAMES[you]} (humà) contra ${aiName}`,
    state.winner ? `Resultat: ${state.winner.sides.map((s) => SIDE_NAMES[s]).join(' i ')} guanya. ${state.winner.reason}` : 'Partida en curs.',
    `Desfés: ${undos === 0 ? 'no' : `${undos} cop${undos > 1 ? 's' : ''}`}.`,
    '',
    ...state.log,
    '',
    'Codi de la partida (per reproduir-la):',
    encodeRecord({
      seed: game.seed, expansions, level, you, undos, version: __APP_VERSION__,
      actions: history.slice(1).map((h) => h.action!),
    }),
  ].join('\n');
  return (
    <GameScreen
      state={state}
      copyLog={copyLog}
      canAct={!aiTurn}
      you={you}
      onAction={onAction}
      error={error}
      waitingName={() => aiName}
      topbar={
        <>
          <span className="vs">
            Tu ets <span className={`vs-${you}`}>{you === 'fellowship' ? 'la Comunitat' : 'Sauron'}</span> contra{' '}
            <span className={`vs-${otherSide(you)}`}>{aiName}</span>
          </span>
          <button type="button" onClick={() => { setHistory((h) => h.slice(0, undoTo + 1)); setUndos((n) => n + 1); setError(null); }} disabled={undoTo < 0}>Desfés</button>
          <button type="button" onClick={restart}>Partida nova</button>
          <button type="button" onClick={onExit}>Surt</button>
        </>
      }
    />
  );
}
