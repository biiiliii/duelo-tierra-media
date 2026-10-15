export type Side = 'fellowship' | 'sauron';
export type Skill = 'mask' | 'fist' | 'heart' | 'book' | 'crown';
export type Color = 'blue' | 'green' | 'grey' | 'yellow' | 'red' | 'purple';
export type Race = 'elves' | 'dwarves' | 'hobbits' | 'men' | 'ents' | 'wizards';
export type RegionId = 'lindon' | 'arnor' | 'rhovanion' | 'enedwaith' | 'rohan' | 'gondor' | 'mordor';
export type SpecialIcon = 'arrow' | 'coin_cross' | 'unit_cross';
export type Chapter = 1 | 2 | 3;

export interface CardDef {
  id: string;
  chapter: Chapter;
  color: Color;
  artwork: string;
  cost: { coins: number; skills: Skill[]; chain: string | null };
  effect: {
    coins: number;
    ring: number;
    race: Race | null;
    skills: Skill[];
    skillChoice: Skill[] | null;
    military: { units: number; regions: RegionId[] } | null;
    special: SpecialIcon[] | null;
    chainOut: string | null;
  };
}

export type LocationEffect =
  | { type: 'place_units'; n: number; region: RegionId }
  | { type: 'play_from_discard' }
  | { type: 'discard_opponent_grey' }
  | { type: 'ring'; n: number }
  | { type: 'move'; n: number }
  | { type: 'coins'; n: number }
  | { type: 'alliance_any_race' };

export interface LocationDef {
  id: string;
  name: string;
  region: RegionId;
  cost: { coins: number; skills: Skill[] };
  effects: LocationEffect[];
}

export interface TokenDef {
  id: string;
  race: Race;
  kind: 'passive' | 'instant';
  text: string;
}

export interface PlayerState {
  side: Side;
  coins: number;
  cards: string[];
  locations: string[];
  tokens: string[];
  ring: number;
  unitsSupply: number;
  fortressSupply: number;
  pairsTaken: Race[];
  usedThreeDifferent: boolean;
}

export interface Slot {
  id: number;
  cardId: string;
  row: number;
  x: number;
  faceUp: boolean;
  taken: boolean;
}

export interface RegionState {
  units: Record<Side, number>;
  fortress: Side | null;
}

/** One pending effect. Effects always belong to the player whose turn it is. */
export type Step =
  | { k: 'coins'; n: number }
  | { k: 'ring'; n: number }
  | { k: 'placeUnits'; n: number; regions: RegionId[] }
  | { k: 'placeFortress'; region: RegionId }
  | { k: 'move'; n: number }
  | { k: 'moveTo'; from: RegionId; n: number }
  | { k: 'oppLoseCoin'; n: number }
  | { k: 'removeEnemyUnit' }
  | { k: 'removeEnemyFortress' }
  | { k: 'extraTurn' }
  | { k: 'checkRaces'; race: Race }
  | { k: 'alliance'; races: Race[]; perRace: number; reason: string }
  | { k: 'allianceAnyRace' }
  | { k: 'playFromDiscard' }
  | { k: 'discardOppGrey' }
  | { k: 'wizardUnits' }
  | { k: 'wizardFirst' }
  | { k: 'wizardSecond'; exclude: RegionId }
  | { k: 'entsTriple'; n: number };

export interface PromptOption {
  value: string;
  label: string;
}

export interface Prompt {
  step: Step;
  message: string;
  options: PromptOption[];
  /** Kind of target, so the UI can make the map or the cards clickable. */
  target: 'region' | 'token' | 'card' | 'choice';
  /** Tokens drawn for an alliance choice (kept here until one is picked). */
  drawn?: string[];
}

export interface Winner {
  sides: Side[];
  reason: string;
}

export interface GameState {
  players: Record<Side, PlayerState>;
  regions: Record<RegionId, RegionState>;
  chapter: Chapter;
  slots: Slot[];
  discard: string[];
  locationDeck: string[];
  locationsFaceUp: string[];
  alliancePiles: Record<Race, string[]>;
  current: Side;
  extraTurns: number;
  queue: Step[];
  prompt: Prompt | null;
  winner: Winner | null;
  log: string[];
  seed: number;
  turn: number;
}

export type Action =
  | { type: 'takeCard'; slot: number; mode: 'play' | 'discard' }
  | { type: 'takeLocation'; id: string }
  | { type: 'choose'; value: string };
