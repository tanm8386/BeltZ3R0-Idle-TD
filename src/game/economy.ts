import {
  COMMANDERS,
  TOWERS,
  computeTower,
  miningMult,
  prestigeDamageMult,
} from './config';
import { WORLD_CELLS, mineYield } from './hex';
import type { SaveState, TowerSystem } from './types';

export const resonanceActive = (save: SaveState) => {
  const set = new Set<TowerSystem>();
  for (const t of Object.values(save.towers)) set.add(TOWERS[t.type].system);
  return set.size >= 4;
};

export const towerCtx = (save: SaveState, ampBuff = 0, rateBuff = 0) => ({
  cards: save.cards,
  commander: save.activeCommander,
  prestigeDamage: prestigeDamageMult(save.prestige.upgrades),
  resonance: resonanceActive(save),
  ampBuff,
  rateBuff,
});

export const passiveIncome = (save: SaveState) => {
  let metal = 0;
  let crystal = 0;
  for (const key of save.claimed) {
    const cell = WORLD_CELLS.get(key);
    if (!cell || cell.kind !== 'mine') continue;
    const y = mineYield(cell.ring);
    metal += y.metal;
    crystal += y.crystal;
  }
  const mult = miningMult(save.prestige.upgrades) * (save.activeCommander === 'engineer' ? 1.2 : 1);
  return { metal: metal * mult, crystal: crystal * mult };
};

export const estimateTowerDps = (save: SaveState) => {
  let dps = 0;
  const ctx = towerCtx(save);
  for (const t of Object.values(save.towers)) {
    dps += computeTower(t, ctx).dps;
  }
  return dps;
};

export const totalTowerLevels = (save: SaveState) =>
  Object.values(save.towers).reduce((s, t) => s + t.level, 0);

export const commanderName = (save: SaveState) => COMMANDERS[save.activeCommander].name;
