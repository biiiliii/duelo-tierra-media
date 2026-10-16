import { otherSide, TOKENS } from '../engine/data';
import type { Fx, GameState, Side } from '../engine/types';
import { CardFace } from './CardView';
import { Coin, Glyph, Piece, RaceIcon } from './Icon';
import type { FxApi } from './FxContext';
import { fxRegions } from './fxDirector';

interface Line { text: string; events: Fx[] }

/** The log lines of `side`'s latest run of turns (extra turns included), with the events behind each line. */
export function lastTurn(state: GameState, side: Side): { lines: Line[]; live: boolean } | null {
  const fx = state.fx ?? [];
  let start = -1;
  for (let i = fx.length - 1; i >= 0; i--) {
    const e = fx[i];
    if (e.t !== 'turn') continue;
    if (e.side === side) start = i;
    else if (start >= 0) break;
  }
  if (start < 0) return null;
  const end = fx.findIndex((e, i) => i > start && e.t === 'turn' && e.side !== side);
  const from = fx[start].at;
  const to = end >= 0 ? fx[end].at : state.log.length;
  const lines: Line[] = [];
  for (let at = from; at < to; at++) {
    const text = state.log[at];
    if (!text || text.startsWith('—')) continue;
    lines.push({ text, events: fx.filter((e) => e.at - 1 === at && e.t !== 'turn' && e.t !== 'reveal') });
  }
  return { lines, live: end < 0 && !state.winner };
}

function LineIcon({ events, side }: { events: Fx[]; side: Side }) {
  const e = events[0];
  if (!e) return <span className="summary-dot" />;
  switch (e.t) {
    case 'card':
      return e.cardId ? <CardFace cardId={e.cardId} size="chip" /> : <Coin size={20} />;
    case 'free': return <CardFace cardId={e.cardId} size="chip" />;
    case 'burn': return <CardFace cardId={e.cardId} size="chip" />;
    case 'location': case 'fortress': return <Piece side={side} kind="fortress" size={18} />;
    case 'raze': return <span className="bonus-x"><Piece side={e.side} kind="fortress" size={18} /><Glyph name="cross" size={13} className="fx-x" /></span>;
    case 'units': return <Piece side={e.side} kind="unit" size={18} />;
    case 'move': return <Glyph name="arrow" size={18} className="summary-arrow" />;
    case 'conflict': return <Glyph name="swords" size={18} className="summary-swords" />;
    case 'kill': return <span className="bonus-x"><Piece side={e.side} kind="unit" size={18} /><Glyph name="cross" size={13} className="fx-x" /></span>;
    case 'coins': return <Coin n={e.n > 0 ? `+${e.n}` : e.n} size={22} />;
    case 'ring': return <Glyph name={side === 'fellowship' ? 'frodo' : 'nazgul'} size={18} className={`summary-ring-${side}`} />;
    case 'token': return <RaceIcon race={TOKENS[e.token].race} size={18} />;
    case 'extra': return <Glyph name="extraTurn" size={18} />;
    default: return <span className="summary-dot" />;
  }
}

/** "What did the rival just do?": every line of their latest turn, at a glance. Click a line to see it on the map. */
export function TurnSummary({ state, fx, nameOf, onOpenLog }: {
  state: GameState;
  fx: FxApi;
  nameOf: (side: Side) => string;
  onOpenLog: () => void;
}) {
  // Online or against the AI: the rival. Hot-seat: whoever played before the player to move.
  const side = fx.you ? otherSide(fx.you) : otherSide(state.current);
  const turn = lastTurn(state, side);
  if (!turn || turn.lines.length === 0) return null;
  const name = nameOf(side);
  return (
    <section className={`summary summary-${side}${turn.live ? ' summary-live' : ''}`} aria-label={`Què ha fet ${name}`}>
      <header className="summary-head">
        <h2>{turn.live ? `${name.charAt(0).toUpperCase()}${name.slice(1)} està jugant…` : `Què ha fet ${name}`}</h2>
        <button type="button" className="summary-log" onClick={onOpenLog}>Registre complet</button>
      </header>
      <ol>
        {turn.lines.map((line, i) => {
          const regions = line.events.flatMap(fxRegions);
          const content = <><span className="summary-icon"><LineIcon events={line.events} side={side} /></span><span>{line.text}</span></>;
          return (
            <li key={`${i}-${line.text}`} className={turn.live && i === turn.lines.length - 1 ? 'summary-new' : undefined}>
              {regions.length > 0 ? (
                <button type="button" className="summary-line" onClick={() => fx.focus(regions, side)} title="Mostra-ho al mapa">
                  {content}
                </button>
              ) : <span className="summary-line">{content}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
