import chapter1 from '../../data/chapter1_cards.json' with { type: 'json' };
import chapter2 from '../../data/chapter2_cards.json' with { type: 'json' };
import chapter3 from '../../data/chapter3_cards.json' with { type: 'json' };
import locationsJson from '../../data/key_locations.json' with { type: 'json' };
import expansionJson from '../../data/expansion_locations.json' with { type: 'json' };
import tokensJson from '../../data/alliance_tokens.json' with { type: 'json' };
import mapJson from '../../data/map.json' with { type: 'json' };
import ringJson from '../../data/ring_track.json' with { type: 'json' };
import formationsJson from '../../data/formations.json' with { type: 'json' };
import type {
  CardDef, Chapter, Expansion, LocationDef, Race, RegionId, Side, Skill, SpecialIcon, TokenDef,
} from './types.js';

interface RawCard {
  id: string;
  color: string;
  artwork: string;
  cost: { coins: number; skills: string[]; chain_symbol_required: string | null };
  effect: {
    coins: number;
    ring_advance: number;
    race_symbol: { icon: string; race: string } | null;
    skill_symbols: string[];
    skill_choice: string[] | null;
    military: { units: number; region_choice: string[] } | null;
    special_icons: { order: string[] } | null;
    chain_symbol_granted: string | null;
  };
}

function toCard(raw: RawCard, chapter: Chapter): CardDef {
  const e = raw.effect;
  return {
    id: raw.id,
    chapter,
    color: raw.color as CardDef['color'],
    artwork: raw.artwork,
    cost: {
      coins: raw.cost.coins,
      skills: raw.cost.skills as Skill[],
      chain: raw.cost.chain_symbol_required,
    },
    effect: {
      coins: e.coins,
      ring: e.ring_advance,
      race: (e.race_symbol?.race ?? null) as Race | null,
      skills: e.skill_symbols as Skill[],
      skillChoice: e.skill_choice as Skill[] | null,
      military: e.military
        ? { units: e.military.units, regions: e.military.region_choice as RegionId[] }
        : null,
      special: (e.special_icons?.order ?? null) as SpecialIcon[] | null,
      chainOut: e.chain_symbol_granted,
    },
  };
}

const rawByChapter: Record<Chapter, RawCard[]> = {
  1: chapter1.cards as RawCard[],
  2: chapter2.cards as RawCard[],
  3: chapter3.cards as RawCard[],
};

export const CARDS: Record<string, CardDef> = {};
export const CHAPTER_CARDS: Record<Chapter, string[]> = { 1: [], 2: [], 3: [] };
for (const ch of [1, 2, 3] as Chapter[]) {
  for (const raw of rawByChapter[ch]) {
    const card = toCard(raw, ch);
    CARDS[card.id] = card;
    CHAPTER_CARDS[ch].push(card.id);
  }
}

/** The base game's key locations; the promo tiles join the stack only when chosen. */
export const BASE_LOCATIONS: string[] = locationsJson.locations.map((l) => l.id);
export const EXPANSIONS: Expansion[] = expansionJson.locations.map((l) => l.id as Expansion);
export const LOCATIONS: Record<string, LocationDef> = Object.fromEntries(
  ([...locationsJson.locations, ...expansionJson.locations] as LocationDef[]).map((l) => [l.id, l]),
);

export const TOKENS: Record<string, TokenDef> = Object.fromEntries(
  (tokensJson.tokens as TokenDef[]).map((t) => [t.id, t]),
);

export const RACES: Race[] = ['elves', 'dwarves', 'hobbits', 'men', 'ents', 'wizards'];
export const SKILLS: Skill[] = ['mask', 'fist', 'heart', 'book', 'crown'];
export const SIDES: Side[] = ['fellowship', 'sauron'];

export interface RegionDef { id: RegionId; name: string; banner: string; pos: [number, number] }
export const REGIONS: RegionDef[] = mapJson.regions as RegionDef[];
export const REGION_IDS: RegionId[] = REGIONS.map((r) => r.id);
export const CONNECTIONS = mapJson.connections as [RegionId, RegionId][];
export const ADJACENT: Record<RegionId, RegionId[]> = Object.fromEntries(
  REGION_IDS.map((id) => [
    id,
    CONNECTIONS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])),
  ]),
) as Record<RegionId, RegionId[]>;
export const MAP_SETUP = mapJson.setup as Record<Side, Partial<Record<RegionId, number>>>;
export const PIECES = mapJson.pieces_per_side;

export type RingBonus = 'coin' | 'unit' | 'extra_turn' | 'remove_fortress';
export const RING_LENGTH: number = ringJson.length;
export const RING_BONUSES: Record<number, RingBonus> = Object.fromEntries(
  Object.entries(ringJson.bonuses).map(([k, v]) => [Number(k), v as RingBonus]),
);

export interface FormationRow { x: number[]; faceUp: boolean }
export const FORMATIONS = formationsJson.chapters as unknown as Record<`${Chapter}`, FormationRow[]>;

export function otherSide(side: Side): Side {
  return side === 'fellowship' ? 'sauron' : 'fellowship';
}
