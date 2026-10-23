import type { IconType } from 'react-icons';
import {
  GiAcorn, GiAllSeeingEye, GiAnticlockwiseRotation, GiAnvil, GiArrowhead, GiBattleAxe, GiBookCover, GiBowArrow,
  GiBreastplate, GiBroadsword, GiBurningEye, GiCampfire, GiCoinsPile, GiCookingPot, GiCrestedHelmet, GiCrossMark,
  GiCrossedSwords, GiCrown, GiCrystalBall, GiDualityMask, GiFeather, GiFist, GiHarp, GiHeartburn,
  GiHobbitDwelling, GiHoodedFigure, GiHorseHead, GiHorseshoe, GiHuntingHorn, GiInkSwirl, GiMapleLeaf, GiOakLeaf, GiOpenTreasureChest,
  GiPawn, GiRing, GiSailboat, GiScrollUnfurled, GiSiegeRam, GiSmokingPipe, GiSpectre, GiStandingPotion, GiStoneTower,
  GiSunRadiations, GiTeapot, GiTiedScroll, GiTropicalFish, GiTwoCoins, GiVisoredHelm, GiVolcano, GiWarhammer,
  GiWillowTree,
} from 'react-icons/gi';
import type { Expansion, Race, RegionId, Side, Skill } from '../engine/types';

/** Must be shown somewhere in the app (CC BY 3.0 attribution). */
export const ICON_CREDIT = 'Icones de game-icons.net (Lorc, Delapouite i altres), llicència CC BY 3.0.';

export const GLYPH = {
  coin: GiTwoCoins,
  coinPile: GiCoinsPile,
  ring: GiRing,
  unit: GiPawn,
  fortress: GiStoneTower,
  arrow: GiArrowhead,
  extraTurn: GiAnticlockwiseRotation,
  cross: GiCrossMark,
  swords: GiCrossedSwords,
  eye: GiAllSeeingEye,
  volcano: GiVolcano,
  frodo: GiHoodedFigure,
  nazgul: GiSpectre,
} satisfies Record<string, IconType>;

export const SIDE_GLYPH: Record<Side, IconType> = { fellowship: GiHoodedFigure, sauron: GiBurningEye };

export const SKILL_GLYPH: Record<Skill, IconType> = {
  mask: GiDualityMask, fist: GiFist, heart: GiHeartburn, book: GiBookCover, crown: GiCrown,
};

export const RACE_GLYPH: Record<Race | 'eagle', IconType> = {
  elves: GiStandingPotion, dwarves: GiWarhammer, hobbits: GiSmokingPipe, men: GiHuntingHorn,
  ents: GiMapleLeaf, wizards: GiCrystalBall, eagle: GiFeather,
};

export const CHAIN_GLYPH: Record<string, IconType> = {
  fish: GiTropicalFish, teapot: GiTeapot, horse_head: GiHorseHead, horseshoe: GiHorseshoe, anvil: GiAnvil,
  harp: GiHarp, cooking_pot: GiCookingPot, sword: GiBroadsword, helmet: GiVisoredHelm, bow_and_arrow: GiBowArrow,
  rolled_scroll: GiTiedScroll, open_scroll: GiScrollUnfurled, campfire: GiCampfire, acorn: GiAcorn,
  treasure_chest: GiOpenTreasureChest, armour: GiBreastplate, axe: GiBattleAxe,
};

export const REGION_GLYPH: Record<RegionId, IconType> = {
  lindon: GiSailboat, arnor: GiCrestedHelmet, rhovanion: GiOakLeaf, enedwaith: GiInkSwirl,
  rohan: GiHorseHead, gondor: GiWillowTree, mordor: GiSunRadiations,
};

export const REGION_SHORT: Record<RegionId, string> = {
  lindon: 'Li', arnor: 'Ar', rhovanion: 'Rh', enedwaith: 'En', rohan: 'Ro', gondor: 'Go', mordor: 'Mo',
};

/** Banner colours taken from the board's region standards. */
export const REGION_COLOR: Record<RegionId, string> = {
  lindon: '#2a8a8a',
  arnor: '#2c2c30',
  rhovanion: '#7da63a',
  enedwaith: '#7b2d6c',
  rohan: '#2f7d42',
  gondor: '#243a66',
  mordor: '#8e2020',
};

/** Emblem colour drawn on each banner (gold on dark banners, white elsewhere). */
export const REGION_EMBLEM: Record<RegionId, string> = {
  lindon: '#f4f1e6', arnor: '#e0b44a', rhovanion: '#f6e27a', enedwaith: '#f1e6f0',
  rohan: '#f4f1e6', gondor: '#f4f1e6', mordor: '#f2c14a',
};

/** Banners of the promo tiles, which have no region of their own: glyph, banner colour and emblem colour. */
export const PROMO_BANNER: Record<Expansion, { glyph: IconType; color: string; emblem: string }> = {
  shire: { glyph: GiHobbitDwelling, color: '#4f8f3a', emblem: '#f6e9b0' },
  grond: { glyph: GiSiegeRam, color: '#2b2622', emblem: '#e8833a' },
};
