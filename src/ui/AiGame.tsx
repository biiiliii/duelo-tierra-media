import { useEffect, useState } from 'react';
import type { AiLevel } from '../engine/ai';
import { otherSide } from '../engine/data';
import { IllegalAction, applyAction, newGame } from '../engine/engine';
import type { Action, GameState, Side } from '../engine/types';
import type { AiRequest } from './aiWorker';
import { GameScreen } from './GameScreen';

export const AI_LEVEL_NAMES: Record<AiLevel, string> = { easy: 'Fàcil', normal: 'Normal', hard: 'Difícil', impossible: 'Impossible', apocalypse: 'Apocalipsi' };

interface Props {
  level: AiLevel;
  you: Side;
  onExit: () => void;
}

/** One player against the computer. The AI shows each move after a short pause so its plays can be followed. */
export function AiGame({ level, you, onExit }: Props) {
  const [history, setHistory] = useState<GameState[]>(() => [newGame()]);
  const [error, setError] = useState<string | null>(null);
  const state = history[history.length - 1];
  const aiTurn = !state.winner && state.current !== you;

  useEffect(() => {
    if (!aiTurn) return;
    // It thinks in a worker during the pause, so a long search does not freeze the page.
    const worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
    const shown = Date.now() + (state.prompt ? 650 : 1000);
    let timer = 0;
    worker.onmessage = (e: MessageEvent<Action>) => {
      worker.terminate();
      const next = applyAction(state, e.data);
      timer = window.setTimeout(() => {
        // Ignore the move if the game changed meanwhile (undo, new game).
        setHistory((h) => (h[h.length - 1] === state ? [...h, next] : h));
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
      setHistory([...history, applyAction(state, action)]);
      setError(null);
    } catch (e) {
      if (e instanceof IllegalAction) setError(e.message);
      else throw e;
    }
  };

  // Undo goes back to your previous decision, skipping the AI's moves in between.
  let undoTo = -1;
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].current === you && !history[i].winner) { undoTo = i; break; }
  }

  const restart = () => {
    if (state.winner || window.confirm('Vols començar una partida nova? Es perdrà la partida actual.')) {
      setHistory([newGame()]);
      setError(null);
    }
  };

  const aiName = `la IA (${AI_LEVEL_NAMES[level]})`;
  return (
    <GameScreen
      state={state}
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
          <button type="button" onClick={() => { setHistory(history.slice(0, undoTo + 1)); setError(null); }} disabled={undoTo < 0}>Desfés</button>
          <button type="button" onClick={restart}>Partida nova</button>
          <button type="button" onClick={onExit}>Surt</button>
        </>
      }
    />
  );
}
