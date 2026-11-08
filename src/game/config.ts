import type {
  CardInstance,
  CommanderId,
  EnemyKind,
  Faction,
  PrestigeNodeId,
  Rarity,
  SkillId,
  TowerComputed,
  TowerSave,
  TowerSystem,
  TowerType,
} from './types';

export const COLORS = {
  bg: 0x05080d,
  bg2: 0x081018,
  panel: 0x0a1219,
  line: 0x22313d,
  lineBright: 0x3d5566,
  text: 0xd7e3ea,
  muted: 0x78909c,
  kinetic: 0xff7a3c,
  energy: 0x35e0e8,
  tech: 0xa86bff,
  support: 0xf2d98a,
  danger: 0xff3b30,
  good: 0x7ee787,
  gold: 0xffcf6b,
} as const;

export const SYSTEM_LABEL: Record<TowerSystem, string> = {
  kinetic: 'KINETIC',
  energy: 'ENERGY',
  tech: 'TECH',
  support: 'SUPPORT',
};

export const SYSTEM_HEX: Record<TowerSystem, string> = {
  kinetic: '#ff7a3c',
  energy: '#35e0e8',
  tech: '#a86bff',
  support: '#f2d98a',
};

export interface TowerDef {
  type: TowerType;
  name: string;
  short: string;
  system: TowerSystem;
  unlockChapter: number;
  cost: number;
  range: number;
  damage: number;
  interval: number;
  role: string;
  desc: string;
  projectile: 'rail' | 'flak' | 'beam' | 'plasma' | 'pulse' | 'aura' | 'repair' | 'amp';
  pellets?: number;
  splash?: number;
  slow?: number;
  stun?: number;
  auraRate?: number;
  buff?: number;
  armorPierce?: boolean;
}

export const TOWERS: Record<TowerType, TowerDef> = {
  railgun: {
    type: 'railgun',
    name: 'Railgun Trụ',
    short: 'RAILGUN',
    system: 'kinetic',
    unlockChapter: 1,
    cost: 50,
    range: 100,
    damage: 29,
    interval: 1.15,
    role: 'Sát thương đơn mục tiêu',
    desc: 'Bắn xuyên giáp, cực mạnh với thiên thạch. Tốc bắn chậm.',
    projectile: 'rail',
    armorPierce: true,
  },
  flak: {
    type: 'flak',
    name: 'Pháo Mảnh',
    short: 'PHÁO MẢNH',
    system: 'kinetic',
    unlockChapter: 1,
    cost: 65,
    range: 84,
    damage: 6,
    interval: 0.52,
    role: 'Chụm diện hẹp',
    desc: 'Bắn 3 mảnh đạn mỗi loạt, dọn mảnh vỡ và quái nhỏ rất tốt.',
    projectile: 'flak',
    pellets: 3,
    splash: 12,
  },
  laser: {
    type: 'laser',
    name: 'Laser Liên Tục',
    short: 'LASER',
    system: 'energy',
    unlockChapter: 2,
    cost: 95,
    range: 90,
    damage: 23,
    interval: 0,
    role: 'DPS liên tục',
    desc: 'Chiếu tia liên tục, càng bám lâu càng đau. Hiệu quả với quái máu trâu.',
    projectile: 'beam',
  },
  plasma: {
    type: 'plasma',
    name: 'Plasma Nổ',
    short: 'PLASMA',
    system: 'energy',
    unlockChapter: 2,
    cost: 125,
    range: 96,
    damage: 29,
    interval: 1.9,
    role: 'Nổ diện rộng',
    desc: 'Đạn plasma phát nổ khi trúng, dọn cả cụm quái và mảnh vỡ.',
    projectile: 'plasma',
    splash: 48,
  },
  emp: {
    type: 'emp',
    name: 'Radar EMP',
    short: 'RADAR EMP',
    system: 'tech',
    unlockChapter: 3,
    cost: 100,
    range: 86,
    damage: 5,
    interval: 3.4,
    role: 'Hạ khiên / do thám',
    desc: 'Xung EMP hạ khiên, làm lộ alien tàng hình và gây choáng diện rộng.',
    projectile: 'pulse',
    stun: 1.15,
  },
  hack: {
    type: 'hack',
    name: 'Hack Field',
    short: 'HACK FIELD',
    system: 'tech',
    unlockChapter: 3,
    cost: 85,
    range: 76,
    damage: 3,
    interval: 0,
    role: 'Làm chậm diện rộng',
    desc: 'Vùng nhiễu làm chậm tốc độ di chuyển của địch trong bán kính.',
    projectile: 'aura',
    slow: 0.4,
  },
  repair: {
    type: 'repair',
    name: 'Trạm Tiếp Năng',
    short: 'TIẾP NĂNG',
    system: 'support',
    unlockChapter: 5,
    cost: 95,
    range: 86,
    damage: 0,
    interval: 1,
    role: 'Buff tốc độ bắn',
    desc: 'Tăng tốc độ bắn cho các trụ trong tầm. Không gây sát thương.',
    projectile: 'repair',
    auraRate: 0.12,
  },
  amp: {
    type: 'amp',
    name: 'Tháp Khuếch Đại',
    short: 'KHUẾCH ĐẠI',
    system: 'support',
    unlockChapter: 5,
    cost: 115,
    range: 92,
    damage: 0,
    interval: 0,
    role: 'Buff sát thương',
    desc: 'Tăng sát thương cho mọi trụ trong bán kính. Không tự bắn.',
    projectile: 'amp',
    buff: 0.22,
  },
};

export const TOWER_LIST = Object.values(TOWERS);
export const MAX_TOWER_LEVEL = 10;
export const EVOLVE_LEVEL = 5;

export const towerUpgradeCost = (tower: TowerSave) => {
  const def = TOWERS[tower.type];
  return Math.round(def.cost * 0.72 * Math.pow(1.56, tower.level - 1));
};

export const towerEvolveCost = (tower: TowerSave) => 16 + tower.tier * 14;

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'THƯỜNG',
  rare: 'HIẾM',
  epic: 'SỬ THI',
  legendary: 'HUYỀN THOẠI',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb3bd',
  rare: '#58c9ff',
  epic: '#c084ff',
  legendary: '#ffcf6b',
};

export const RARITY_MULT: Record<Rarity, number> = {
  common: 1,
  rare: 1.8,
  epic: 2.8,
  legendary: 4.2,
};

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface CardDef {
  id: string;
  name: string;
  stat: 'damage' | 'rate' | 'range' | 'stun' | 'splash' | 'slow';
  base: number;
  desc: string;
}

export const CARD_DEFS: Record<string, CardDef> = {
  warhead: {
    id: 'warhead',
    name: 'Đầu Đạn Tăng Lực',
    stat: 'damage',
    base: 0.16,
    desc: '+% sát thương cho trụ được gắn.',
  },
  overclock: {
    id: 'overclock',
    name: 'Mạch Quá Tải',
    stat: 'rate',
    base: 0.1,
    desc: '+% tốc độ bắn cho trụ được gắn.',
  },
  targeting: {
    id: 'targeting',
    name: 'Tiêu Điểm Quang Học',
    stat: 'range',
    base: 0.12,
    desc: '+% tầm bắn cho trụ được gắn.',
  },
  cryo: {
    id: 'cryo',
    name: 'Ngưng Tụ Cryo',
    stat: 'slow',
    base: 0.09,
    desc: 'Mỗi phát trúng làm chậm mục tiêu 1.5 giây.',
  },
  spark: {
    id: 'spark',
    name: 'Xung Điện',
    stat: 'stun',
    base: 0.055,
    desc: '% cơ hội gây choáng ngắn khi bắn trúng.',
  },
  frag: {
    id: 'frag',
    name: 'Mảnh Nổ',
    stat: 'splash',
    base: 9,
    desc: 'Thêm bán kính nổ cho đạn của trụ.',
  },
};

export const cardValue = (def: CardDef, rarity: Rarity) => def.base * RARITY_MULT[rarity];

export const COMMANDERS: Record<
  CommanderId,
  { name: string; title: string; aura: string; unlock: string; color: string }
> = {
  vanguard: {
    name: 'Chỉ Huy Vành Đai',
    title: 'SĨ QUAN TUYẾN ĐẦU',
    aura: '+8% tốc độ bắn toàn bộ trụ.',
    unlock: 'Có sẵn',
    color: '#ff7a3c',
  },
  engineer: {
    name: 'Kỹ Sư Trưởng',
    title: 'GIÁM ĐỐC KHAI THÁC',
    aura: '+20% sản lượng mỏ khoáng.',
    unlock: 'Hoàn thành Vòng 4',
    color: '#f2d98a',
  },
  warden: {
    name: 'Giám Sát Viên',
    title: 'NGƯỜI GIỮ VÀNH ĐAI',
    aura: '+10% tầm bắn và +5% sát thương toàn bộ trụ.',
    unlock: 'Prestige lần đầu',
    color: '#35e0e8',
  },
};

export const SKILLS: Record<
  SkillId,
  { name: string; short: string; desc: string; cooldown: number; unlock: number; color: string }
> = {
  orbital: {
    name: 'Oanh Kích Quỹ Đạo',
    short: 'ORBITAL',
    desc: 'Chạm bản đồ để gọi một cú oanh kích. Sát thương lớn diện rộng.',
    cooldown: 45,
    unlock: 1,
    color: '#ff7a3c',
  },
  emp: {
    name: 'EMP Toàn Vành Đai',
    short: 'EMP',
    desc: 'Choáng toàn bộ địch 2.5 giây, xóa khiên và làm lộ tàng hình.',
    cooldown: 65,
    unlock: 3,
    color: '#a86bff',
  },
  shield: {
    name: 'Khiên Khẩn Cấp',
    short: 'SHIELD',
    desc: 'Chặn toàn bộ quái lọt trong 8 giây.',
    cooldown: 90,
    unlock: 5,
    color: '#35e0e8',
  },
};

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  faction: Faction;
  hp: number;
  speed: number;
  armor: number;
  shield: number;
  size: number;
  reward: number;
  crystal: number;
  leak: number;
  regen: number;
  spawner?: EnemyKind;
  boss?: boolean;
  desc: string;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  asteroid: {
    kind: 'asteroid',
    name: 'Thiên thạch thường',
    faction: 'asteroid',
    hp: 28,
    speed: 27,
    armor: 4,
    shield: 0,
    size: 18,
    reward: 3,
    crystal: 0,
    leak: 9,
    regen: 0,
    desc: 'Giáp dày, đi thẳng, không né.',
  },
  splitter: {
    kind: 'splitter',
    name: 'Thiên thạch vỡ',
    faction: 'asteroid',
    hp: 36,
    speed: 24,
    armor: 2,
    shield: 0,
    size: 20,
    reward: 4,
    crystal: 0,
    leak: 10,
    regen: 0,
    desc: 'Vỡ thành 2 mảnh nhỏ khi bị hạ.',
  },
  shard: {
    kind: 'shard',
    name: 'Mảnh thiên thạch',
    faction: 'asteroid',
    hp: 10,
    speed: 44,
    armor: 0,
    shield: 0,
    size: 9,
    reward: 1,
    crystal: 0,
    leak: 4,
    regen: 0,
    desc: 'Mảnh vỡ nhanh nhẹn, vẫn gây sát thương nếu lọt.',
  },
  scout: {
    kind: 'scout',
    name: 'Alien Trinh sát',
    faction: 'alien',
    hp: 24,
    speed: 39,
    armor: 0,
    shield: 14,
    size: 14,
    reward: 5,
    crystal: 0.15,
    leak: 8,
    regen: 0,
    desc: 'Tàng hình theo chu kỳ, chỉ lộ khi bị Radar EMP quét.',
  },
  ship: {
    kind: 'ship',
    name: 'Alien Chiến hạm',
    faction: 'alien',
    hp: 48,
    speed: 19,
    armor: 3,
    shield: 40,
    size: 21,
    reward: 9,
    crystal: 0.35,
    leak: 14,
    regen: 0.04,
    desc: 'Khiên năng lượng tái tạo, phải hạ khiên trước khi vào máu.',
  },
  spider: {
    kind: 'spider',
    name: 'Nhện Không gian',
    faction: 'monster',
    hp: 12,
    speed: 48,
    armor: 0,
    shield: 0,
    size: 10,
    reward: 2,
    crystal: 0,
    leak: 4,
    regen: 0,
    desc: 'Rất đông, nhanh, máu thấp.',
  },
  tentacle: {
    kind: 'tentacle',
    name: 'Quái Vòi',
    faction: 'monster',
    hp: 92,
    speed: 14,
    armor: 5,
    shield: 0,
    size: 26,
    reward: 12,
    crystal: 0.5,
    leak: 16,
    regen: 0.018,
    spawner: 'spider',
    desc: 'Máu trâu, tự hồi máu, đẻ thêm nhện nhỏ.',
  },
  'boss-asteroid': {
    kind: 'boss-asteroid',
    name: 'THẠCH VƯƠNG',
    faction: 'asteroid',
    hp: 520,
    speed: 10,
    armor: 12,
    shield: 0,
    size: 42,
    reward: 90,
    crystal: 14,
    leak: 45,
    regen: 0,
    boss: true,
    desc: 'Lõi thiên thạch khổng lồ. Giáp cực dày, đi chậm.',
  },
  'boss-alien': {
    kind: 'boss-alien',
    name: 'HẠM TRƯỞNG VÔ DANH',
    faction: 'alien',
    hp: 440,
    speed: 12,
    armor: 5,
    shield: 260,
    size: 44,
    reward: 100,
    crystal: 16,
    leak: 45,
    regen: 0.02,
    boss: true,
    desc: 'Khiên nhiều lớp, đổi pha khi khiên vỡ.',
  },
  'boss-monster': {
    kind: 'boss-monster',
    name: 'QUÁI VƯƠNG VÀNH ĐAI',
    faction: 'monster',
    hp: 820,
    speed: 8,
    armor: 6,
    shield: 0,
    size: 50,
    reward: 110,
    crystal: 18,
    leak: 50,
    regen: 0.025,
    spawner: 'spider',
    boss: true,
    desc: 'Hồi máu liên tục, sinh quái nhỏ, điên cuồng khi máu thấp.',
  },
};

export const FACTION_LABEL: Record<Faction, string> = {
  asteroid: 'THIÊN THẠCH',
  alien: 'ALIEN',
  monster: 'QUÁI VẬT',
};

export const FACTION_COLOR: Record<Faction, string> = {
  asteroid: '#d59a66',
  alien: '#a98bff',
  monster: '#8bd47a',
};

export interface ChapterDef {
  id: number;
  name: string;
  tag: string;
  phase: string;
  accent: string;
  unlock: string;
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    name: 'Quỹ đạo gần',
    tag: 'THIÊN THẠCH RẢI RÁC',
    phase: 'CẢNH BÁO ĐẦU TIÊN',
    accent: '#d59a66',
    unlock: 'Trụ Kinetic cơ bản',
  },
  {
    id: 2,
    name: 'Vành đai dày',
    tag: 'MƯA THIÊN THẠCH',
    phase: 'VÙNG NHIỄM XẠ',
    accent: '#e6a35e',
    unlock: 'Trụ Energy, thiên thạch vỡ',
  },
  {
    id: 3,
    name: 'Cổng Alien',
    tag: 'TÍN HIỆU LẠ',
    phase: 'LIÊN LẠC NGOÀI HÀNH TINH',
    accent: '#a98bff',
    unlock: 'Trụ Tech, kỹ năng EMP',
  },
  {
    id: 4,
    name: 'Lãnh thổ Alien',
    tag: 'HẠM ĐỘI PHẢN CÔNG',
    phase: 'CHIẾN TUYẾN MỞ',
    accent: '#b36bff',
    unlock: 'Chỉ huy thứ hai',
  },
  {
    id: 5,
    name: 'Vết nứt không gian',
    tag: 'QUÁI VẬT TRÀN RA',
    phase: 'VẾT NỨT MỞ RỘNG',
    accent: '#8bd47a',
    unlock: 'Trụ Support, Tier/Evolve, Khiên',
  },
  {
    id: 6,
    name: 'Hỗn loạn Vành Đai',
    tag: 'CẢ BA PHE TRỘN LẪN',
    phase: 'TUYẾN CUỐI',
    accent: '#ff7a3c',
    unlock: 'Boss liên hoàn, nội dung mở rộng',
  },
];

export const RAID_PER_CHAPTER = 6;
export const FIRST_RAID_PREP_SECONDS = 12;
export const RAID_PREP_SECONDS = 15;
export const RAID_BOSS_PREP_SECONDS = 22;

export const chapterDef = (chapter: number): ChapterDef =>
  chapter <= CHAPTERS.length
    ? CHAPTERS[chapter - 1]
    : {
        id: chapter,
        name: 'Vành Đai Vô Tận',
        tag: 'HỖN LOẠN VĨNH CỬU',
        phase: `CHU KỲ ${chapter}`,
        accent: '#ff5a6e',
        unlock: 'Scale vô hạn',
      };

export type RaidKind = 'normal' | 'elite' | 'boss';
export const raidKindFor = (raidIndex: number): RaidKind =>
  raidIndex >= RAID_PER_CHAPTER - 1 ? 'boss' : raidIndex === RAID_PER_CHAPTER - 2 ? 'elite' : 'normal';

export const skillUnlocked = (skill: SkillId, chapter: number) => chapter >= SKILLS[skill].unlock;

export const commanderUnlocked = (id: CommanderId, chapter: number, prestigeCount: number) => {
  if (id === 'vanguard') return true;
  if (id === 'engineer') return chapter >= 4;
  return prestigeCount >= 1;
};

export const sectorCountFor = (chapter: number) => (chapter >= 5 ? 8 : chapter >= 3 ? 7 : 6);

export const PRESTIGE_NODES: Record<
  PrestigeNodeId,
  { name: string; desc: string; max: number; baseCost: number; step: number }
> = {
  damage: {
    name: 'Vỏ Giáp Tăng Cường',
    desc: '+8% sát thương toàn bộ trụ mỗi cấp.',
    max: 10,
    baseCost: 4,
    step: 4,
  },
  offline: {
    name: 'Kho Dự Trữ Vành Đai',
    desc: '+1 giờ trần tích lũy offline mỗi cấp.',
    max: 6,
    baseCost: 6,
    step: 5,
  },
  mining: {
    name: 'Mạng Lưới Thu Hoạch',
    desc: '+15% sản lượng mỏ khoáng mỗi cấp.',
    max: 8,
    baseCost: 4,
    step: 4,
  },
  cooldown: {
    name: 'Giao Thức Oanh Kích',
    desc: '-6% hồi chiêu kỹ năng chủ động mỗi cấp.',
    max: 6,
    baseCost: 5,
    step: 5,
  },
  salvage: {
    name: 'Hậu Cần Tiền Phương',
    desc: '+25% tài nguyên khởi đầu sau Prestige mỗi cấp.',
    max: 5,
    baseCost: 3,
    step: 3,
  },
};

export const prestigeNodeCost = (id: PrestigeNodeId, level: number) => {
  const n = PRESTIGE_NODES[id];
  return n.baseCost + n.step * level;
};

export const prestigeGain = (chapter: number, raidIndex: number, claimed: number, towerLevels: number, count: number) =>
  Math.floor((chapter - 1) * 4 + raidIndex * 0.5 + claimed * 0.15 + towerLevels * 0.3 + count * 2);

export const offlineCapHours = (upgrades: Record<PrestigeNodeId, number>) => 6 + upgrades.offline;
export const prestigeDamageMult = (upgrades: Record<PrestigeNodeId, number>) => 1 + upgrades.damage * 0.08;
export const miningMult = (upgrades: Record<PrestigeNodeId, number>) => 1 + upgrades.mining * 0.15;
export const cooldownMult = (upgrades: Record<PrestigeNodeId, number>) => 1 - upgrades.cooldown * 0.06;
export const salvageMult = (upgrades: Record<PrestigeNodeId, number>) => 1 + upgrades.salvage * 0.25;

const RARITY_MULT_CARD = RARITY_MULT;

export interface ComputeCtx {
  cards: CardInstance[];
  commander: CommanderId;
  prestigeDamage: number;
  resonance: boolean;
  ampBuff?: number;
  rateBuff?: number;
}

export const computeTower = (tower: TowerSave, ctx: ComputeCtx): TowerComputed => {
  const def = TOWERS[tower.type];
  const lvl = tower.level;
  const tierMul = tower.tier > 0 ? 1.62 : 1;
  const levelDamage = 1 + 0.24 * (lvl - 1);
  const levelRate = 1 + 0.05 * (lvl - 1);

  let damage = def.damage * levelDamage * tierMul;
  let rate = levelRate * (tower.tier > 0 ? 1.12 : 1);
  let range = def.range + 3 * (lvl - 1) + (tower.tier > 0 ? 12 : 0);
  let splash = def.splash ?? 0;
  let slow = def.slow ?? 0;
  let stunChance = 0;
  let auraRate = def.auraRate ?? 0;
  let buff = def.buff ?? 0;

  if (ctx.commander === 'vanguard') rate *= 1.08;
  if (ctx.commander === 'warden') {
    range *= 1.1;
    damage *= 1.05;
  }
  if (ctx.resonance) {
    damage *= 1.05;
    rate *= 1.05;
  }
  if (ctx.ampBuff) damage *= 1 + ctx.ampBuff;
  if (ctx.rateBuff) rate *= 1 + ctx.rateBuff;

  const byId = new Map(ctx.cards.map((c) => [c.id, c]));
  for (const cardId of tower.cards) {
    const card = byId.get(cardId);
    if (!card) continue;
    const cdef = CARD_DEFS[card.defId];
    if (!cdef) continue;
    const v = cardValue(cdef, card.rarity);
    if (cdef.stat === 'damage') damage *= 1 + v;
    if (cdef.stat === 'rate') rate *= 1 + v;
    if (cdef.stat === 'range') range *= 1 + v;
    if (cdef.stat === 'splash') splash += v;
    if (cdef.stat === 'slow') slow = Math.max(slow, v);
    if (cdef.stat === 'stun') stunChance += v;
  }

  damage *= ctx.prestigeDamage;
  auraRate = auraRate * (1 + 0.18 * (lvl - 1)) * (tower.tier > 0 ? 1.4 : 1);
  buff = buff * (1 + 0.12 * (lvl - 1)) * (tower.tier > 0 ? 1.3 : 1);

  let dps = 0;
  if (def.projectile === 'rail' || def.projectile === 'plasma') dps = damage / def.interval;
  else if (def.projectile === 'flak') dps = (damage * (def.pellets ?? 1)) / def.interval;
  else if (def.projectile === 'beam') dps = damage;
  else if (def.projectile === 'pulse') dps = damage / def.interval;
  else if (def.projectile === 'aura') dps = damage;

  return {
    damage,
    interval: def.interval > 0 ? def.interval / rate : 0,
    range,
    dps,
    auraRate,
    buff,
    slow: Math.min(0.7, slow),
    stun: stunChance,
    splash,
    cardSlots: 1 + (tower.tier > 0 ? 1 : 0),
  };
};

export const raidNormalCount = (chapter: number, raidIndex: number, claimed: number) => {
  if (chapter === 1 && raidIndex === 0) return 3;
  if (chapter === 1 && raidIndex === 1) return 6;
  const boss = raidKindFor(raidIndex) === 'boss';
  const base = boss ? 6 + chapter * 2 : 8 + chapter * 3 + raidIndex * 2;
  return Math.min(52, base + Math.floor(Math.max(0, claimed - 7) * 0.1));
};

export const raidSpawnGap = (chapter: number, raidIndex: number) =>
  Math.max(0.55, 1.55 - chapter * 0.06 - raidIndex * 0.03);

export const enemyScale = (chapter: number, raidIndex: number, claimed: number) => {
  const chapterMul = Math.pow(1.42, chapter - 1);
  const raidMul = 1 + raidIndex * 0.055;
  const territoryMul = 1 + Math.max(0, claimed - 7) * 0.011;
  return {
    hp: chapterMul * raidMul * territoryMul,
    dmg: 1 + 0.28 * (chapter - 1) + raidIndex * 0.02,
    speed: 1 + 0.015 * (chapter - 1),
    reward: 1 + 0.55 * (chapter - 1),
  };
};

const POOLS: Record<number, [EnemyKind, number][]> = {
  1: [['asteroid', 100]],
  2: [
    ['asteroid', 58],
    ['splitter', 42],
  ],
  3: [
    ['asteroid', 30],
    ['splitter', 16],
    ['scout', 28],
    ['ship', 26],
  ],
  4: [
    ['asteroid', 12],
    ['splitter', 10],
    ['scout', 33],
    ['ship', 45],
  ],
  5: [
    ['asteroid', 15],
    ['splitter', 10],
    ['scout', 20],
    ['ship', 24],
    ['spider', 21],
    ['tentacle', 10],
  ],
  6: [
    ['asteroid', 15],
    ['splitter', 10],
    ['scout', 20],
    ['ship', 18],
    ['spider', 22],
    ['tentacle', 15],
  ],
};

export const pickEnemyKind = (chapter: number, rand: number): EnemyKind => {
  const pool = POOLS[Math.min(6, Math.max(1, chapter))];
  const total = pool.reduce((s, p) => s + p[1], 0);
  let v = rand * total;
  for (const [kind, w] of pool) {
    v -= w;
    if (v <= 0) return kind;
  }
  return pool[pool.length - 1][0];
};

export const bossKindFor = (chapter: number): EnemyKind => {
  const idx = (chapter - 1) % 3;
  return idx === 0 ? 'boss-asteroid' : idx === 1 ? 'boss-alien' : 'boss-monster';
};

export const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(n >= 100_000 ? 0 : 1) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  if (n < 10 && n % 1 !== 0) return n.toFixed(1);
  return Math.floor(n).toString();
};

export const fmtRate = (n: number): string => (n < 10 ? n.toFixed(1) : fmt(n)) + '/s';

export const timeFmt = (s: number): string => {
  const v = Math.max(0, Math.ceil(s));
  if (v < 60) return `${v}s`;
  const m = Math.floor(v / 60);
  const ss = v % 60;
  if (m < 60) return `${m}:${ss.toString().padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  return `${h}g ${m % 60}p`;
};
