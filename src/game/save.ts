import { offlineCapHours } from './config';
import { estimateTowerDps, passiveIncome } from './economy';
import { initialClaimed } from './hex';
import type { CardInstance, OfflineReport, SaveState, TowerSave } from './types';

export const SAVE_KEY = 'belt-z.idle-td.save.v1';
export const SAVE_VERSION = 1;

export const newSave = (): SaveState => {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    playTime: 0,
    resources: { metal: 170, crystal: 0, tech: 0, essence: 0 },
    chapter: 1,
    raidIndex: 0,
    claimed: initialClaimed(),
    towers: {},
    openedChests: [],
    cards: [],
    nextTowerId: 1,
    nextCardId: 1,
    commanders: ['vanguard'],
    activeCommander: 'vanguard',
    skills: {
      orbital: { cooldownEnd: 0 },
      emp: { cooldownEnd: 0 },
      shield: { cooldownEnd: 0 },
    },
    prestige: {
      essence: 0,
      count: 0,
      upgrades: { damage: 0, offline: 0, mining: 0, cooldown: 0, salvage: 0 },
    },
    tutorial: { step: 0, done: false, upgraded: false, usedSkill: false },
    settings: { sound: true, showRanges: true },
    claimTokens: 0,
    stats: {
      kills: 0,
      bosses: 0,
      prestiges: 0,
      metalEarned: 0,
      bestChapter: 1,
      raidsCleared: 0,
    },
  };
};

export const saveToDisk = (save: SaveState) => {
  try {
    save.lastSeen = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* storage may be unavailable in some WebViews */
  }
};

export const clearSave = () => {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
};

export const loadFromDisk = (): SaveState | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveState>;
    if (!data || typeof data !== 'object') return null;
    const base = newSave();
    const save: SaveState = {
      ...base,
      ...data,
      resources: { ...base.resources, ...(data.resources ?? {}) },
      skills: { ...base.skills, ...(data.skills ?? {}) },
      prestige: {
        ...base.prestige,
        ...(data.prestige ?? {}),
        upgrades: { ...base.prestige.upgrades, ...(data.prestige?.upgrades ?? {}) },
      },
      tutorial: { ...base.tutorial, ...(data.tutorial ?? {}) },
      settings: { ...base.settings, ...(data.settings ?? {}) },
      stats: { ...base.stats, ...(data.stats ?? {}) },
      claimed: Array.isArray(data.claimed) && data.claimed.length ? data.claimed : base.claimed,
      openedChests: Array.isArray(data.openedChests) ? data.openedChests : [],
      cards: Array.isArray(data.cards) ? data.cards : [],
      towers: data.towers && typeof data.towers === 'object' ? data.towers : {},
      commanders: Array.isArray(data.commanders) && data.commanders.length ? data.commanders : ['vanguard'],
    };
    delete (save as unknown as { sectors?: unknown }).sectors;
    save.version = SAVE_VERSION;
    if (!save.skills.emp) save.skills.emp = { cooldownEnd: 0 };
    if (!save.skills.shield) save.skills.shield = { cooldownEnd: 0 };
    return save;
  } catch {
    return null;
  }
};

export const computeOfflineReport = (save: SaveState, now = Date.now()): OfflineReport | null => {
  const real = (now - save.lastSeen) / 1000;
  if (real < 120) return null;
  const cap = offlineCapHours(save.prestige.upgrades) * 3600;
  const seconds = Math.min(real, cap);
  const inc = passiveIncome(save);
  const dps = estimateTowerDps(save);
  const efficiency = 0.75;
  const metal = Math.floor((inc.metal + dps * 0.018) * seconds * efficiency);
  const crystal = Math.floor(inc.crystal * seconds * efficiency * 10) / 10;
  const raids = Math.min(40, Math.floor(seconds / 150));

  return {
    seconds,
    cappedSeconds: cap,
    metal,
    crystal,
    raids,
    elapsedReal: real,
  };
};

export const sanitizeSave = (save: SaveState): SaveState => {
  const claimed = new Set(save.claimed);
  claimed.add('0,0');
  save.claimed = [...claimed];
  for (const [key, tower] of Object.entries(save.towers) as [string, TowerSave][]) {
    if (!save.towers[key] || !claimed.has(tower.cell)) delete save.towers[key];
  }
  save.cards = save.cards.filter((c: CardInstance) => c && typeof c.id === 'string');
  return save;
};
