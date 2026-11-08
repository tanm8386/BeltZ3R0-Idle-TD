export type TowerSystem = 'kinetic' | 'energy' | 'tech' | 'support';
export type TowerType = 'railgun' | 'flak' | 'laser' | 'plasma' | 'emp' | 'hack' | 'repair' | 'amp';
export type Faction = 'asteroid' | 'alien' | 'monster';
export type EnemyKind =
  | 'asteroid'
  | 'splitter'
  | 'shard'
  | 'scout'
  | 'ship'
  | 'spider'
  | 'tentacle'
  | 'boss-asteroid'
  | 'boss-alien'
  | 'boss-monster';

export type CellKind = 'hq' | 'slot' | 'mine' | 'chest' | 'empty';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type SkillId = 'orbital' | 'emp' | 'shield';
export type CommanderId = 'vanguard' | 'engineer' | 'warden';
export type PrestigeNodeId = 'damage' | 'offline' | 'mining' | 'cooldown' | 'salvage';

export interface Resources {
  metal: number;
  crystal: number;
  tech: number;
  essence: number;
}

export interface CellDef {
  key: string;
  q: number;
  r: number;
  ring: number;
  angle: number;
  x: number;
  y: number;
  kind: CellKind;
  sector: number;
}

export interface TowerSave {
  id: string;
  type: TowerType;
  cell: string;
  level: number;
  tier: number;
  cards: string[];
}

export interface CardInstance {
  id: string;
  defId: string;
  rarity: Rarity;
}

export interface SkillState {
  cooldownEnd: number;
}

export interface PrestigeState {
  essence: number;
  count: number;
  upgrades: Record<PrestigeNodeId, number>;
}

export interface TutorialState {
  step: number;
  done: boolean;
  upgraded: boolean;
  usedSkill: boolean;
}

export interface Settings {
  sound: boolean;
  showRanges: boolean;
}

export interface SaveState {
  version: number;
  createdAt: number;
  lastSeen: number;
  playTime: number;
  resources: Resources;
  chapter: number;
  raidIndex: number;
  claimed: string[];
  towers: Record<string, TowerSave>;
  openedChests: string[];
  cards: CardInstance[];
  nextTowerId: number;
  nextCardId: number;
  commanders: CommanderId[];
  activeCommander: CommanderId;
  skills: Record<SkillId, SkillState>;
  prestige: PrestigeState;
  tutorial: TutorialState;
  settings: Settings;
  claimTokens: number;
  stats: {
    kills: number;
    bosses: number;
    prestiges: number;
    metalEarned: number;
    bestChapter: number;
    raidsCleared: number;
  };
}

export interface OfflineReport {
  seconds: number;
  cappedSeconds: number;
  metal: number;
  crystal: number;
  raids: number;
  elapsedReal: number;
}

export interface TowerComputed {
  damage: number;
  interval: number;
  range: number;
  dps: number;
  auraRate: number;
  buff: number;
  slow: number;
  stun: number;
  splash: number;
  cardSlots: number;
}

export interface HudSnapshot {
  resources: Resources;
  income: { metal: number; crystal: number };
  chapter: number;
  chapterName: string;
  chapterTag: string;
  raidIndex: number;
  raidTotal: number;
  raidKind: 'normal' | 'elite' | 'boss';
  raidPhase: 'prep' | 'spawning' | 'clearing' | 'boss' | 'won';
  phaseTimer: number;
  enemiesAlive: number;
  spawnLeft: number;
  boss: { name: string; hp: number; max: number; phase: number } | null;
  claimTokens: number;
  towerCount: number;
  resonance: boolean;
  activeCommander: CommanderId;
  skills: Record<SkillId, { ready: boolean; remain: number; total: number }>;
  paused: boolean;
  fps: number;
  killed: number;
  cards: number;
  trophy: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'warn' | 'bad';
  t: number;
}
