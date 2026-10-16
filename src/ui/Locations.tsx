import { LOCATIONS } from '../engine/data';
import { locationCost, skillCoverage, skillPool } from '../engine/costs';
import { REGION_NAMES } from '../engine/labels';
import type { GameState, Side, LocationEffect } from '../engine/types';
import { Coin, Glyph, Piece, RegionBanner, SkillMedal } from './Icon';
import { REGION_COLOR } from './icons';

export function effectText(e: LocationEffect): string {
  switch (e.type) {
    case 'place_units': return `+${e.n} unitat${e.n > 1 ? 's' : ''} a ${REGION_NAMES[e.region]}`;
    case 'play_from_discard': return 'Juga gratis 1 carta del descart';
    case 'discard_opponent_grey': return 'El rival descarta 1 carta Grisa';
    case 'ring': return `Avança ${e.n} a la Missió de l'Anell`;
    case 'move': return `${e.n} moviment${e.n > 1 ? 's' : ''}`;
    case 'coins': return `+${e.n} monedes`;
    case 'alliance_any_race': return 'Fitxa d\'aliança de la raça que vulguis';
  }
}

interface Props {
  state: GameState;
  disabled: boolean;
  onTake: (id: string) => void;
  /** Whose costs to show (online: always your own). Defaults to the player to move. */
  viewer?: Side | null;
}

export function Locations({ state, disabled, onTake, viewer }: Props) {
  const me = state.players[viewer ?? state.current];
  const pool = skillPool(state, viewer ?? state.current);
  return (
    <section className="panel locations" aria-label="Llocs clau">
      <h2>Llocs clau</h2>
      {state.locationsFaceUp.length === 0 && (
        <p className="muted">No en queda cap de disponible fins al proper capítol.</p>
      )}
      <div className="location-row">
        {state.locationsFaceUp.map((id) => {
          const loc = LOCATIONS[id];
          const quote = locationCost(state, viewer ?? state.current, id);
          const extra = quote.coins > 0;
          const have = skillCoverage(loc.cost.skills, pool);
          return (
            <article key={id} className="location" data-fx={`loc-${id}`} style={{ ['--banner' as string]: REGION_COLOR[loc.region], ['--cost-n' as string]: loc.cost.skills.length }}>
              <header className="location-head">
                <RegionBanner region={loc.region} size={22} />
                <div>
                  <h3>{loc.name}</h3>
                  <span className="location-region">
                    <Piece side={state.current} kind="fortress" size={12} /> Fortalesa a {REGION_NAMES[loc.region]}
                  </span>
                </div>
              </header>
              <div className="location-cost">
                {loc.cost.skills.map((s, i) => <SkillMedal key={i} skill={s} size={20} have={have[i]} />)}
              </div>
              <ul>{loc.effects.map((e, i) => <li key={i}>{effectText(e)}</li>)}</ul>
              <button
                type="button"
                className={quote.affordable ? 'primary' : undefined}
                disabled={disabled || !quote.affordable}
                onClick={() => onTake(id)}
              >
                <Glyph name="fortress" size={15} />
                {quote.affordable
                  ? extra ? <>Construeix-lo per <Coin n={quote.coins} size={22} /></> : 'Construeix-lo gratis'
                  : <>Et falten <Coin n={quote.coins - me.coins} size={22} /></>}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
