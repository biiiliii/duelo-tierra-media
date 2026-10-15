import { useEffect, useState } from 'react';
import type { AiLevel } from '../engine/ai';
import { IllegalAction, applyAction, newGame } from '../engine/engine';
import type { Action, GameState, Side } from '../engine/types';
import { AiGame } from './AiGame';
import { GameScreen } from './GameScreen';
import { Lobby } from './Lobby';
import { OnlineGame } from './OnlineGame';

type Route =
  | { kind: 'lobby' }
  | { kind: 'local' }
  | { kind: 'room'; code: string }
  | { kind: 'ai'; level: AiLevel; side: Side };

// Catalan URL values: ?ia=normal&bandol=comunitat
const LEVEL_PARAM: Record<AiLevel, string> = { easy: 'facil', normal: 'normal', hard: 'dificil', impossible: 'impossible' };
const SIDE_PARAM: Record<Side, string> = { fellowship: 'comunitat', sauron: 'sauron' };
const fromParam = <K extends string>(map: Record<K, string>, value: string | null) =>
  (Object.keys(map) as K[]).find((k) => map[k] === value);

function readRoute(): Route {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('sala');
  if (code) return { kind: 'room', code: code.toUpperCase() };
  if (params.has('local')) return { kind: 'local' };
  if (params.has('ia')) {
    return {
      kind: 'ai',
      level: fromParam(LEVEL_PARAM, params.get('ia')) ?? 'normal',
      side: fromParam(SIDE_PARAM, params.get('bandol')) ?? 'fellowship',
    };
  }
  return { kind: 'lobby' };
}

function searchFor(route: Route): string {
  switch (route.kind) {
    case 'room': return `?sala=${route.code}`;
    case 'local': return '?local';
    case 'ai': return `?ia=${LEVEL_PARAM[route.level]}&bandol=${SIDE_PARAM[route.side]}`;
    default: return '';
  }
}

function go(route: Route, set: (r: Route) => void) {
  const search = searchFor(route);
  window.history.pushState(null, '', `${window.location.pathname}${search}`);
  set(route);
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const toLobby = () => go({ kind: 'lobby' }, setRoute);

  if (route.kind === 'room') return <OnlineGame key={route.code} code={route.code} onExit={toLobby} />;
  if (route.kind === 'local') return <LocalGame onExit={toLobby} />;
  if (route.kind === 'ai') return <AiGame key={searchFor(route)} level={route.level} you={route.side} onExit={toLobby} />;
  return (
    <Lobby
      onEnterRoom={(code) => go({ kind: 'room', code }, setRoute)}
      onLocal={() => go({ kind: 'local' }, setRoute)}
      onAi={(level, side) => go({ kind: 'ai', level, side }, setRoute)}
    />
  );
}

/** Hot-seat game on one computer, with undo. */
function LocalGame({ onExit }: { onExit: () => void }) {
  const [history, setHistory] = useState<GameState[]>(() => [newGame()]);
  const [error, setError] = useState<string | null>(null);
  const state = history[history.length - 1];

  const onAction = (action: Action) => {
    try {
      setHistory([...history, applyAction(state, action)]);
      setError(null);
    } catch (e) {
      if (e instanceof IllegalAction) setError(e.message);
      else throw e;
    }
  };

  const restart = () => {
    if (state.winner || window.confirm('Vols començar una partida nova? Es perdrà la partida actual.')) {
      setHistory([newGame()]);
      setError(null);
    }
  };

  return (
    <GameScreen
      state={state}
      canAct
      you={null}
      onAction={onAction}
      error={error}
      topbar={
        <>
          <button type="button" onClick={() => setHistory(history.slice(0, -1))} disabled={history.length <= 1}>Desfés</button>
          <button type="button" onClick={restart}>Partida nova</button>
          <button type="button" onClick={onExit}>Surt</button>
        </>
      }
    />
  );
}
