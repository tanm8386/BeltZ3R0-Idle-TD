import { create } from 'zustand';
import { chapterDef } from './config';
import { newSave } from './save';
import type { HudSnapshot, OfflineReport, SaveState, SkillId, Toast } from './types';

export type ModalKind =
  | 'none'
  | 'cards'
  | 'prestige'
  | 'settings'
  | 'offline'
  | 'chest'
  | 'commander'
  | 'codex'
  | 'help'
  | 'dev';

export interface ChestReward {
  cell: string;
  metal: number;
  crystal: number;
  cards: { name: string; rarity: string; desc: string }[];
}

const initialChapter = chapterDef(1);

export const emptyHud = (): HudSnapshot => ({
  resources: { metal: 0, crystal: 0, tech: 0, essence: 0 },
  income: { metal: 0, crystal: 0 },
  chapter: 1,
  chapterName: initialChapter.name,
  chapterTag: initialChapter.tag,
  raidIndex: 0,
  raidTotal: 6,
  raidKind: 'normal',
  raidPhase: 'prep',
  phaseTimer: 0,
  enemiesAlive: 0,
  spawnLeft: 0,
  boss: null,
  claimTokens: 0,
  towerCount: 0,
  resonance: false,
  activeCommander: 'vanguard',
  skills: {
    orbital: { ready: true, remain: 0, total: 45 },
    emp: { ready: false, remain: 0, total: 65 },
    shield: { ready: false, remain: 0, total: 90 },
  },
  paused: false,
  fps: 60,
  killed: 0,
  cards: 0,
  trophy: 0,
});

interface UIStore {
  hud: HudSnapshot;
  save: SaveState;
  rev: number;
  modal: ModalKind;
  chest: ChestReward | null;
  offline: OfflineReport | null;
  selection: string | null;
  buildType: string | null;
  aiming: SkillId | null;
  cardsTarget: string | null;
  toasts: Toast[];
  tutorialPulse: number;
  setSnapshot: (hud: HudSnapshot, save: SaveState) => void;  openModal: (modal: ModalKind) => void;
  openCards: (towerId?: string | null) => void;
  closeModal: () => void;
  setSelection: (cell: string | null) => void;
  setBuildType: (type: string | null) => void;
  setAiming: (skill: SkillId | null) => void;
  setChest: (chest: ChestReward | null) => void;
  setOffline: (report: OfflineReport | null) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  removeToast: (id: number) => void;
  pulseTutorial: () => void;
}

let toastId = 1;

export const useUI = create<UIStore>((set, get) => ({
  hud: emptyHud(),
  save: newSave(),
  rev: 0,
  modal: 'none',
  chest: null,
  offline: null,
  selection: null,
  buildType: null,
  aiming: null,
  cardsTarget: null,
  toasts: [],
  tutorialPulse: 0,
  setSnapshot: (hud, save) => set((s) => ({ hud, save, rev: s.rev + 1 })),
  openModal: (modal) => set({ modal, selection: null, aiming: null }),
  openCards: (towerId = null) => set({ modal: 'cards', cardsTarget: towerId, selection: null, aiming: null }),
  closeModal: () => set({ modal: 'none', chest: null, cardsTarget: null }),
  setSelection: (cell) => set({ selection: cell, buildType: null }),
  setBuildType: (type) => set({ buildType: type }),
  setAiming: (skill) => set({ aiming: skill, selection: null }),
  setChest: (chest) => set({ chest }),
  setOffline: (offline) => set({ offline }),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, text, tone, t: Date.now() }] }));
    window.setTimeout(() => get().removeToast(id), tone === 'bad' ? 5200 : 3800);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  pulseTutorial: () => set((s) => ({ tutorialPulse: s.tutorialPulse + 1 })),
}));

