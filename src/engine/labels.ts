import { CARDS, TOKENS } from './data.js';
import type { Color, Race, RegionId, Side, Skill } from './types.js';

export const SIDE_NAMES: Record<Side, string> = { fellowship: 'la Comunitat', sauron: 'Sauron' };
export const SIDE_TITLES: Record<Side, string> = { fellowship: 'Comunitat de l\'Anell', sauron: 'Sauron' };

export const REGION_NAMES: Record<RegionId, string> = {
  lindon: 'Lindon', arnor: 'Arnor', rhovanion: 'Rhovanion', enedwaith: 'Enedwaith',
  rohan: 'Rohan', gondor: 'Gondor', mordor: 'Mordor',
};

export const RACE_NAMES: Record<Race | 'eagle', string> = {
  elves: 'Elfs', dwarves: 'Nans', hobbits: 'Hòbbits', men: 'Homes', ents: 'Ents', wizards: 'Mags', eagle: 'Àguila',
};
export const RACE_ICONS: Record<Race | 'eagle', string> = {
  elves: '🏺', dwarves: '🔨', hobbits: '🪈', men: '📯', ents: '🍁', wizards: '🔮', eagle: '🪶',
};

export const SKILL_NAMES: Record<Skill, string> = {
  mask: 'Astúcia', fist: 'Força', heart: 'Valor', book: 'Saviesa', crown: 'Lideratge',
};
export const SKILL_ICONS: Record<Skill, string> = {
  mask: '🎭', fist: '✊', heart: '❤️', book: '📖', crown: '👑',
};

export const COLOR_NAMES: Record<Color, string> = {
  blue: 'Blava', green: 'Verda', grey: 'Grisa', yellow: 'Groga', red: 'Vermella', purple: 'Lila',
};

export const CHAIN_ICONS: Record<string, string> = {
  fish: '🐟', teapot: '🫖', horse_head: '🐴', horseshoe: '🧲', anvil: '⚒️', harp: '🎼', cooking_pot: '🍲',
  sword: '🗡️', helmet: '⛑️', bow_and_arrow: '🏹', rolled_scroll: '📜', open_scroll: '🗞️', campfire: '🔥',
  acorn: '🌰', treasure_chest: '🧰', armour: '🦺', axe: '🪓',
};
export const CHAIN_NAMES: Record<string, string> = {
  fish: 'Peix', teapot: 'Tetera', horse_head: 'Cap de cavall', horseshoe: 'Ferradura', anvil: 'Enclusa',
  harp: 'Arpa', cooking_pot: 'Olla', sword: 'Espasa', helmet: 'Casc', bow_and_arrow: 'Arc', rolled_scroll: 'Rotlle',
  open_scroll: 'Pergamí', campfire: 'Foguera', acorn: 'Gla', treasure_chest: 'Cofre', armour: 'Armadura', axe: 'Destral',
};

export function cardLabel(cardId: string): string {
  const c = CARDS[cardId];
  const e = c.effect;
  let what = '';
  if (c.color === 'yellow') what = `+${e.coins} monedes`;
  else if (c.color === 'blue') what = `${e.ring} Anell${e.ring > 1 ? 's' : ''}`;
  else if (c.color === 'green') what = RACE_NAMES[e.race!];
  else if (c.color === 'grey') {
    what = e.skillChoice
      ? e.skillChoice.map((s) => SKILL_NAMES[s]).join('/')
      : e.skills.map((s) => SKILL_NAMES[s]).join('+');
  } else if (c.color === 'red') what = `${e.military!.units} ${e.military!.units === 1 ? 'unitat' : 'unitats'}`;
  else if (c.color === 'purple') what = 'acció especial';
  return `carta ${COLOR_NAMES[c.color]} (${what})`;
}

/** "des de Rohan" / "des d'Arnor" (Catalan elision before a vowel). */
export function fromRegion(region: RegionId, prep: 'des de' | 'de' = 'des de'): string {
  const name = REGION_NAMES[region];
  return /^[aeiouàèéíòóú]/i.test(name) ? `${prep.slice(0, -2)}d'${name}`.trimStart() : `${prep} ${name}`;
}

export const TOKEN_TEXT: Record<string, string> = {
  elves_yellow_turn: 'Quan juguis una carta Groga, juga un altre torn.',
  elves_red_any: 'Quan juguis una carta Vermella, pots posar totes les unitats a la regió que vulguis.',
  elves_wild_skill: 'Un cop per torn, disposes de qualsevol habilitat.',
  dwarves_loc_discount: 'Quan construeixis un lloc clau, ignora el cost addicional de monedes.',
  dwarves_loc_turn: 'Quan construeixis un lloc clau, juga un altre torn.',
  dwarves_green_move: 'Quan juguis una carta Verda, fes també 2 moviments.',
  hobbits_eagle: "Símbol de l'Àguila: compta com una raça més per a la victòria per races.",
  hobbits_blue_unit: 'Quan juguis una carta Blava, posa també 1 unitat a qualsevol regió.',
  hobbits_chain_coins: 'Quan juguis una carta gràcies a una cadena, guanya 3 monedes.',
  men_yellow_ring: "Quan juguis una carta Groga, avança també 1 casella a la Missió de l'Anell.",
  men_red_extra: 'Quan juguis una carta Vermella, posa 1 unitat addicional a la regió triada.',
  men_discard_double: 'Quan descartis una carta, guanya el doble de monedes (2, 4 o 6).',
  ents_turn: 'Juga un altre torn quan acabis aquest.',
  ents_remove_fortress: "Retira 1 fortalesa enemiga de qualsevol regió i torna-la a l'oponent.",
  ents_triple: "Tria 3 cops: retirar 1 unitat enemiga, que el rival perdi 1 moneda o fer 1 moviment.",
  wizards_ring: "Avança 2 caselles a la Missió de l'Anell.",
  wizards_units: 'Posa 2 unitats en 1 regió o 1 unitat en 2 regions diferents.',
  wizards_discard_play: 'Mira la pila de descarts, tria 1 carta i juga-la gratis.',
};

export function tokenLabel(tokenId: string): string {
  return `${RACE_NAMES[TOKENS[tokenId].race]}: ${TOKEN_TEXT[tokenId]}`;
}
