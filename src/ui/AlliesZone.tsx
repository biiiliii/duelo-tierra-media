import { allyChoices, hasAllies } from '../engine/engine';
import { RACE_NAMES, SIDE_TITLES } from '../engine/labels';
import type { GameState, Side } from '../engine/types';
import { AllyBack, AllyCard } from './AllyCard';
import { Glyph } from './Icon';

interface AllyProps {
  state: GameState;
  side: Side;
  /** Whether this side's hidden Allies are shown (your own, or the player to move in hot-seat). */
  showHand?: boolean;
  /** Calls an Ally ('arrive:<id>' / 'retreat:<id>') when the viewer may act now. */
  onAlly?: (value: string) => void;
}

/** Allies expansion: Power tokens, revealed and hidden Allies, and what Sauron's tokens have locked. */
function AllySideRow({ state, side, showHand, onAlly }: AllyProps) {
  const p = state.players[side];
  // Only your own hand can be called (online the rival's is hidden, and may still be on screen as a turn ends).
  const canCall = Boolean(onAlly) && showHand && state.current === side && !state.prompt && !state.allyUsed && !state.winner;
  const choices = new Set(canCall ? allyChoices(state, side).map((o) => o.value) : []);
  const hand = p.allyHand ?? [];
  const lockedRaces = (state.locks?.races ?? []).filter((l) => l.side === side).map((l) => RACE_NAMES[l.race]);
  const live = (value: string) => (choices.has(value) ? () => onAlly!(value) : undefined);
  return (
    <div className={`allies allies-${side}${state.current === side && !state.winner ? ' allies-active' : ''}`} aria-label={`Aliats de ${SIDE_TITLES[side]}`}>
      <p className="allies-head">
        <b className="allies-who">{SIDE_TITLES[side]}</b>
        <span className="power" title="Fitxes de Poder"><Glyph name="power" size={18} /> {p.power ?? 0}</span>
        <span>fitxes de Poder</span>
        {(p.ringBlock ?? 0) > 0 && (
          <span className="allies-warn" title="Fitxes sobre el Nazgûl"><Glyph name="nazgul" size={15} /> −{p.ringBlock} Anell</span>
        )}
      </p>
      {lockedRaces.length > 0 && <p className="allies-warn">Aliances bloquejades: {lockedRaces.join(', ')}</p>}
      <div className="ally-row">
        {(p.allies ?? []).map((id) => <AllyCard key={id} id={id} status="shown" onRetreat={live(`retreat:${id}`)} />)}
        {hand.map((id, i) => (showHand
          ? <AllyCard key={id} id={id} status="hand" onArrive={live(`arrive:${id}`)} />
          : <AllyBack key={`h${i}`} side={side} />))}
        {(p.alliesGone ?? []).map((id) => <AllyCard key={id} id={id} status="gone" />)}
      </div>
    </div>
  );
}

interface ZoneProps {
  state: GameState;
  /** Top to bottom: the rival first, then you. */
  order: Side[];
  /** Whether a side's hidden Allies are shown face up. */
  showHand: (side: Side) => boolean;
  onAlly?: (value: string) => void;
}

/** Allies expansion: the table area below the formation, with each side's Power tokens and Ally cards. */
export function AlliesZone({ state, order, showHand, onAlly }: ZoneProps) {
  if (!hasAllies(state)) return null;
  return (
    <section className="panel allies-zone" aria-label="Aliats">
      <h2>Aliats</h2>
      {order.map((side) => <AllySideRow key={side} state={state} side={side} showHand={showHand(side)} onAlly={onAlly} />)}
    </section>
  );
}
