import type { IconType } from 'react-icons';
import { chainSymbols, skillCoverage, skillPool } from '../engine/costs';
import { CARDS } from '../engine/data';
import { cardLabel } from '../engine/labels';
import type { CardDef, GameState, Side, Skill } from '../engine/types';
import { ChainBanner, Coin, Glyph, RaceIcon, RegionBanner, SkillList, SkillMedal } from './Icon';
import { GLYPH, RACE_GLYPH, SKILL_GLYPH } from './icons';

/** Kept for existing importers: a row of skill medallions. */
export function SkillIcons({ skills, sep = '' }: { skills: Skill[]; sep?: string }) {
  return <SkillList skills={skills} sep={sep !== ''} />;
}

function Effect({ card }: { card: CardDef }) {
  const e = card.effect;
  switch (card.color) {
    case 'yellow':
      return <Coin n={e.coins} size="2.6em" />;
    case 'blue':
      return (
        <span className="fx-rings">
          {Array.from({ length: e.ring }, (_, i) => <Glyph key={i} name="ring" size={e.ring > 2 ? '1.8em' : '2.1em'} className="ring-icon" />)}
        </span>
      );
    case 'green':
      return <RaceIcon race={e.race!} size="2.9em" />;
    case 'grey':
      return e.skillChoice
        ? <SkillList skills={e.skillChoice} size={e.skillChoice.length > 2 ? '1.6em' : '1.95em'} sep />
        : <SkillList skills={e.skills} size={e.skills.length > 1 ? '2em' : '2.4em'} />;
    case 'red':
      return (
        <span className="fx-military">
          <RegionBanner region={e.military!.regions[0]} size="1.55em" />
          <span className="fx-units">
            <Glyph name="unit" size="2em" />
            <b>{e.military!.units}</b>
          </span>
          <RegionBanner region={e.military!.regions[1]} size="1.55em" />
        </span>
      );
    case 'purple':
      return (
        <span className="fx-special">
          {e.special!.map((icon, i) =>
            icon === 'arrow' ? (
              <Glyph key={i} name="arrow" size="1.7em" className="fx-arrow" title="Moviment" />
            ) : (
              <span key={i} className="fx-crossed" title={icon === 'coin_cross' ? 'El rival perd 1 moneda' : 'Retira 1 unitat enemiga'}>
                {icon === 'coin_cross' ? <Coin size="1.6em" /> : <Glyph name="unit" size="1.7em" />}
                <Glyph name="cross" className="fx-x" size="1.4em" />
              </span>
            ),
          )}
        </span>
      );
  }
}

function watermark(card: CardDef): IconType {
  switch (card.color) {
    case 'blue': return GLYPH.ring;
    case 'green': return RACE_GLYPH[card.effect.race!];
    case 'red': return GLYPH.swords;
    case 'grey': return SKILL_GLYPH[(card.effect.skillChoice ?? card.effect.skills)[0]];
    case 'yellow': return GLYPH.coinPile;
    case 'purple': return GLYPH.eye;
  }
}

/** What the viewing player already owns towards a card's cost. */
export interface CostHave {
  /** Per skill symbol in the cost: already produced, so free. */
  skills: boolean[];
  /** Owns the chain symbol: the whole card is free. */
  chain: boolean;
}

export function costHave(state: GameState, side: Side, cardId: string): CostHave {
  const cost = CARDS[cardId].cost;
  return {
    skills: skillCoverage(cost.skills, skillPool(state, side)),
    chain: cost.chain !== null && chainSymbols(state, side).has(cost.chain),
  };
}

export function CardFace({ cardId, size = 'sm', have }: { cardId: string; size?: 'sm' | 'lg' | 'chip'; have?: CostHave }) {
  const card = CARDS[cardId];
  const Mark = watermark(card);
  const hasCost = card.cost.coins > 0 || card.cost.skills.length > 0;
  return (
    <div className={`card card-${card.color} card-${size}`} title={cardLabel(cardId)}>
      <div className="card-band">
        <span className="card-effect"><Effect card={card} /></span>
        {card.effect.chainOut && <ChainBanner symbol={card.effect.chainOut} kind="out" />}
      </div>
      {size !== 'chip' && (
        <div className="card-art">
          <Mark className="card-mark" aria-hidden="true" />
          {(hasCost || card.cost.chain) && (
            <div className={`card-cost${have?.chain ? ' card-cost-free' : ''}`}>
              {card.cost.chain && <ChainBanner symbol={card.cost.chain} kind="in" have={have?.chain} />}
              {card.cost.coins > 0 && <Coin n={card.cost.coins} size="1.25em" />}
              {card.cost.skills.map((s, i) => (
                <SkillMedal key={i} skill={s} size="1.25em" have={have && (have.chain || have.skills[i])} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CardBack({ chapter }: { chapter: number }) {
  return (
    <div className={`card card-back card-sm card-back-${chapter}`} aria-label="Carta boca avall">
      <span className="card-back-rune">{['ᚠ', 'ᚱ', 'ᛏ'][chapter - 1]}</span>
    </div>
  );
}
