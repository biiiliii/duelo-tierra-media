import { cardCost } from '../engine/costs';
import { SIDE_TITLES } from '../engine/labels';
import type { GameState, Side } from '../engine/types';
import { CardFace, costHave } from './CardView';
import { Coin, Glyph } from './Icon';
import { SIDE_GLYPH } from './icons';

interface Props {
  state: GameState;
  selected: number | null;
  onPlay: () => void;
  onDiscard: () => void;
  onChoose: (value: string) => void;
  /** Online, rival's turn: name of who we are waiting for. Renders the bar read-only. */
  waitingFor?: string | null;
}

function Who({ side }: { side: Side }) {
  const Crest = SIDE_GLYPH[side];
  return (
    <p className="action-who">
      <Crest className="action-crest" aria-hidden="true" />
      Torn de {SIDE_TITLES[side]}
    </p>
  );
}

export function ActionBar({ state, selected, onPlay, onDiscard, onChoose, waitingFor }: Props) {
  if (state.winner) {
    const names = state.winner.sides.map((s) => SIDE_TITLES[s]).join(' i ');
    return (
      <div className="action-bar action-win" role="status">
        <Glyph name={state.winner.sides.length === 2 ? 'swords' : state.winner.sides[0] === 'fellowship' ? 'volcano' : 'eye'} size={42} className="win-icon" />
        <h2>{state.winner.sides.length === 2 ? 'Empat' : `Guanya ${names}`}</h2>
        <p>{state.winner.reason}</p>
      </div>
    );
  }

  const side = state.current;

  if (waitingFor) {
    return (
      <div className={`action-bar action-waiting side-${side}`} role="status">
        <Who side={side} />
        {state.prompt && <p className="action-msg">{state.prompt.message}</p>}
        <p className="action-wait"><span className="wait-dot" aria-hidden="true" />Esperant que jugui {waitingFor}…</p>
      </div>
    );
  }

  if (state.prompt) {
    const p = state.prompt;
    return (
      <div className={`action-bar action-prompt side-${side}`} role="status">
        <Who side={side} />
        <p className="action-msg">
          {p.message}
          {p.target === 'region' && <span className="action-hint"> També pots clicar la regió al mapa.</span>}
        </p>
        <div className={`options options-${p.target}`}>
          {p.options.map((o) => (
            <button key={o.value} type="button" onClick={() => onChoose(o.value)}>
              {p.target === 'card' ? <><CardFace cardId={o.value} size="chip" /><span>{o.label}</span></> : o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Same layout as with a card selected (an empty card outline in its place), so the bar keeps its height.
  if (selected === null) {
    return (
      <div className={`action-bar action-card side-${side}`} role="status">
        <div className="card-placeholder" aria-hidden="true">Tria una carta</div>
        <div className="action-card-body">
          <Who side={side} />
          <p className="action-msg">Tria una carta accessible de la formació o construeix un lloc clau.</p>
        </div>
      </div>
    );
  }

  const slot = state.slots[selected];
  const quote = cardCost(state, side, slot.cardId);
  const discardCoins = state.chapter * (state.players[side].tokens.includes('men_discard_double') ? 2 : 1);
  const missing = quote.coins - state.players[side].coins;
  return (
    <div className={`action-bar action-card side-${side}`} role="status">
      <CardFace cardId={slot.cardId} size="lg" have={costHave(state, side, slot.cardId)} />
      <div className="action-card-body">
        <Who side={side} />
        <div className="action-buttons">
          <button type="button" className="primary" disabled={!quote.affordable} onClick={onPlay}>
            {quote.viaChain
              ? 'Juga-la gratis per cadena'
              : quote.affordable
                ? quote.coins === 0 ? 'Juga-la gratis' : <>Juga-la per <Coin n={quote.coins} size={23} /></>
                : <>Et falten <Coin n={missing} size={23} /> per jugar-la</>}
          </button>
          <button type="button" onClick={onDiscard}>
            Descarta-la i guanya <Coin n={discardCoins} size={23} />
          </button>
        </div>
      </div>
    </div>
  );
}
