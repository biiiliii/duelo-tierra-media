import type { IconType } from 'react-icons';
import { LOCATIONS } from '../engine/data';
import { CHAIN_NAMES, RACE_NAMES, REGION_NAMES, SKILL_NAMES } from '../engine/labels';
import type { Expansion, Race, RegionId, Side, Skill } from '../engine/types';
import { CHAIN_GLYPH, GLYPH, PROMO_BANNER, RACE_GLYPH, REGION_COLOR, REGION_EMBLEM, REGION_GLYPH, SKILL_GLYPH } from './icons';

type Len = number | string;
const len = (v: Len) => (typeof v === 'number' ? `${v}px` : v);

/** A skill drawn white inside its coloured medallion, as on the real cards. */
/** `have`: in a cost, the player already produces this skill, so it costs nothing. */
export function SkillMedal({ skill, size = 18, count, have }: { skill: Skill; size?: Len; count?: number; have?: boolean }) {
  const Glyph = SKILL_GLYPH[skill];
  return (
    <span
      className={`medal medal-${skill}${have ? ' medal-have' : ''}`}
      style={{ ['--s' as string]: len(size) }}
      title={have ? `${SKILL_NAMES[skill]} (ja la tens)` : SKILL_NAMES[skill]}
    >
      <Glyph aria-hidden="true" />
      {count !== undefined && <b className="medal-count">{count}</b>}
      {have && <b className="medal-check" aria-hidden="true">✓</b>}
    </span>
  );
}

export function SkillList({ skills, size, sep }: { skills: Skill[]; size?: Len; sep?: boolean }) {
  return (
    <span className="medal-list">
      {skills.map((s, i) => (
        <span key={i} className="medal-item">
          {sep && i > 0 && <span className="medal-sep">/</span>}
          <SkillMedal skill={s} size={size} />
        </span>
      ))}
    </span>
  );
}

/** Gold coin medallion with a number in the middle. */
export function Coin({ n, size = 18 }: { n?: number | string; size?: Len }) {
  return (
    <span className="coin" style={{ ['--s' as string]: len(size) }} title={n !== undefined ? `${n} monedes` : 'Monedes'}>
      {n ?? ''}
    </span>
  );
}

export function RaceIcon({ race, size = 18 }: { race: Race | 'eagle'; size?: Len }) {
  const Glyph = RACE_GLYPH[race];
  return <Glyph className="race-icon" size={size} title={RACE_NAMES[race]} />;
}

/** Small hanging banner with a chain symbol (top-right = granted, left = required). */
/** `have`: on a card's cost, the player owns the matching chain symbol, so the card is free. */
export function ChainBanner({ symbol, kind, have }: { symbol: string; kind: 'in' | 'out' | 'chip'; have?: boolean }) {
  const Glyph = CHAIN_GLYPH[symbol];
  const title = kind === 'in'
    ? have ? `Gratis: ja tens ${CHAIN_NAMES[symbol]}` : `Gratis si tens: ${CHAIN_NAMES[symbol]}`
    : `Cadena: ${CHAIN_NAMES[symbol]}`;
  return (
    <span className={`chain chain-${kind}${have ? ' chain-have' : ''}`} title={title}>
      <Glyph aria-hidden="true" />
    </span>
  );
}

/** Region standard: coloured banner with its emblem. */
export function RegionBanner({ region, size = 22, label }: { region: RegionId; size?: Len; label?: boolean }) {
  const Glyph = REGION_GLYPH[region];
  return (
    <span
      className="banner"
      style={{ ['--banner' as string]: REGION_COLOR[region], ['--emblem' as string]: REGION_EMBLEM[region], ['--s' as string]: len(size) }}
      title={REGION_NAMES[region]}
    >
      <Glyph aria-hidden="true" />
      {label && <span className="banner-label">{REGION_NAMES[region]}</span>}
    </span>
  );
}

/** A key location's banner: its region's, or the promo tile's own when it has no region. */
export function LocationBanner({ id, size = 22 }: { id: string; size?: Len }) {
  const loc = LOCATIONS[id];
  if (loc.region) return <RegionBanner region={loc.region} size={size} />;
  const promo = PROMO_BANNER[id as Expansion];
  return (
    <span className="banner" style={{ ['--banner' as string]: promo.color, ['--emblem' as string]: promo.emblem, ['--s' as string]: len(size) }} title={loc.name}>
      <promo.glyph aria-hidden="true" />
    </span>
  );
}

/** Unit / fortress piece in a side colour. */
export function Piece({ side, kind, size = 14 }: { side: Side; kind: 'unit' | 'fortress'; size?: Len }) {
  const Glyph: IconType = kind === 'unit' ? GLYPH.unit : GLYPH.fortress;
  return <Glyph className={`piece piece-${side}`} size={size} aria-hidden="true" />;
}

export function Glyph({ name, size = 16, className, title }: { name: keyof typeof GLYPH; size?: Len; className?: string; title?: string }) {
  const G = GLYPH[name];
  return <G size={size} className={className} title={title} aria-hidden={title ? undefined : true} />;
}
