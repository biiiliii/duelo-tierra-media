import { CARDS, LOCATIONS, SKILLS, TOKENS } from '../engine/data';
import { chainSymbols, skillPool } from '../engine/costs';
import { presence, raceSymbols } from '../engine/engine';
import { RACE_NAMES, SIDE_TITLES, TOKEN_TEXT } from '../engine/labels';
import type { Color, GameState, Race, Side } from '../engine/types';
import { CardFace } from './CardView';
import { ChainBanner, Coin, Piece, RaceIcon, SkillMedal } from './Icon';
import { SIDE_GLYPH } from './icons';

const COLOR_ORDER: Color[] = ['grey', 'yellow', 'blue', 'green', 'red', 'purple'];

export function PlayerPanel({ state, side }: { state: GameState; side: Side }) {
  const p = state.players[side];
  const pool = skillPool(state, side);
  const chains = [...chainSymbols(state, side)];
  const races = [...raceSymbols(state, side)] as (Race | 'eagle')[];
  const active = state.current === side && !state.winner;
  const Crest = SIDE_GLYPH[side];
  const cards = [...p.cards].sort(
    (a, b) => COLOR_ORDER.indexOf(CARDS[a].color) - COLOR_ORDER.indexOf(CARDS[b].color),
  );
  return (
    <section className={`panel player player-${side}${active ? ' player-active' : ''}`} aria-label={SIDE_TITLES[side]}>
      <header className="player-head">
        <Crest className="player-crest" aria-hidden="true" />
        <h2>{SIDE_TITLES[side]}</h2>
        {active && <span className="turn-flag">Li toca</span>}
      </header>

      <div className="stats">
        <div className="stat" title="Monedes"><Coin n={p.coins} size={30} /><span>monedes</span></div>
        <div className="stat" title="Regions on és present">
          <b className="stat-big">{presence(state, side)}<small>/7</small></b><span>regions</span>
        </div>
        <div className="stat" title="Peces a la reserva">
          <span className="stat-pieces">
            <Piece side={side} kind="unit" size={15} />{p.unitsSupply}
            <Piece side={side} kind="fortress" size={15} />{p.fortressSupply}
          </span>
          <span>reserva</span>
        </div>
      </div>

      <div className="skills-row" aria-label="Habilitats">
        {SKILLS.map((s) => (
          <span key={s} className={pool.fixed[s] ? '' : 'zero'}>
            <SkillMedal skill={s} size={24} count={pool.fixed[s]} />
          </span>
        ))}
        {pool.flexible.map((opts, i) => (
          <span key={`f${i}`} className="skill-flex" title="Només una d'aquestes per torn">
            {opts.length === 5 ? <span className="wild">Qualsevol</span> : opts.map((s, j) => (
              <span key={s} className="skill-flex-item">{j > 0 && '/'}<SkillMedal skill={s} size={18} /></span>
            ))}
          </span>
        ))}
      </div>

      <div className="chips">
        <span className="chips-label">Races {races.length}/6</span>
        {races.length === 0 ? <span className="muted">cap</span> : races.map((r) => (
          <span key={r} className="chip chip-race" title={RACE_NAMES[r]}><RaceIcon race={r} size={17} /></span>
        ))}
      </div>
      <div className="chips">
        <span className="chips-label">Cadenes</span>
        {chains.length === 0 ? <span className="muted">cap</span> : chains.map((c) => (
          <ChainBanner key={c} symbol={c} kind="chip" />
        ))}
      </div>

      {p.tokens.length > 0 && (
        <ul className="tokens">
          {p.tokens.map((t) => (
            <li key={t} className={`plaque plaque-${TOKENS[t].kind}`}>
              <span className="plaque-shield"><RaceIcon race={TOKENS[t].race} size={16} /></span>
              <span><b>{RACE_NAMES[TOKENS[t].race]}</b> {TOKEN_TEXT[t]}</span>
            </li>
          ))}
        </ul>
      )}

      {p.locations.length > 0 && (
        <p className="player-locs">
          <Piece side={side} kind="fortress" size={14} /> {p.locations.map((l) => LOCATIONS[l].name).join(', ')}
        </p>
      )}

      {cards.length > 0 && (
        <div className="tableau" aria-label="Cartes jugades">
          {cards.map((c, i) => <CardFace key={c + i} cardId={c} size="chip" />)}
        </div>
      )}
    </section>
  );
}
