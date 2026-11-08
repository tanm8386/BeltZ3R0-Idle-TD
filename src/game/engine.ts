import { Application, Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import {
  CARD_DEFS,
  CHAPTERS,
  COLORS,
  COMMANDERS,
  ENEMIES,
  EVOLVE_LEVEL,
  FIRST_RAID_PREP_SECONDS,
  MAX_TOWER_LEVEL,
  PRESTIGE_NODES,
  RAID_BOSS_PREP_SECONDS,
  RAID_PER_CHAPTER,
  RAID_PREP_SECONDS,
  RARITY_LABEL,
  RARITY_ORDER,
  SKILLS,
  TOWERS,
  TOWER_LIST,
  bossKindFor,
  chapterDef,
  commanderUnlocked,
  computeTower,
  cooldownMult,
  enemyScale,
  fmt,
  pickEnemyKind,
  prestigeDamageMult,
  prestigeGain,
  prestigeNodeCost,
  raidKindFor,
  raidNormalCount,
  raidSpawnGap,
  salvageMult,
  sectorCountFor,
  skillUnlocked,
  towerEvolveCost,
  towerUpgradeCost,
} from './config';
import {
  estimateTowerDps,
  passiveIncome,
  resonanceActive,
  towerCtx,
  totalTowerLevels,
} from './economy';
import {
  DIRS,
  HEX_SIZE,
  MAX_RING,
  WORLD_CELLS,
  assignSectors,
  claimableCells,
  hexPoints,
  keyOf,
  neighbors,
  ringOf,
  ringRadius,
} from './hex';
import { clearSave, computeOfflineReport, loadFromDisk, newSave, sanitizeSave, saveToDisk } from './save';
import { TOWER_ACCENT, cellIcons, enemySprites, makeEarth, starTex, towerSprites } from './sprites';
import { useUI } from './store';
import type {
  CardInstance,
  CellDef,
  CommanderId,
  EnemyKind,
  Faction,
  HudSnapshot,
  OfflineReport,
  PrestigeNodeId,
  Rarity,
  SaveState,
  SkillId,
  Toast,
  TowerComputed,
  TowerSave,
  TowerSystem,
  TowerType,
} from './types';
import { PAL, VfxLayer } from './vfx';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MIN_CAM_SCALE = 0.4;
const MAX_CAM_SCALE = 1.85;
const ZOOM_STEP = 1.22;
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

interface Enemy {
  id: number;
  kind: EnemyKind;
  faction: Faction;
  name: string;
  boss: boolean;
  elite: boolean;
  sector: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  armor: number;
  speed: number;
  speedMul: number;
  size: number;
  reward: number;
  crystal: number;
  leak: number;
  regen: number;
  spawner: EnemyKind | null;
  spawnerTimer: number;
  spin: number;
  age: number;
  phase: number;
  stunUntil: number;
  slowUntil: number;
  slowFactor: number;
  revealedUntil: number;
  lastDamageAt: number;
  hitFlash: number;
  dead: boolean;
  targetId: number;
}

interface EnemyView {
  container: Container;
  sprite: Sprite;
}

interface TowerView {
  container: Container;
  base: Sprite;
  turret: Sprite;
  ring: Graphics;
  angle: number;
  pop: number;
  recoil: number;
}

interface TowerRuntime {
  cooldown: number;
  targetId: number;
  angle: number;
  beam: boolean;
  proc: number;
  pulse: number;
  heal: number;
  recoil: number;
}

interface Projectile {
  kind: 'flak' | 'plasma';
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  targetId: number;
  damage: number;
  splash: number;
  armorPierce: boolean;
  system: TowerSystem;
  towerId: string;
  color: number;
}

interface TracerFx {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  max: number;
  color: number;
  width: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  size: number;
}

interface RingFx {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: number;
  width: number;
}

interface Scheduled {
  at: number;
  run: () => void;
}

interface SpawnEntry {
  kind: EnemyKind;
  elite: boolean;
}

const FACTION_PAL: Record<Faction, string[]> = {
  asteroid: PAL.kinetic,
  alien: PAL.alien,
  monster: PAL.monster,
};

export class BeltGame {
  app!: Application;
  private host: HTMLElement;
  save: SaveState;
  private offlineReport: OfflineReport | null = null;
  private offlinePending = false;

  private w = 390;
  private h = 844;
  private vfx!: VfxLayer;

  private world = new Container();
  private bgGfx = new Graphics();
  private stars!: TilingSprite;
  private gridGfx = new Graphics();
  private claimGfx = new Graphics();
  private rangeGfx = new Graphics();
  private selectGfx = new Graphics();
  private aimGfx = new Graphics();
  private combatGfx = new Graphics();
  private iconLayer = new Container();
  private towerLayer = new Container();
  private enemyLayer = new Container();
  private flashGfx = new Graphics();
  private earth!: Sprite;
  private earthGlow = new Graphics();
  private hq!: Sprite;

  private enemies: Enemy[] = [];
  private enemyViews = new Map<number, EnemyView>();
  private projectiles: Projectile[] = [];
  private tracers: TracerFx[] = [];
  private sparks: Spark[] = [];
  private rings: RingFx[] = [];
  private scheduled: Scheduled[] = [];
  private towerViews = new Map<string, TowerView>();
  private towerRuntime = new Map<string, TowerRuntime>();
  private towerByCell = new Map<string, string>();
  private iconSprites: Sprite[] = [];
  private claimable = new Set<string>();

  private time = 0;
  private nextEnemyId = 1;
  private raidPhase: 'prep' | 'spawning' | 'clearing' | 'boss' = 'prep';
  private phaseTimer = FIRST_RAID_PREP_SECONDS;
  private spawnTimer = 0;
  private spawnGap = 1;
  private spawnQueue: SpawnEntry[] = [];
  private raidIndex = 0;
  private raidTotal = 0;
  private raidKills = 0;
  private raidSpawned = 0;
  private bossSpawned = false;
  private bossDefeated = false;
  private finishing = false;
  private shieldUntil = 0;
  private leakWarnAt = -99;

  private maxRing = 1;
  private camScale = 1;
  private camX = 0;
  private camY = 0;
  private camTargetX = 0;
  private camTargetY = 0;
  private camReturning = true;
  private cameraReady = false;
  private drag: { id: number; sx: number; sy: number; camX: number; camY: number; moved: boolean } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: {
    dist: number;
    scale: number;
    camX: number;
    camY: number;
    midX: number;
    midY: number;
  } | null = null;
  private suppressTap = false;
  private syncTimer = 0;
  private saveTimer = 0;
  private uiTimer = 0;
  private shake = 0;
  private flashAlpha = 0;
  private flashColor = 0xffffff;
  private aimPos = { x: 0, y: 0 };
  private fps = 60;

  private boundTick = (ticker: { deltaMS: number }) => this.tick(ticker);
  private boundResize = () => this.resize();
  private boundKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      useUI.getState().setSelection(null);
      useUI.getState().setAiming(null);
    }
  };

  private constructor(host: HTMLElement) {
    this.host = host;
    this.save = sanitizeSave(loadFromDisk() ?? newSave());
  }

  static async create(host: HTMLElement): Promise<BeltGame> {
    const game = new BeltGame(host);
    await game.init();
    return game;
  }

  private async init() {
    this.save = sanitizeSave(this.save);
    this.raidIndex = this.save.raidIndex;
    this.offlineReport = computeOfflineReport(this.save);
    this.offlinePending = !!this.offlineReport;
    this.ensureUnlocks();
    assignSectors(WORLD_CELLS, new Set(this.save.claimed), sectorCountFor(this.save.chapter));

    this.w = this.host.clientWidth || 390;
    this.h = this.host.clientHeight || 844;
    this.app = new Application();
    await this.app.init({
      width: this.w,
      height: this.h,
      background: COLORS.bg,
      antialias: false,
      resolution: 1,
      autoDensity: false,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    this.app.canvas.className = 'game-canvas';
    this.host.appendChild(this.app.canvas);
    this.vfx = new VfxLayer(this.w, this.h);

    this.buildStage();
    this.buildMapSprites();
    this.buildTowers();
    this.rebuildMap();
    this.resize();

    this.app.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.app.canvas.addEventListener('pointermove', this.onPointerMove);
    this.app.canvas.addEventListener('pointerup', this.onPointerUp);
    this.app.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.app.ticker.add(this.boundTick);
    window.addEventListener('resize', this.boundResize);
    window.addEventListener('keydown', this.boundKey);
    window.addEventListener('beforeunload', this.onUnload);
    document.addEventListener('visibilitychange', this.onVisibility);
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(this.boundResize);
      ro.observe(this.host);
    }

    this.phaseTimer = FIRST_RAID_PREP_SECONDS;
    this.raidPhase = 'prep';

    if (this.offlineReport) {
      useUI.getState().setOffline(this.offlineReport);
      useUI.getState().openModal('offline');
    } else {
      this.save.lastSeen = Date.now();
      this.persist();
    }
    this.sync();
  }

  private ensureUnlocks() {
    if (this.save.chapter >= 4 && !this.save.commanders.includes('engineer')) this.save.commanders.push('engineer');
    if (this.save.prestige.count >= 1 && !this.save.commanders.includes('warden')) this.save.commanders.push('warden');
    if (!this.save.commanders.includes(this.save.activeCommander)) this.save.activeCommander = 'vanguard';
  }

  private buildStage() {
    const stage = this.app.stage;
    stage.addChild(this.bgGfx);
    this.stars = new TilingSprite({ texture: starTex, width: this.w, height: this.h });
    this.stars.alpha = 0.85;
    stage.addChild(this.stars);
    stage.addChild(this.world);
    stage.addChild(this.vfx.sprite);
    stage.addChild(this.flashGfx);
    this.flashGfx.alpha = 0;

    this.world.addChild(this.earthGlow);
    this.earth = new Sprite(makeEarth());
    this.earth.anchor.set(0.5);
    this.earth.scale.set(1);
    this.world.addChild(this.earth);
    this.world.addChild(this.gridGfx);
    this.world.addChild(this.claimGfx);
    this.world.addChild(this.rangeGfx);
    this.world.addChild(this.iconLayer);
    this.hq = new Sprite(cellIcons.hq);
    this.hq.anchor.set(0.5);
    this.world.addChild(this.hq);
    this.world.addChild(this.towerLayer);
    this.world.addChild(this.selectGfx);
    this.world.addChild(this.enemyLayer);
    this.world.addChild(this.combatGfx);
    this.world.addChild(this.aimGfx);

    this.world.position.set(this.w / 2, this.h * 0.45);
  }

  private buildMapSprites() {
    this.earthGlow.clear();
    this.earthGlow.circle(0, 0, 78).fill({ color: 0x1a6a80, alpha: 0.08 });
    this.earthGlow.circle(0, 0, 62).fill({ color: 0x2b9bb3, alpha: 0.07 });
    this.earthGlow.circle(0, 0, 57).stroke({ width: 1, color: 0x5ad7e6, alpha: 0.22 });
    for (let r = 1; r <= MAX_RING; r++) {
      this.earthGlow
        .circle(0, 0, ringRadius(r) + HEX_SIZE * 0.35)
        .stroke({ width: 1, color: 0x24404d, alpha: 0.18 });
    }
    for (const cell of WORLD_CELLS.values()) {
      if (cell.ring !== 1) continue;
      const pts = hexPoints(HEX_SIZE * 0.94);
      const x = cell.x;
      const y = cell.y;
      this.gridGfx
        .poly(pts.map((v, i) => (i % 2 === 0 ? v + x : v + y)))
        .fill({ color: 0x081017, alpha: 0.36 })
        .stroke({ width: 1, color: 0x253d49, alpha: 0.55 });
    }
  }

  private buildTowers() {
    for (const tower of Object.values(this.save.towers)) {
      if (!this.towerViews.has(tower.id)) this.createTowerView(tower);
    }
    for (const [id, view] of this.towerViews) {
      if (!this.save.towers[id]) {
        view.container.destroy({ children: true });
        this.towerViews.delete(id);
      }
    }
    this.rebuildTowerIndex();
  }

  private rebuildTowerIndex() {
    this.towerByCell.clear();
    for (const tower of Object.values(this.save.towers)) this.towerByCell.set(tower.cell, tower.id);
  }

  private createTowerView(tower: TowerSave) {
    const cell = WORLD_CELLS.get(tower.cell);
    if (!cell) return;
    const spr = towerSprites[tower.type];
    const container = new Container();
    container.position.set(cell.x, cell.y);
    const ring = new Graphics();
    ring
      .circle(0, 0, 19)
      .stroke({ width: 1, color: 0xffcf6b, alpha: tower.tier > 0 ? 0.9 : 0 })
      .circle(0, 0, 21)
      .stroke({ width: 1, color: 0xffcf6b, alpha: tower.tier > 0 ? 0.28 : 0 });
    container.addChild(ring);
    const base = new Sprite(spr.base);
    base.anchor.set(0.5);
    container.addChild(base);
    const turret = new Sprite(spr.turret);
    turret.anchor.set(9 / 34, 0.5);
    turret.position.set(0, -7);
    container.addChild(turret);
    this.towerLayer.addChild(container);
    this.towerViews.set(tower.id, {
      container,
      base,
      turret,
      ring,
      angle: -Math.PI / 2,
      pop: 1,
      recoil: 0,
    });
    if (!this.towerRuntime.has(tower.id)) {
      this.towerRuntime.set(tower.id, {
        cooldown: rand(0.1, 0.35),
        targetId: 0,
        angle: -Math.PI / 2,
        beam: false,
        proc: 0,
        pulse: 0,
        heal: 0,
        recoil: 0,
      });
    }
    if (tower.tier > 0) {
      base.tint = 0xffefc9;
      turret.tint = 0xffefc9;
    }
  }

  private removeTower(towerId: string) {
    const view = this.towerViews.get(towerId);
    if (view) view.container.destroy({ children: true });
    this.towerViews.delete(towerId);
    this.towerRuntime.delete(towerId);
    delete this.save.towers[towerId];
    this.rebuildTowerIndex();
  }

  private rebuildMap() {
    const claimed = new Set(this.save.claimed);
    let maxRing = 1;
    for (const key of claimed) {
      const cell = WORLD_CELLS.get(key);
      if (cell && cell.ring > maxRing) maxRing = cell.ring;
    }
    this.maxRing = maxRing;
    this.claimable = claimableCells(claimed);

    this.gridGfx.clear();
    this.claimGfx.clear();
    this.selectGfx.clear();

    for (const cell of WORLD_CELLS.values()) {
      const isClaimed = claimed.has(cell.key);
      const pts = hexPoints(HEX_SIZE * 0.94).map((v, i) => (i % 2 === 0 ? v + cell.x : v + cell.y));
      if (cell.kind === 'hq') {
        this.gridGfx.poly(pts).fill({ color: 0x0b151b, alpha: 0.82 }).stroke({ width: 1, color: 0x37515e, alpha: 0.7 });
        continue;
      }
      let fill = isClaimed ? 0x0c1720 : 0x060d13;
      let fillA = isClaimed ? 0.82 : 0.32;
      let stroke = isClaimed ? 0x2d4654 : 0x172833;
      let strokeA = isClaimed ? 0.72 : 0.42;
      let border = false;
      if (isClaimed) {
        if (cell.kind === 'mine') fill = 0x0c1d22;
        if (cell.kind === 'chest') fill = 0x1d190d;
        if (cell.kind === 'slot') fill = 0x0e171f;
        for (const n of neighbors(cell.q, cell.r)) {
          if (!claimed.has(keyOf(n.q, n.r))) {
            border = true;
            break;
          }
        }
        if (border) {
          stroke = 0x5b7c8b;
          strokeA = 0.95;
        }
      }
      this.gridGfx.poly(pts).fill({ color: fill, alpha: fillA }).stroke({ width: 1, color: stroke, alpha: strokeA });
    }
    this.refreshClaimHighlights();

    for (const sprite of this.iconSprites) sprite.destroy();
    this.iconSprites = [];
    for (const cell of WORLD_CELLS.values()) {
      if (cell.kind === 'hq' || cell.kind === 'empty') continue;
      const isClaimed = claimed.has(cell.key);
      const towerId = this.towerByCell.get(cell.key);
      if (towerId && cell.kind === 'slot') continue;
      if (cell.kind === 'chest' && this.save.openedChests.includes(cell.key)) continue;
      const tex = cell.kind === 'mine' ? cellIcons.mine : cell.kind === 'chest' ? cellIcons.chest : cellIcons.slot;
      const icon = new Sprite(tex);
      icon.anchor.set(0.5);
      icon.position.set(cell.x, cell.y);
      icon.alpha = isClaimed ? 0.95 : 0.22;
      if (!isClaimed) icon.tint = 0x718b98;
      if (cell.kind === 'slot' && isClaimed && !towerId) icon.alpha = 0.8 + Math.sin(this.time * 2 + cell.ring) * 0.1;
      this.iconLayer.addChild(icon);
      this.iconSprites.push(icon);
    }
  }

  private refreshClaimHighlights() {
    this.claimGfx.clear();
    if (this.save.claimTokens <= 0) {
      this.claimGfx.alpha = 0;
      return;
    }
    this.claimable = claimableCells(new Set(this.save.claimed));
    for (const key of this.claimable) {
      const cell = WORLD_CELLS.get(key);
      if (!cell) continue;
      const pts = hexPoints(HEX_SIZE * 0.94).map((v, i) => (i % 2 === 0 ? v + cell.x : v + cell.y));
      this.claimGfx
        .poly(pts)
        .fill({ color: 0xffcf6b, alpha: 0.04 })
        .stroke({ width: 1, color: 0xffcf6b, alpha: 0.5 });
    }
    this.claimGfx.alpha = 1;
  }

  private designSelection() {
    this.selectGfx.clear();
    const selected = useUI.getState().selection;
    if (!selected) return;
    const cell = WORLD_CELLS.get(selected);
    if (!cell) return;
    const pts = hexPoints(HEX_SIZE * 0.88).map((v, i) => (i % 2 === 0 ? v + cell.x : v + cell.y));
    this.selectGfx.poly(pts).stroke({ width: 2, color: 0xffcf6b, alpha: 0.9 });
  }

  private resize() {
    const w = this.host.clientWidth || window.innerWidth || 390;
    const h = this.host.clientHeight || window.innerHeight || 844;
    if (w < 20 || h < 20) return;
    this.w = w;
    this.h = h;
    if (!this.app) return;
    this.app.renderer.resize(w, h);
    this.vfx.resize(w, h);
    this.bgGfx.clear();
    this.bgGfx.rect(0, 0, w, h).fill({ color: COLORS.bg, alpha: 1 });
    this.bgGfx.circle(w * 0.18, h * 0.24, w * 0.55).fill({ color: 0x0a1f2b, alpha: 0.38 });
    this.bgGfx.circle(w * 0.92, h * 0.58, w * 0.5).fill({ color: 0x1a1230, alpha: 0.3 });
    this.bgGfx.circle(w * 0.5, h * 0.4, w * 0.7).fill({ color: 0x08141d, alpha: 0.5 });
    this.stars.width = w;
    this.stars.height = h;
    this.flashGfx.clear();
    this.flashGfx.rect(0, 0, w, h).fill({ color: this.flashColor, alpha: 1 });
    this.flashGfx.alpha = this.flashAlpha;
    if (!this.cameraReady || this.camReturning) {
      this.recenterCamera(true);
    } else {
      this.clampCamera();
    }
    this.updateCamera(0, true);
    this.sync();
  }

  private cameraCenter() {
    const top = 150;
    const bottom = Math.max(top + 120, this.h - 140);
    return { x: this.w / 2, y: (top + bottom) / 2 };
  }

  private tacticalScale() {
    // Fixed tactical zoom: the camera never zooms out just because territory grows.
    // It always frames roughly three rings, then the player pans to inspect the rest.
    const fitR = ringRadius(3) + HEX_SIZE * 2.1;
    const availW = Math.max(120, this.w - 28);
    const availH = Math.max(160, this.h - 290);
    return clamp(Math.min(availW / (2 * fitR), availH / (2 * fitR)), 0.66, 1.05);
  }

  private clampCamera() {
    const R = ringRadius(MAX_RING) + HEX_SIZE * 2.1;
    const halfW = this.w / 2;
    const minX = this.w - R * this.camScale;
    const maxX = R * this.camScale;
    this.camX = minX > maxX ? halfW : clamp(this.camX, minX, maxX);
    const top = 150;
    const bottom = Math.max(top + 120, this.h - 140);
    const minY = bottom - R * this.camScale;
    const maxY = top + R * this.camScale;
    this.camY = minY > maxY ? (top + bottom) / 2 : clamp(this.camY, minY, maxY);
  }

  recenterCamera(instant = false) {
    const center = this.cameraCenter();
    this.camTargetX = center.x;
    this.camTargetY = center.y;
    if (instant) {
      this.camX = center.x;
      this.camY = center.y;
      this.camScale = this.tacticalScale();
      this.camReturning = false;
    } else {
      this.camReturning = true;
    }
  }

  zoomBy(factor: number) {
    const center = this.cameraCenter();
    this.zoomAtScreen(center.x, center.y, factor);
  }

  zoomIn() {
    this.zoomBy(ZOOM_STEP);
  }

  zoomOut() {
    this.zoomBy(1 / ZOOM_STEP);
  }

  private zoomAtScreen(sx: number, sy: number, factor: number) {
    const next = clamp(this.camScale * factor, MIN_CAM_SCALE, MAX_CAM_SCALE);
    if (Math.abs(next - this.camScale) < 0.0001) return;
    const wx = (sx - this.camX) / this.camScale;
    const wy = (sy - this.camY) / this.camScale;
    this.camScale = next;
    this.camX = sx - wx * next;
    this.camY = sy - wy * next;
    this.camReturning = false;
    this.clampCamera();
  }

  private updateCamera(dt: number, instant = false) {
    const scale = this.tacticalScale();
    const t = instant ? 1 : Math.min(1, dt * 6.5);
    if (this.camReturning || !this.cameraReady) {
      this.camScale = lerp(this.camScale, scale, t);
      const center = this.cameraCenter();
      this.camTargetX = center.x;
      this.camTargetY = center.y;
      this.camX = lerp(this.camX, this.camTargetX, t);
      this.camY = lerp(this.camY, this.camTargetY, t);
      const arrived = Math.hypot(this.camX - center.x, this.camY - center.y) < 1.2
        && Math.abs(this.camScale - scale) < 0.001;
      if (instant || arrived) {
        this.camX = center.x;
        this.camY = center.y;
        this.camScale = scale;
        this.camReturning = false;
      }
    }
    this.clampCamera();
    let shakeX = 0;
    let shakeY = 0;
    if (this.shake > 0.005) {
      shakeX = rand(-1, 1) * this.shake * 7;
      shakeY = rand(-1, 1) * this.shake * 7;
      this.shake *= Math.max(0, 1 - dt * 4);
    }
    this.world.scale.set(this.camScale);
    this.world.position.set(this.camX + shakeX, this.camY + shakeY);
    this.vfx.sprite.position.set(shakeX, shakeY);
    this.hq.scale.set(1 + Math.sin(this.time * 1.7) * 0.012);
    if (!this.cameraReady) {
      this.cameraReady = true;
      this.world.position.set(this.camX, this.camY);
    }
  }

  private tick(ticker: { deltaMS: number }) {
    const raw = Math.min(ticker.deltaMS / 1000, 0.1);
    const modal = useUI.getState().modal;
    const paused = modal !== 'none';
    this.fps = Math.round(this.app.ticker.FPS);
    if (!paused) {
      this.time += raw;
      this.step(raw);
    }
    this.updateCamera(raw);
    this.vfx.update(raw);
    this.render(raw);
    this.syncTimer += raw;
    if (this.syncTimer >= 0.24) {
      this.syncTimer = 0;
      this.sync();
    }
    if (!paused) {
      this.saveTimer += raw;
      if (this.saveTimer >= 10) {
        this.saveTimer = 0;
        this.persist();
      }
    }
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - raw * 3.5);
      this.flashGfx.alpha = this.flashAlpha;
    }
    this.uiTimer += raw;
    if (this.uiTimer > 0.2) {
      this.uiTimer = 0;
      this.designSelection();
    }
  }

  private step(dt: number) {
    this.save.playTime += dt;
    const inc = passiveIncome(this.save);
    this.save.resources.metal += inc.metal * dt;
    this.save.resources.crystal += inc.crystal * dt;
    this.save.stats.metalEarned += inc.metal * dt;

    this.updateScheduled();
    this.updateRaid(dt);
    this.updateTowers(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateSparks(dt);
    this.cleanupEnemies();
  }

  private updateScheduled() {
    if (!this.scheduled.length) return;
    const due = this.scheduled.filter((s) => s.at <= this.time);
    this.scheduled = this.scheduled.filter((s) => s.at > this.time);
    for (const s of due) s.run();
  }

  private schedule(delay: number, run: () => void) {
    this.scheduled.push({ at: this.time + delay, run });
  }

  private updateRaid(dt: number) {
    const holdingTutorial =
      this.save.chapter === 1 &&
      !this.save.tutorial.done &&
      Object.keys(this.save.towers).length === 0;
    if (this.raidPhase === 'prep') {
      if (holdingTutorial) {
        this.phaseTimer = 0;
        return;
      }
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.startRaid();
      return;
    }
    if (this.raidPhase === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const next = this.spawnQueue.shift();
        if (next) {
          this.spawnEnemy(next.kind, next.elite);
          this.spawnTimer = this.spawnGap;
        }
        if (!this.spawnQueue.length) {
          if (raidKindFor(this.raidIndex) === 'boss' && !this.bossSpawned) {
            this.spawnBoss();
            this.raidPhase = 'boss';
          } else {
            this.raidPhase = 'clearing';
          }
        }
      }
      return;
    }
    if (this.raidPhase === 'clearing' || this.raidPhase === 'boss') {
      if (!this.spawnQueue.length && !this.enemies.some((e) => !e.dead)) {
        this.finishRaid();
      }
    }
  }

  private startRaid() {
    const kind = raidKindFor(this.raidIndex);
    const count = raidNormalCount(this.save.chapter, this.raidIndex, this.save.claimed.length);
    this.spawnQueue = [];
    for (let i = 0; i < count; i++) {
      let type = pickEnemyKind(this.save.chapter, Math.random());
      let elite = false;
      if (kind === 'elite' && (i === Math.floor(count * 0.35) || i === Math.floor(count * 0.72))) {
        elite = true;
      }
      if (kind === 'boss' && type === 'tentacle' && i === count - 1) type = pickEnemyKind(this.save.chapter, Math.random());
      this.spawnQueue.push({ kind: type, elite });
    }
    this.raidTotal = this.spawnQueue.length + (kind === 'boss' ? 1 : 0);
    this.raidKills = 0;
    this.raidSpawned = 0;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.finishing = false;
    this.spawnGap = raidSpawnGap(this.save.chapter, this.raidIndex);
    this.raidPhase = 'spawning';
    this.spawnTimer = 0.1;
    if (kind === 'elite') useUI.getState().toast('RAID ELITE — địch biến thể đang tới', 'warn');
    if (kind === 'boss') {
      useUI.getState().toast(`RAID BOSS — ${ENEMIES[bossKindFor(this.save.chapter)].name}`, 'bad');
      this.flashScreen(0xff3b30, 0.08);
    }
  }

  private spawnBoss() {
    const kind = bossKindFor(this.save.chapter);
    this.bossSpawned = true;
    this.spawnEnemy(kind, false);
    useUI.getState().toast(`BOSS XUẤT HIỆN: ${ENEMIES[kind].name}`, 'bad');
    this.flashScreen(0xff3b30, 0.18);
    this.shake = 0.6;
  }

  private sectorWeight(i: number) {
    let border = 0;
    const claimed = new Set(this.save.claimed);
    for (const key of claimed) {
      const cell = WORLD_CELLS.get(key);
      if (!cell || cell.sector !== i) continue;
      for (const n of neighbors(cell.q, cell.r)) {
        if (!claimed.has(keyOf(n.q, n.r))) {
          border++;
          break;
        }
      }
    }
    const pulse = 1 + 0.38 * Math.sin(this.time * 0.11 + i * 1.73);
    return Math.max(0.4, border) * pulse * rand(0.8, 1.15);
  }

  private pickSector(): number {
    const n = sectorCountFor(this.save.chapter);
    if (this.save.chapter === 1 && this.raidIndex < 2) {
      return this.raidSpawned % n;
    }
    const weights = Array.from({ length: n }, (_, i) => this.sectorWeight(i));
    const total = weights.reduce((a, b) => a + b, 0);
    let v = Math.random() * total;
    for (let i = 0; i < n; i++) {
      v -= weights[i];
      if (v <= 0) return i;
    }
    return n - 1;
  }

  private maxRingForSector(sector: number) {
    let max = 0;
    const claimed = new Set(this.save.claimed);
    for (const key of claimed) {
      const cell = WORLD_CELLS.get(key);
      if (cell && cell.sector === sector && cell.ring > max) max = cell.ring;
    }
    return max || this.maxRing;
  }

  private spawnEnemy(kind: EnemyKind, elite: boolean, forceSector?: number, at?: { x: number; y: number }) {
    const def = ENEMIES[kind];
    const scale = enemyScale(this.save.chapter, this.raidIndex, this.save.claimed.length);
    const boss = !!def.boss;
    const hpMul = (elite ? 3.2 : 1) * (boss ? 1.1 : 1);
    const shieldMul = (elite ? 2 : 1) * (boss ? 1.1 : 1);
    const sector = forceSector ?? this.pickSector();
    let x = at?.x;
    let y = at?.y;
    if (x == null || y == null) {
      const step = (Math.PI * 2) / sectorCountFor(this.save.chapter);
      const a = -Math.PI / 2 + (sector + 0.5) * step + rand(-0.32, 0.32) * step;
      const r = ringRadius(this.maxRingForSector(sector)) + HEX_SIZE * (1.7 + rand(0, 0.6));
      x = Math.cos(a) * r;
      y = Math.sin(a) * r;
    }
    const e: Enemy = {
      id: this.nextEnemyId++,
      kind,
      faction: def.faction,
      name: def.name,
      boss,
      elite,
      sector,
      x,
      y,
      hp: def.hp * scale.hp * hpMul,
      maxHp: def.hp * scale.hp * hpMul,
      shield: def.shield * scale.hp * shieldMul,
      maxShield: def.shield * scale.hp * shieldMul,
      armor: def.armor * (1 + 0.16 * (this.save.chapter - 1)) + (elite ? 3 : 0),
      speed: def.speed * scale.speed * (elite ? 0.82 : 1),
      speedMul: 1,
      size: def.size * (elite ? 1.28 : 1),
      reward: def.reward * scale.reward * (elite ? 4 : 1),
      crystal: def.crystal * (1 + 0.35 * (this.save.chapter - 1)) * (elite ? 5 : 1),
      leak: def.leak * scale.dmg * (elite ? 1.4 : 1),
      regen: def.regen,
      spawner: def.spawner ?? null,
      spawnerTimer: rand(2.5, 5),
      spin: rand(-0.8, 0.8),
      age: 0,
      phase: 1,
      stunUntil: 0,
      slowUntil: 0,
      slowFactor: 1,
      revealedUntil: 0,
      lastDamageAt: this.time,
      hitFlash: 0,
      dead: false,
      targetId: 0,
    };
    this.enemies.push(e);
    this.raidSpawned++;
    this.createEnemyView(e);
    if (boss) {
      this.shake = 0.5;
      this.vfx.add('emp', this.screenX(x), this.screenY(y), {
        scale: 0.6,
        palette: PAL.danger,
        light: 0.8,
      });
    }
    return e;
  }

  private createEnemyView(e: Enemy) {
    const container = new Container();
    const sprite = new Sprite(enemySprites[e.kind]);
    sprite.anchor.set(0.5);
    container.addChild(sprite);
    container.position.set(e.x, e.y);
    this.enemyLayer.addChild(container);
    this.enemyViews.set(e.id, { container, sprite });
  }

  private removeEnemyView(e: Enemy) {
    const view = this.enemyViews.get(e.id);
    if (view) {
      view.container.destroy({ children: true });
      this.enemyViews.delete(e.id);
    }
  }

  private killEnemy(e: Enemy, withReward = true) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    this.removeEnemyView(e);
    if (withReward) {
      this.save.resources.metal += e.reward;
      this.save.resources.crystal += e.crystal;
      this.save.stats.metalEarned += e.reward;
      this.save.stats.kills++;
      this.raidKills++;
      this.spawnDeathFx(e);
      this.addSparks(e.x, e.y, e.boss ? 18 : 5, e.faction === 'alien' ? 0xa98bff : e.faction === 'monster' ? 0x8bd47a : 0xffb07a, e.boss ? 90 : 32);
    }
    if (e.kind === 'splitter' && !e.boss) {
      for (let i = 0; i < 2; i++) {
        const shard = this.spawnEnemy('shard', false, e.sector, {
          x: e.x + rand(-10, 10),
          y: e.y + rand(-10, 10),
        });
        shard.hp *= 0.7;
        shard.maxHp = shard.hp;
      }
    }
    if (e.boss) {
      this.bossDefeated = true;
      this.save.stats.bosses++;
      this.flashScreen(e.faction === 'alien' ? 0xa86bff : 0xffb05a, 0.2);
      this.shake = 1;
      this.vfx.add('plasma', this.screenX(e.x), this.screenY(e.y), {
        scale: 0.95,
        palette: e.faction === 'asteroid' ? PAL.kinetic : e.faction === 'alien' ? PAL.alien : PAL.monster,
        light: 1.2,
      });
      for (const other of this.enemies) {
        if (other !== e && !other.dead) {
          other.dead = true;
          this.removeEnemyView(other);
          this.spawnDeathFx(other);
        }
      }
    }
  }

  private spawnDeathFx(e: Enemy) {
    const x = this.screenX(e.x);
    const y = this.screenY(e.y);
    const s = clamp(this.camScale * 0.56, 0.26, 0.72);
    if (e.faction === 'asteroid') {
      this.vfx.add('hit', x, y, { scale: e.boss ? 1 : s, palette: PAL.kinetic, light: 0.75 });
    } else if (e.faction === 'alien') {
      this.vfx.add('zap', x, y, { scale: e.boss ? 1 : s, palette: PAL.alien, light: 0.8 });
    } else {
      this.vfx.add('poof', x, y, { scale: e.boss ? 1 : s, palette: PAL.monster, light: 0.65 });
    }
  }

  private cleanupEnemies() {
    if (!this.enemies.some((e) => e.dead)) return;
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private updateTowers(dt: number) {
    const towers = Object.values(this.save.towers);
    const resonance = resonanceActive(this.save);
    const ctx = towerCtx(this.save, 0);
    const amps: { tower: TowerSave; stat: TowerComputed; cell: CellDef | undefined }[] = [];
    for (const tower of towers) {
      if (TOWERS[tower.type].projectile !== 'amp') continue;
      const cell = WORLD_CELLS.get(tower.cell);
      amps.push({ tower, stat: computeTower(tower, ctx), cell });
    }
    const ampBuff = new Map<string, number>();
    for (const amp of amps) {
      if (!amp.cell) continue;
      for (const tower of towers) {
        if (tower.id === amp.tower.id) continue;
        const cell = WORLD_CELLS.get(tower.cell);
        if (!cell) continue;
        if (dist2(cell.x, cell.y, amp.cell.x, amp.cell.y) <= amp.stat.range * amp.stat.range) {
          ampBuff.set(tower.id, (ampBuff.get(tower.id) ?? 0) + amp.stat.buff);
        }
      }
    }

    const rateAuras: { tower: TowerSave; stat: TowerComputed; cell: CellDef | undefined }[] = [];
    for (const tower of towers) {
      if (!TOWERS[tower.type].auraRate) continue;
      const cell = WORLD_CELLS.get(tower.cell);
      rateAuras.push({ tower, stat: computeTower(tower, { ...ctx, resonance }), cell });
    }
    const rateBuff = new Map<string, number>();
    for (const aura of rateAuras) {
      if (!aura.cell) continue;
      for (const tower of towers) {
        if (tower.id === aura.tower.id) continue;
        const cell = WORLD_CELLS.get(tower.cell);
        if (!cell) continue;
        if (dist2(cell.x, cell.y, aura.cell.x, aura.cell.y) <= aura.stat.range * aura.stat.range) {
          rateBuff.set(tower.id, (rateBuff.get(tower.id) ?? 0) + aura.stat.auraRate);
        }
      }
    }

    for (const tower of towers) {
      const def = TOWERS[tower.type];
      const cell = WORLD_CELLS.get(tower.cell);
      if (!cell) continue;
      const buff = ampBuff.get(tower.id) ?? 0;
      const rate = rateBuff.get(tower.id) ?? 0;
      const stats = computeTower(tower, { ...ctx, resonance, ampBuff: buff, rateBuff: rate });
      let rt = this.towerRuntime.get(tower.id);
      if (!rt) {
        rt = { cooldown: rand(0, 0.4), targetId: 0, angle: -Math.PI / 2, beam: false, proc: 0, pulse: 0, heal: 0, recoil: 0 };
        this.towerRuntime.set(tower.id, rt);
      }
      rt.beam = false;

      if (def.projectile === 'repair') {
        rt.heal += dt;
        if (rt.heal >= 2) {
          rt.heal = 0;
          this.addRing(cell.x, cell.y, 8, 28, 0.5, 0x35e0e8, 2);
        }
        continue;
      }
      if (def.projectile === 'amp') continue;

      if (def.projectile === 'aura') {
        const slow = stats.slow;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (dist2(e.x, e.y, cell.x, cell.y) <= stats.range * stats.range) {
            e.slowUntil = Math.max(e.slowUntil, this.time + 0.25);
            e.slowFactor = Math.max(e.slowFactor, Math.min(e.slowFactor, 1 - slow));
            this.damageEnemy(e, stats.damage * dt, 'tech', def.armorPierce ?? false, tower, stats, false);
          }
        }
        rt.angle = -Math.PI / 2;
        continue;
      }

      if (def.projectile === 'pulse') {
        rt.pulse -= dt;
        if (rt.pulse <= 0) {
          const inRange = this.enemies.filter(
            (e) => !e.dead && dist2(e.x, e.y, cell.x, cell.y) <= stats.range * stats.range,
          );
          if (inRange.length) {
            rt.pulse = stats.interval;
            this.spawnRingWorld(cell.x, cell.y, 10, stats.range, 0.55, 0xa86bff, 2);
            for (const e of inRange) {
              e.shield = 0;
              e.stunUntil = Math.max(e.stunUntil, this.time + (def.stun ?? 1));
              e.revealedUntil = Math.max(e.revealedUntil, this.time + 3);
              this.damageEnemy(e, stats.damage, 'tech', def.armorPierce ?? false, tower, stats, false);
            }
          }
        }
        continue;
      }

      const target = this.findTarget(cell, stats, !!def.armorPierce, this.save.chapter >= 3);
      if (!target) {
        rt.cooldown = Math.min(rt.cooldown, 0.1);
        rt.targetId = 0;
        continue;
      }
      rt.targetId = target.id;
      rt.angle = Math.atan2(target.y - (cell.y - 7), target.x - cell.x);

      if (def.projectile === 'beam') {
        rt.beam = true;
        this.damageEnemy(target, stats.damage * dt, 'energy', false, tower, stats, false);
        rt.proc -= dt;
        if (rt.proc <= 0) {
          rt.proc = 0.6;
          this.applyHitEffects(tower, stats, target);
        }
        continue;
      }

      rt.cooldown -= dt;
      if (rt.cooldown > 0) continue;
      rt.cooldown = stats.interval;
      rt.recoil = 1;

      if (def.projectile === 'rail') {
        this.damageEnemy(target, stats.damage, 'kinetic', true, tower, stats, true);
        const mx = cell.x + Math.cos(rt.angle) * 15;
        const my = cell.y - 7 + Math.sin(rt.angle) * 15;
        this.tracers.push({
          x1: mx,
          y1: my,
          x2: target.x,
          y2: target.y,
          life: 0.1,
          max: 0.1,
          color: 0xffb07a,
          width: 2,
        });
        this.addSparks(target.x, target.y, 3, 0xffcf9f, 22);
      } else if (def.projectile === 'flak') {
        const pellets = def.pellets ?? 3;
        for (let i = 0; i < pellets; i++) {
          this.projectiles.push({
            kind: 'flak',
            x: cell.x,
            y: cell.y - 7,
            sx: cell.x,
            sy: cell.y - 7,
            tx: target.x + rand(-7, 7),
            ty: target.y + rand(-7, 7),
            t: 0,
            dur: rand(0.12, 0.22),
            targetId: target.id,
            damage: stats.damage,
            splash: stats.splash,
            armorPierce: def.armorPierce ?? false,
            system: 'kinetic',
            towerId: tower.id,
            color: 0xffb05a,
          });
        }
      } else if (def.projectile === 'plasma') {
        this.projectiles.push({
          kind: 'plasma',
          x: cell.x,
          y: cell.y - 7,
          sx: cell.x,
          sy: cell.y - 7,
          tx: target.x,
          ty: target.y,
          t: 0,
          dur: 0.38,
          targetId: target.id,
          damage: stats.damage,
          splash: stats.splash,
          armorPierce: def.armorPierce ?? false,
          system: 'energy',
          towerId: tower.id,
          color: 0x5af0ff,
        });
      }
    }
  }

  private findTarget(cell: CellDef, stats: TowerComputed, pierce: boolean, preferCluster: boolean) {
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist2(e.x, e.y, cell.x, cell.y);
      if (d > stats.range * stats.range) continue;
      if (this.isCloaked(e)) continue;
      let score = Math.sqrt(d) - (e.boss ? 38 : e.elite ? 16 : 0);
      if (preferCluster) {
        let count = 0;
        for (const other of this.enemies) {
          if (other.dead || other === e) continue;
          if (dist2(other.x, other.y, e.x, e.y) < (stats.splash + 12) * (stats.splash + 12)) count++;
        }
        score -= count * 14;
      }
      void pierce;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private isCloaked(e: Enemy) {
    if (e.kind !== 'scout') return false;
    if (this.time < e.revealedUntil) return false;
    return (this.time + e.id * 1.37) % 6.5 < 3.1;
  }

  private applyHitEffects(tower: TowerSave, stats: TowerComputed, enemy: Enemy) {
    if (stats.slow > 0) {
      enemy.slowUntil = Math.max(enemy.slowUntil, this.time + 1.5);
      enemy.slowFactor = Math.min(enemy.slowFactor, 1 - stats.slow);
    }
    if (stats.stun > 0 && Math.random() < stats.stun) {
      enemy.stunUntil = Math.max(enemy.stunUntil, this.time + 0.55);
      this.addRing(enemy.x, enemy.y, 4, 16, 0.35, 0xd7b8ff, 1);
    }
    void tower;
  }

  private damageEnemy(
    enemy: Enemy,
    raw: number,
    system: TowerSystem,
    armorPierce: boolean,
    tower: TowerSave,
    stats: TowerComputed,
    allowProc: boolean,
  ) {
    if (enemy.dead || raw <= 0) return;
    let dmg = raw;
    if (!armorPierce) dmg = Math.max(1, dmg - enemy.armor * (system === 'tech' ? 0.5 : 1));
    if (system === 'kinetic' && enemy.faction === 'asteroid') dmg *= 1.3;
    if (system === 'energy' && enemy.faction === 'monster') dmg *= 1.3;
    if (system === 'tech' && enemy.faction === 'alien') dmg *= 1.3;
    if (system === 'tech' && enemy.shield > 0) dmg *= 2;
    enemy.lastDamageAt = this.time;
    enemy.hitFlash = 0.12;
    if (enemy.shield > 0) {
      if (enemy.shield >= dmg) {
        enemy.shield -= dmg;
        if (allowProc) this.applyHitEffects(tower, stats, enemy);
        return;
      }
      dmg -= enemy.shield;
      enemy.shield = 0;
      this.addRing(enemy.x, enemy.y, enemy.size, enemy.size + 14, 0.4, 0x7ee7ff, 2);
    }
    enemy.hp -= dmg;
    if (allowProc) this.applyHitEffects(tower, stats, enemy);
    if (enemy.hp <= 0) this.killEnemy(enemy);
    else if (allowProc && raw > 8) this.addSparks(enemy.x, enemy.y, 2, 0xffd7a0, 20);
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.age += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.slowUntil < this.time) e.slowFactor = 1;
      const stunned = this.time < e.stunUntil;
      if (!stunned) {
        let mul = e.speedMul;
        if (this.time < e.slowUntil) mul *= e.slowFactor;
        const dx = -e.x;
        const dy = -e.y;
        const d = Math.hypot(dx, dy) || 1;
        let vx = (dx / d) * e.speed * mul;
        let vy = (dy / d) * e.speed * mul;
        if (e.faction === 'alien') {
          const px = -dy / d;
          const py = dx / d;
          const wig = Math.sin(this.time * 2.1 + e.id * 0.7) * 9;
          vx += px * wig;
          vy += py * wig;
        }
        e.x += vx * dt;
        e.y += vy * dt;
      }
      const dx = -e.x;
      const dy = -e.y;
      if (Math.hypot(dx, dy) < 27 + e.size * 0.1) {
        this.leakEnemy(e);
        continue;
      }
      if (e.maxShield > 0 && e.shield < e.maxShield && this.time - e.lastDamageAt > 4) {
        e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.04 * dt);
      }
      if (e.regen > 0 && e.hp < e.maxHp && this.time - e.lastDamageAt > 2.5) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);
      }
      if (e.spawner) {
        e.spawnerTimer -= dt;
        if (e.spawnerTimer <= 0 && this.enemies.length < 65) {
          e.spawnerTimer = e.boss ? 4.6 : 6.5;
          const minion = this.spawnEnemy(e.spawner, false, e.sector, { x: e.x + rand(-12, 12), y: e.y + rand(-12, 12) });
          minion.hp *= 0.75;
          minion.maxHp = minion.hp;
          this.addSparks(e.x, e.y, 3, 0x8bd47a, 18);
        }
      }
      if (e.kind === 'scout' && this.isCloaked(e)) {
        const view = this.enemyViews.get(e.id);
        if (view) view.sprite.alpha = 0.13;
      }
      if (e.boss) {
        const view = this.enemyViews.get(e.id);
        if (view) view.sprite.tint = this.time < e.stunUntil ? 0xfff2a8 : e.hitFlash > 0 ? 0xffffff : 0xffffff;
        const frac = e.hp / e.maxHp;
        const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
        if (phase > e.phase) {
          e.phase = phase;
          e.stunUntil = Math.max(e.stunUntil, this.time + 0.7);
          e.speedMul *= 1.12;
          if (e.maxShield > 0) e.shield = Math.max(e.shield, e.maxShield * 0.45);
          this.flashScreen(e.faction === 'alien' ? 0xa86bff : 0xffb05a, 0.08);
          this.shake = Math.max(this.shake, 0.4);
          this.addRing(e.x, e.y, e.size, e.size + 44, 0.7, 0xff6b5a, 3);
          useUI.getState().toast(`${e.name} — PHA ${phase}`, 'warn');
        }
      }
    }
  }

  private leakEnemy(e: Enemy) {
    if (this.time < this.shieldUntil) {
      this.killEnemy(e, true);
      this.addRing(0, 0, 18, 64, 0.4, 0x35e0e8, 2);
      return;
    }
    e.dead = true;
    e.hp = 0;
    this.removeEnemyView(e);
    this.vfx.add('hit', this.screenX(0), this.screenY(0), { scale: 0.6, palette: PAL.danger, light: 0.9 });
    this.addRing(0, 0, 20, 58, 0.45, 0xff5a5a, 2);
    this.flashScreen(0xff3b30, 0.06);
    if (this.time - this.leakWarnAt > 2.5) {
      this.leakWarnAt = this.time;
      useUI.getState().toast(`QUÁI LỌT — thưởng raid bị giảm (${this.raidKills}/${this.raidTotal} hạ)`, 'warn');
    }
    if (e.boss) {
      useUI.getState().toast(`BOSS ĐÃ LỌT — ${e.name}`, 'bad');
      this.bossDefeated = false;
      this.shake = 0.9;
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.targetId) {
        const target = this.enemies.find((e) => e.id === p.targetId && !e.dead);
        if (target) {
          p.tx = target.x;
          p.ty = target.y;
        }
      }
      const k = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.y = p.sy + (p.ty - p.sy) * k;
    }
    const done = this.projectiles.filter((p) => p.t >= p.dur);
    if (!done.length) return;
    this.projectiles = this.projectiles.filter((p) => p.t < p.dur);
    for (const p of done) {
      this.explodeProjectile(p);
    }
  }

  private explodeProjectile(p: Projectile) {
    const radius = Math.max(8, p.splash);
    const tower = this.save.towers[p.towerId];
    const stats = tower ? this.getTowerStats(p.towerId) : null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d2 = dist2(e.x, e.y, p.x, p.y);
      if (d2 > (radius + e.size * 0.4) * (radius + e.size * 0.4)) continue;
      const falloff = 1 - 0.45 * Math.min(1, Math.sqrt(d2) / radius);
      if (tower && stats) {
        this.damageEnemy(e, p.damage * falloff, p.system, p.armorPierce, tower, stats, true);
      }
    }
    if (p.kind === 'plasma') {
      this.addRing(p.x, p.y, 4, radius * 0.9, 0.4, 0x5af0ff, 2);
      this.addSparks(p.x, p.y, 8, 0x9ffaff, 40);
      this.flashScreen(0x35e0e8, 0.025);
    } else {
      this.addSparks(p.x, p.y, 4, 0xffb05a, 28);
    }
  }

  private updateSparks(dt: number) {
    for (const s of this.sparks) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - dt * 1.8;
      s.vy = s.vy * (1 - dt * 1.8) + 55 * dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  private addSparks(x: number, y: number, count: number, color: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(speed * 0.25, speed);
      const life = rand(0.18, 0.5);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        max: life,
        color,
        size: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  private addRing(x: number, y: number, r0: number, r1: number, life: number, color: number, width: number) {
    this.rings.push({ x, y, r0, r1, life, max: life, color, width });
  }

  private spawnRingWorld(x: number, y: number, r0: number, r1: number, life: number, color: number, width: number) {
    this.addRing(x, y, r0, r1, life, color, width);
  }

  private render(dt: number) {
    this.combatGfx.clear();
    this.rangeGfx.clear();
    this.aimGfx.clear();

    for (const [id, view] of this.towerViews) {
      const tower = this.save.towers[id];
      if (!tower) continue;
      const rt = this.towerRuntime.get(id);
      const cell = WORLD_CELLS.get(tower.cell);
      if (!rt || !cell) continue;
      view.pop = Math.max(0, view.pop - dt * 3.2);
      view.recoil = Math.max(0, view.recoil - dt * 10);
      const support = TOWERS[tower.type].system === 'support';
      if (support) {
        view.turret.rotation = Math.sin(this.time * 0.7 + cell.q * 0.5) * 0.08 - Math.PI / 2;
      } else {
        view.turret.rotation = rt.angle;
      }
      view.container.scale.set((1 + view.pop * 0.25) * (tower.tier > 0 ? 1.08 : 1));
      view.turret.position.set(
        -Math.cos(view.turret.rotation) * view.recoil * 2,
        -7 - Math.sin(view.turret.rotation) * view.recoil * 2,
      );
      view.ring.rotation += dt * (tower.tier > 0 ? 0.5 : 0);
      view.ring.alpha = tower.tier > 0 ? 1 : 0;
    }

    const selected = useUI.getState().selection;
    const showAll = this.save.settings.showRanges;
    for (const [id, tower] of Object.entries(this.save.towers)) {
      const cell = WORLD_CELLS.get(tower.cell);
      if (!cell) continue;
      const def = TOWERS[tower.type];
      if (def.projectile === 'amp' || def.projectile === 'repair') {
        const view = this.towerViews.get(id);
        if (view) {
          this.rangeGfx.circle(cell.x, cell.y, this.getTowerStats(id).range).stroke({
            width: 1,
            color: TOWER_ACCENT[tower.type],
            alpha: selected === tower.cell ? 0.4 : 0.055,
          });
        }
        continue;
      }
      const active = selected === tower.cell || showAll;
      if (!active) continue;
      const stats = this.getTowerStats(id);
      this.rangeGfx.circle(cell.x, cell.y, stats.range).stroke({
        width: 1,
        color: TOWER_ACCENT[tower.type],
        alpha: selected === tower.cell ? 0.45 : 0.07,
      });
      if (selected === tower.cell) {
        this.rangeGfx.circle(cell.x, cell.y, stats.range).stroke({
          width: 1,
          color: TOWER_ACCENT[tower.type],
          alpha: 0.12,
        });
      }
    }

    const aiming = useUI.getState().aiming;
    if (aiming === 'orbital') {
      const r = 110;
      const pulse = 0.6 + Math.sin(this.time * 4) * 0.15;
      this.aimGfx
        .circle(this.aimPos.x, this.aimPos.y, r)
        .stroke({ width: 2, color: 0xff7a3c, alpha: pulse });
      this.aimGfx.circle(this.aimPos.x, this.aimPos.y, 8).stroke({ width: 1, color: 0xffd0a8, alpha: 0.9 });
      this.aimGfx.moveTo(this.aimPos.x - 16, this.aimPos.y).lineTo(this.aimPos.x - 4, this.aimPos.y);
      this.aimGfx.moveTo(this.aimPos.x + 4, this.aimPos.y).lineTo(this.aimPos.x + 16, this.aimPos.y);
      this.aimGfx.moveTo(this.aimPos.x, this.aimPos.y - 16).lineTo(this.aimPos.x, this.aimPos.y - 4);
      this.aimGfx.moveTo(this.aimPos.x, this.aimPos.y + 4).lineTo(this.aimPos.x, this.aimPos.y + 16);
      this.aimGfx.stroke({ width: 1, color: 0xffd0a8, alpha: 0.9 });
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      const view = this.enemyViews.get(e.id);
      if (!view) continue;
      const bob = Math.sin(this.time * 2.2 + e.id) * (e.faction === 'alien' ? 1.4 : 0.5);
      view.container.position.set(e.x, e.y + bob);
      if (e.faction === 'asteroid') view.sprite.rotation += e.spin * 0.01;
      else view.sprite.rotation = Math.sin(this.time * 1.4 + e.id) * 0.025;
      let tint = 0xffffff;
      if (e.hitFlash > 0) tint = 0xffe1b8;
      else if (this.time < e.stunUntil) tint = 0xfff29a;
      else if (this.time < e.slowUntil) tint = 0x9fdcff;
      view.sprite.tint = tint;
      view.sprite.alpha = this.isCloaked(e) ? 0.15 : 1;
      if (e.boss) view.sprite.alpha = 1;
      const w = clamp(e.size * 1.8, 16, 74);
      const hy = e.y - e.size - 10 + bob;
      this.combatGfx.rect(e.x - w / 2 - 1, hy - 1, w + 2, 4).fill({ color: 0x05080d, alpha: 0.8 });
      this.combatGfx
        .rect(e.x - w / 2, hy, w * clamp(e.hp / e.maxHp, 0, 1), 2)
        .fill({ color: e.boss ? 0xff5a5a : e.faction === 'alien' ? 0xa98bff : e.faction === 'monster' ? 0x8bd47a : 0xe0a06b, alpha: 1 });
      if (e.maxShield > 0) {
        this.combatGfx
          .rect(e.x - w / 2, hy - 3, w * clamp(e.shield / e.maxShield, 0, 1), 1)
          .fill({ color: 0x6fe7ff, alpha: 0.9 });
      }
      if (e.elite) {
        this.combatGfx.circle(e.x, e.y, e.size + 5).stroke({ width: 1, color: 0xffcf6b, alpha: 0.55 });
      }
      if (e.boss) {
        this.combatGfx.circle(e.x, e.y, e.size + 9).stroke({ width: 1, color: 0xff5a5a, alpha: 0.45 });
        this.combatGfx.circle(e.x, e.y, e.size + 14).stroke({ width: 1, color: 0xff5a5a, alpha: 0.16 });
      }
      if (this.isCloaked(e)) {
        this.combatGfx.circle(e.x, e.y, e.size + 4).stroke({ width: 1, color: 0x6fe7ff, alpha: 0.2 });
      }
    }

    for (const tower of Object.values(this.save.towers)) {
      const def = TOWERS[tower.type];
      const cell = WORLD_CELLS.get(tower.cell);
      const rt = this.towerRuntime.get(tower.id);
      if (!cell || !rt) continue;
      if (def.projectile === 'beam' && rt.beam) {
        const target = this.enemies.find((e) => e.id === rt.targetId && !e.dead);
        if (target) {
          const mx = cell.x + Math.cos(rt.angle) * 15;
          const my = cell.y - 7 + Math.sin(rt.angle) * 15;
          this.combatGfx.moveTo(mx, my).lineTo(target.x, target.y).stroke({ width: 3.5, color: 0x35e0e8, alpha: 0.22 });
          const flick = 0.65 + Math.sin(this.time * 31 + cell.x) * 0.2;
          this.combatGfx.moveTo(mx, my).lineTo(target.x, target.y).stroke({ width: 1.5, color: 0xc9ffff, alpha: flick });
          this.combatGfx.circle(target.x, target.y, 3).fill({ color: 0xeaffff, alpha: 0.9 });
        }
      }
      if (def.projectile === 'aura') {
        this.combatGfx.circle(cell.x, cell.y, this.getTowerStats(tower.id).range).stroke({
          width: 1,
          color: 0xa86bff,
          alpha: 0.09,
        });
      }
      if (def.projectile === 'repair' || def.projectile === 'amp') {
        const stats = this.getTowerStats(tower.id);
        this.combatGfx.circle(cell.x, cell.y, stats.range).stroke({ width: 1, color: 0xf2d98a, alpha: 0.05 });
      }
    }

    for (const p of this.projectiles) {
      const trail = p.kind === 'plasma' ? 0.24 : 0.15;
      this.combatGfx
        .moveTo(p.sx, p.sy)
        .lineTo(p.x, p.y)
        .stroke({ width: p.kind === 'plasma' ? 2 : 1, color: p.color, alpha: trail });
      this.combatGfx.circle(p.x, p.y, p.kind === 'plasma' ? 2.6 : 1.6).fill({ color: p.color, alpha: 1 });
    }
    for (const t of this.tracers) {
      this.combatGfx
        .moveTo(t.x1, t.y1)
        .lineTo(t.x2, t.y2)
        .stroke({ width: t.width, color: t.color, alpha: (t.life / t.max) * 0.9 });
      this.combatGfx.circle(t.x2, t.y2, 2).fill({ color: 0xfff4e8, alpha: (t.life / t.max) * 0.9 });
    }
    for (const s of this.sparks) {
      this.combatGfx.rect(s.x, s.y, s.size, s.size).fill({ color: s.color, alpha: clamp(s.life / s.max, 0, 1) });
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      const radius = r.r0 + (r.r1 - r.r0) * k;
      this.combatGfx.circle(r.x, r.y, radius).stroke({ width: r.width, color: r.color, alpha: (1 - k) * 0.8 });
    }

    this.claimGfx.alpha = this.save.claimTokens > 0 ? 0.65 + Math.sin(this.time * 3.2) * 0.35 : 0;
    this.designSelection();
    this.flashGfx.alpha = this.flashAlpha;
  }

  private updateHud(): HudSnapshot {
    const skills = {} as HudSnapshot['skills'];
    const chapter = this.save.chapter;
    for (const id of Object.keys(SKILLS) as SkillId[]) {
      const remain = Math.max(0, (this.save.skills[id]?.cooldownEnd ?? 0) - Date.now()) / 1000;
      const total = SKILLS[id].cooldown * cooldownMult(this.save.prestige.upgrades);
      skills[id] = {
        ready: skillUnlocked(id, chapter) && remain <= 0,
        remain,
        total,
      };
    }
    const bossEnemy = this.enemies.find((e) => e.boss && !e.dead);
    const kind = raidKindFor(this.save.raidIndex);
    return {
      resources: { ...this.save.resources },
      income: passiveIncome(this.save),
      chapter,
      chapterName: chapterDef(chapter).name,
      chapterTag: chapterDef(chapter).tag,
      raidIndex: this.save.raidIndex,
      raidTotal: 6,
      raidKind: kind,
      raidPhase: this.raidPhase,
      phaseTimer: Math.max(0, this.phaseTimer),
      enemiesAlive: this.enemies.filter((e) => !e.dead).length,
      spawnLeft: this.spawnQueue.length,
      boss: bossEnemy
        ? { name: bossEnemy.name, hp: bossEnemy.hp, max: bossEnemy.maxHp, phase: bossEnemy.phase }
        : null,
      claimTokens: this.save.claimTokens,
      towerCount: Object.keys(this.save.towers).length,
      resonance: resonanceActive(this.save),
      activeCommander: this.save.activeCommander,
      skills,
      paused: useUI.getState().modal !== 'none',
      fps: this.fps,
      killed: this.save.stats.kills,
      cards: this.save.cards.length,
      trophy: this.save.prestige.count,
    };
  }

  private sync() {
    const hud = this.updateHud();
    const clone =
      typeof structuredClone === 'function'
        ? structuredClone(this.save)
        : (JSON.parse(JSON.stringify(this.save)) as SaveState);
    useUI.getState().setSnapshot(hud, clone);
  }

  private persist() {
    if (this.offlinePending) return;
    this.save.lastSeen = Date.now();
    saveToDisk(this.save);
  }

  private screenX(wx: number) {
    return this.camX + wx * this.camScale;
  }

  private screenY(wy: number) {
    return this.camY + wy * this.camScale;
  }

  private getTowerStats(towerId: string): TowerComputed {
    const tower = this.save.towers[towerId];
    if (!tower) {
      return {
        damage: 0,
        interval: 1,
        range: 0,
        dps: 0,
        auraRate: 0,
        buff: 0,
        slow: 0,
        stun: 0,
        splash: 0,
        cardSlots: 1,
      };
    }
    let amp = 0;
    let rate = 0;
    const cell = WORLD_CELLS.get(tower.cell);
    if (cell) {
      for (const other of Object.values(this.save.towers)) {
        if (other.id === tower.id) continue;
        const oc = WORLD_CELLS.get(other.cell);
        if (!oc) continue;
        const def = TOWERS[other.type];
        const st = computeTower(other, towerCtx(this.save));
        if (dist2(cell.x, cell.y, oc.x, oc.y) > st.range * st.range) continue;
        if (def.projectile === 'amp') amp += st.buff;
        if (def.auraRate) rate += st.auraRate;
      }
    }
    return computeTower(tower, { ...towerCtx(this.save), ampBuff: amp, rateBuff: rate });
  }

  private finishRaid() {
    if (this.finishing) return;
    this.finishing = true;
    const kind = raidKindFor(this.save.raidIndex);
    const ratio = clamp(this.raidKills / Math.max(1, this.raidTotal), 0, 1);
    const baseMetal = (24 + this.save.chapter * 16 + this.save.raidIndex * 7) * (0.35 + ratio * 0.8);
    this.save.resources.metal += baseMetal;
    this.save.stats.metalEarned += baseMetal;
    this.save.stats.raidsCleared++;
    const gotToken = ratio >= 0.6;
    if (gotToken) this.save.claimTokens += kind === 'boss' ? 2 : 1;
    if (kind === 'elite') {
      const crystal = 3 + this.save.chapter * 2;
      this.save.resources.crystal += crystal;
      this.save.raidIndex = Math.min(RAID_PER_CHAPTER - 1, this.save.raidIndex + 1);
      useUI.getState().toast(`RAID ELITE HOÀN TẤT — +${crystal} tinh thể${gotToken ? ' · +1 điểm mở rộng' : ''}`, 'good');
    } else if (kind === 'boss') {
      if (this.bossDefeated) {
        this.save.resources.tech += 1;
        const crystal = 18 + this.save.chapter * 6;
        this.save.resources.crystal += crystal;
        const card = this.grantCard('rare');
        useUI.getState().toast(`BOSS HẠ GỤC — +1 Công nghệ Alien · +${crystal} tinh thể · Thẻ ${RARITY_LABEL[card.rarity]}`, 'good');
        this.save.chapter++;
        this.save.stats.bestChapter = Math.max(this.save.stats.bestChapter, this.save.chapter);
        this.save.raidIndex = 0;
        assignSectors(WORLD_CELLS, new Set(this.save.claimed), sectorCountFor(this.save.chapter));
        const ch = chapterDef(this.save.chapter);
        useUI.getState().toast(`VÒNG ${this.save.chapter} MỞ KHÓA — ${ch.name}`, 'good');
        if (ch.unlock) useUI.getState().toast(`MỞ KHÓA: ${ch.unlock}`, 'info');
        if (this.save.chapter >= 4 && !this.save.commanders.includes('engineer')) {
          this.save.commanders.push('engineer');
          useUI.getState().toast('CHỈ HUY MỚI: Kỹ Sư Trưởng', 'good');
        }
        this.vfx.add('level', this.screenX(0), this.screenY(0), { scale: 0.75, light: 0.9 });
        this.flashScreen(0xffcf6b, 0.1);
        this.rebuildMap();
      } else {
        useUI.getState().toast('BOSS ĐÃ LỌT — raid boss sẽ lặp lại. Hãy gia cố đội hình.', 'bad');
      }
    } else {
      this.save.raidIndex = Math.min(RAID_PER_CHAPTER - 1, this.save.raidIndex + 1);
      useUI.getState().toast(
        `RAID HOÀN TẤT — +${Math.floor(baseMetal)} mảnh kim loại${gotToken ? ' · +1 điểm mở rộng' : ' · lọt quá nhiều, không có điểm mở rộng'}`,
        gotToken ? 'good' : 'warn',
      );
    }
    if (!gotToken && kind !== 'boss') {
      useUI.getState().toast('Ít nhất 60% địch phải bị hạ để nhận điểm mở rộng.', 'warn');
    }
    this.raidKills = 0;
    this.raidTotal = 0;
    this.raidSpawned = 0;
    this.spawnQueue = [];
    this.raidPhase = 'prep';
    this.phaseTimer = kind === 'boss' ? RAID_BOSS_PREP_SECONDS : RAID_PREP_SECONDS;
    this.refreshClaimHighlights();
    this.finishing = false;
    this.raidIndex = this.save.raidIndex;
    this.sync();
    this.persist();
  }

  private grantCard(minRarity?: Rarity): CardInstance {
    const defs = Object.keys(CARD_DEFS);
    const defId = defs[Math.floor(Math.random() * defs.length)];
    let rank = 0;
    const roll = Math.random();
    const chapter = this.save.chapter;
    const common = clamp(62 - chapter * 4, 26, 62);
    const rare = clamp(26 + chapter * 2, 26, 38);
    const epic = clamp(9 + chapter * 1.6, 9, 26);
    if (roll < epic) rank = 2;
    else if (roll < epic + rare) rank = 1;
    if (minRarity === 'rare' && rank < 1) rank = 1;
    if (minRarity === 'epic' && rank < 2) rank = 2;
    if (rank === 2 && Math.random() < 0.14 + chapter * 0.012) rank = 3;
    const card: CardInstance = {
      id: `c${this.save.nextCardId++}`,
      defId,
      rarity: RARITY_ORDER[Math.min(3, rank)],
    };
    this.save.cards.push(card);
    return card;
  }

  private flashScreen(color: number, alpha: number) {
    this.flashColor = color;
    this.flashGfx.clear();
    this.flashGfx.rect(0, 0, this.w, this.h).fill({ color, alpha: 1 });
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
    this.flashGfx.alpha = this.flashAlpha;
  }

  private onPointerMove = (ev: PointerEvent) => {
    const sp = this.clientToScreen(ev.clientX, ev.clientY);
    if (this.pointers.has(ev.pointerId)) this.pointers.set(ev.pointerId, sp);
    const p = this.screenToWorld(sp.x, sp.y);
    this.aimPos.x = p.x;
    this.aimPos.y = p.y;
    if (this.pinch) {
      this.updatePinch();
      return;
    }
    if (!this.drag || this.drag.id !== ev.pointerId) return;
    const dx = sp.x - this.drag.sx;
    const dy = sp.y - this.drag.sy;
    if (!this.drag.moved && Math.hypot(dx, dy) < 7) return;
    this.drag.moved = true;
    this.camReturning = false;
    this.camX = this.drag.camX + dx;
    this.camY = this.drag.camY + dy;
    this.clampCamera();
  };

  private onPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    const sp = this.clientToScreen(ev.clientX, ev.clientY);
    if (this.pointers.size === 0) this.suppressTap = false;
    this.pointers.set(ev.pointerId, sp);
    this.camReturning = false;
    try {
      this.app.canvas.setPointerCapture(ev.pointerId);
    } catch {
      // Pointer capture is best-effort; touch still works without it.
    }
    if (this.pointers.size >= 2) {
      this.beginPinch();
      return;
    }
    this.drag = {
      id: ev.pointerId,
      sx: sp.x,
      sy: sp.y,
      camX: this.camX,
      camY: this.camY,
      moved: false,
    };
  };

  private onPointerUp = (ev: PointerEvent) => {
    this.pointers.delete(ev.pointerId);
    try {
      this.app.canvas.releasePointerCapture(ev.pointerId);
    } catch {
      // Ignore release errors when capture was not established.
    }
    if (this.pinch) {
      this.pinch = null;
      this.drag = null;
      if (this.pointers.size >= 2) {
        this.beginPinch();
      } else if (this.pointers.size === 1) {
        const [id, sp] = [...this.pointers.entries()][0];
        this.drag = { id, sx: sp.x, sy: sp.y, camX: this.camX, camY: this.camY, moved: true };
      }
      if (this.pointers.size === 0) this.suppressTap = false;
      return;
    }
    const drag = this.drag;
    if (!drag || drag.id !== ev.pointerId) return;
    this.drag = null;
    if (!drag.moved && !this.suppressTap) this.handleTap(ev);
    if (this.pointers.size === 0) this.suppressTap = false;
  };

  private onPointerCancel = (ev: PointerEvent) => {
    this.pointers.delete(ev.pointerId);
    if (this.pinch) {
      this.pinch = null;
      this.drag = null;
      if (this.pointers.size >= 2) this.beginPinch();
    } else if (this.drag?.id === ev.pointerId) {
      this.drag = null;
    }
    if (this.pointers.size === 0) this.suppressTap = false;
  };

  private onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const sp = this.clientToScreen(ev.clientX, ev.clientY);
    this.zoomAtScreen(sp.x, sp.y, Math.exp(-ev.deltaY * 0.0016));
  };

  private beginPinch() {
    const points = [...this.pointers.values()];
    const a = points[0];
    const b = points[1];
    if (!a || !b) return;
    this.pinch = {
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      scale: this.camScale,
      camX: this.camX,
      camY: this.camY,
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
    };
    this.drag = null;
    this.camReturning = false;
    this.suppressTap = true;
  }

  private updatePinch() {
    const pinch = this.pinch;
    const points = [...this.pointers.values()];
    const a = points[0];
    const b = points[1];
    if (!pinch || !a || !b) return;
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const next = clamp((pinch.scale * dist) / pinch.dist, MIN_CAM_SCALE, MAX_CAM_SCALE);
    const wx = (pinch.midX - pinch.camX) / pinch.scale;
    const wy = (pinch.midY - pinch.camY) / pinch.scale;
    this.camScale = next;
    this.camX = midX - wx * next;
    this.camY = midY - wy * next;
    this.clampCamera();
  }

  private handleTap(ev: PointerEvent) {
    const p = this.toWorld(ev);
    const aiming = useUI.getState().aiming;
    if (aiming === 'orbital') {
      this.castSkill('orbital', p.x, p.y);
      useUI.getState().setAiming(null);
      return;
    }
    const cell = this.findCell(p.x, p.y);
    if (!cell) {
      useUI.getState().setSelection(null);
      return;
    }
    const claimed = new Set(this.save.claimed);
    if (!claimed.has(cell.key)) {
      if (this.claimable.has(cell.key)) {
        if (this.save.claimTokens <= 0) {
          useUI.getState().toast('Cần 1 điểm mở rộng — dọn raid để nhận.', 'warn');
          return;
        }
        this.claimCell(cell.key);
      } else {
        useUI.getState().toast('Ngoài biên giới — mở rộng lãnh thổ tới gần trước.', 'info');
      }
      return;
    }
    if (cell.kind === 'chest' && !this.save.openedChests.includes(cell.key)) {
      this.openChest(cell);
      return;
    }
    useUI.getState().setSelection(cell.key);
  }

  private clientToScreen(clientX: number, clientY: number) {
    const rect = this.app.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.w,
      y: ((clientY - rect.top) / rect.height) * this.h,
    };
  }

  private screenToWorld(x: number, y: number) {
    return { x: (x - this.camX) / this.camScale, y: (y - this.camY) / this.camScale };
  }

  private toWorld(ev: PointerEvent) {
    const s = this.clientToScreen(ev.clientX, ev.clientY);
    return this.screenToWorld(s.x, s.y);
  }

  private findCell(x: number, y: number) {
    let best: CellDef | null = null;
    let bestD = (HEX_SIZE * 1.02) ** 2;
    for (const cell of WORLD_CELLS.values()) {
      const d = dist2(x, y, cell.x, cell.y);
      if (d < bestD) {
        bestD = d;
        best = cell;
      }
    }
    return best;
  }

  claimCell(key: string) {
    const cell = WORLD_CELLS.get(key);
    if (!cell || !this.claimable.has(key) || this.save.claimTokens <= 0) return false;
    if (this.save.claimed.includes(key)) return false;
    this.save.claimed.push(key);
    this.save.claimTokens--;
    this.rebuildMap();
    this.vfx.add('burst', this.screenX(cell.x), this.screenY(cell.y), { scale: 0.5, light: 0.8 });
    useUI.getState().toast(`MỞ RỘNG +1 Ô — ${cell.kind === 'mine' ? 'Mỏ khoáng' : cell.kind === 'chest' ? 'Rương tiếp tế' : cell.kind === 'slot' ? 'Ô đặt trụ' : 'Ô trung chuyển'}`, 'good');
    this.sync();
    this.persist();
    if (cell.kind === 'slot') {
      useUI.getState().setSelection(cell.key);
    } else if (cell.kind === 'chest') {
      this.schedule(0.35, () => this.openChest(cell));
    }
    return true;
  }

  buildTower(cellKey: string, type: TowerType) {
    const cell = WORLD_CELLS.get(cellKey);
    const def = TOWERS[type];
    if (!cell || cell.kind !== 'slot' || !this.save.claimed.includes(cellKey)) return false;
    if (this.towerByCell.has(cellKey)) {
      useUI.getState().toast('Ô này đã có trụ.', 'warn');
      return false;
    }
    if (this.save.chapter < def.unlockChapter) {
      useUI.getState().toast(`Mở khóa ở Vòng ${def.unlockChapter}.`, 'warn');
      return false;
    }
    if (this.save.resources.metal < def.cost) {
      useUI.getState().toast('Không đủ mảnh kim loại.', 'warn');
      return false;
    }
    this.save.resources.metal -= def.cost;
    const tower: TowerSave = {
      id: `t${this.save.nextTowerId++}`,
      type,
      cell: cellKey,
      level: 1,
      tier: 0,
      cards: [],
    };
    this.save.towers[tower.id] = tower;
    this.rebuildTowerIndex();
    this.createTowerView(tower);
    this.rebuildMap();
    this.vfx.add('burst', this.screenX(cell.x), this.screenY(cell.y), { scale: 0.55, palette: PAL.kinetic, light: 0.9 });
    this.addSparks(cell.x, cell.y, 6, TOWER_ACCENT[type], 30);
    if (!this.save.tutorial.done && this.save.tutorial.step === 0) {
      this.save.tutorial.step = 1;
      useUI.getState().toast('HƯỚNG DẪN: chạm trụ vừa đặt và nâng cấp lên Cấp 2.', 'info');
    }
    if (this.raidPhase === 'prep') this.phaseTimer = Math.min(this.phaseTimer, 4);
    useUI.getState().setSelection(null);
    this.sync();
    this.persist();
    return true;
  }

  upgradeTower(towerId: string) {
    const tower = this.save.towers[towerId];
    if (!tower) return false;
    if (tower.level >= MAX_TOWER_LEVEL) {
      useUI.getState().toast('Trụ đã đạt cấp tối đa.', 'warn');
      return false;
    }
    const cost = towerUpgradeCost(tower);
    if (this.save.resources.metal < cost) {
      useUI.getState().toast('Không đủ mảnh kim loại.', 'warn');
      return false;
    }
    this.save.resources.metal -= cost;
    tower.level++;
    if (tower.level >= 2) this.save.tutorial.upgraded = true;
    const view = this.towerViews.get(towerId);
    if (view) view.pop = 0.6;
    this.vfx.add('burst', this.screenX(WORLD_CELLS.get(tower.cell)?.x ?? 0), this.screenY(WORLD_CELLS.get(tower.cell)?.y ?? 0), {
      scale: 0.42,
      palette: PAL.energy,
      light: 0.7,
    });
    if (!this.save.tutorial.done && this.save.tutorial.step === 1 && tower.level >= 2) {
      this.save.tutorial.step = 2;
      this.save.tutorial.upgraded = true;
      useUI.getState().toast('HƯỚNG DẪN: dùng Oanh Kích Quỹ Đạo khi raid đông.', 'info');
    }
    this.sync();
    this.persist();
    return true;
  }

  evolveTower(towerId: string) {
    const tower = this.save.towers[towerId];
    if (!tower) return false;
    if (tower.tier > 0) {
      useUI.getState().toast('Trụ đã Evolve.', 'warn');
      return false;
    }
    if (tower.level < EVOLVE_LEVEL) {
      useUI.getState().toast(`Cần Cấp ${EVOLVE_LEVEL} để Evolve.`, 'warn');
      return false;
    }
    if (this.save.chapter < 5) {
      useUI.getState().toast('Tier/Evolve mở khóa ở Vòng 5.', 'warn');
      return false;
    }
    const cost = towerEvolveCost(tower);
    if (this.save.resources.tech < 1) {
      useUI.getState().toast('Cần 1 Công nghệ Alien từ boss để Tiến hóa.', 'warn');
      return false;
    }
    if (this.save.resources.crystal < cost) {
      useUI.getState().toast(`Cần ${cost} tinh thể năng lượng.`, 'warn');
      return false;
    }
    this.save.resources.tech -= 1;
    this.save.resources.crystal -= cost;
    tower.tier = 1;
    const view = this.towerViews.get(towerId);
    if (view) {
      view.base.tint = 0xffefc9;
      view.turret.tint = 0xffefc9;
      view.pop = 1;
    }
    const cell = WORLD_CELLS.get(tower.cell);
    this.vfx.add('level', this.screenX(cell?.x ?? 0), this.screenY(cell?.y ?? 0), { scale: 0.62, light: 0.9 });
    useUI.getState().toast('TRỤ ĐÃ EVOLVE — hình dạng và hiệu ứng mới', 'good');
    this.sync();
    this.persist();
    return true;
  }

  dismantleTower(towerId: string) {
    const tower = this.save.towers[towerId];
    if (!tower) return false;
    const def = TOWERS[tower.type];
    let refund = def.cost * 0.5;
    for (let lvl = 1; lvl < tower.level; lvl++) refund += (def.cost * 0.72 * Math.pow(1.56, lvl - 1)) * 0.35;
    this.save.resources.metal += refund;
    this.removeTower(towerId);
    this.rebuildMap();
    useUI.getState().setSelection(null);
    useUI.getState().toast(`THU HỒI TRỤ — +${Math.floor(refund)} mảnh kim loại`, 'info');
    this.sync();
    this.persist();
    return true;
  }

  private openChest(cell: CellDef) {
    if (this.save.openedChests.includes(cell.key)) return;
    this.save.openedChests.push(cell.key);
    const ring = cell.ring;
    const metal = Math.round(55 + ring * 34 + this.save.chapter * 12);
    const crystal = Math.round((2 + ring * 2.2 + this.save.chapter * 0.8) * 10) / 10;
    this.save.resources.metal += metal;
    this.save.resources.crystal += crystal;
    this.save.stats.metalEarned += metal;
    const count = ring >= 4 ? 2 : 1;
    const cards: { name: string; rarity: string; desc: string }[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.grantCard();
      const def = CARD_DEFS[card.defId];
      cards.push({ name: def.name, rarity: RARITY_LABEL[card.rarity], desc: def.desc });
    }
    this.vfx.add('chest', this.screenX(cell.x), this.screenY(cell.y), { scale: 0.75, light: 1 });
    this.rebuildMap();
    this.sync();
    this.persist();
    useUI.getState().setChest({ cell: cell.key, metal, crystal, cards });
    useUI.getState().openModal('chest');
  }

  castSkill(skill: SkillId, x?: number, y?: number) {
    const def = SKILLS[skill];
    if (!skillUnlocked(skill, this.save.chapter)) {
      useUI.getState().toast(`Mở khóa ở Vòng ${def.unlock}.`, 'warn');
      return false;
    }
    if (Date.now() < this.save.skills[skill].cooldownEnd) {
      useUI.getState().toast('Kỹ năng đang hồi chiêu.', 'warn');
      return false;
    }
    if (skill === 'orbital' && (x == null || y == null)) return false;
    const cd = def.cooldown * cooldownMult(this.save.prestige.upgrades);
    this.save.skills[skill].cooldownEnd = Date.now() + cd * 1000;
    this.save.tutorial.usedSkill = true;
    if (!this.save.tutorial.done && this.save.tutorial.step === 2) {
      this.save.tutorial.step = 3;
      this.save.tutorial.done = true;
      useUI.getState().toast('Hướng dẫn hoàn tất — chúc may mắn, Chỉ huy.', 'good');
    }

    if (skill === 'orbital' && x != null && y != null) {
      const damage = 150 * (1 + 0.4 * (this.save.chapter - 1)) * prestigeDamageMult(this.save.prestige.upgrades);
      this.vfx.add('orbital', this.screenX(x), this.screenY(y), { scale: 1, light: 1.1 });
      this.schedule(0.8, () => {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - x, e.y - y);
          if (d > 110 + e.size) continue;
          this.damageEnemy(e, damage * (1 - 0.35 * Math.min(1, d / 110)), 'kinetic', true, Object.values(this.save.towers)[0] ?? ({} as TowerSave), this.emptyStats(), false);
        }
        this.addRing(x, y, 6, 110, 0.6, 0xff7a3c, 3);
        this.addSparks(x, y, 20, 0xffb07a, 100);
        this.flashScreen(0xff7a3c, 0.16);
        this.shake = 0.9;
      });
      useUI.getState().toast('OANH KÍCH QUỸ ĐẠO — đã khóa mục tiêu', 'info');
    } else if (skill === 'emp') {
      const damage = 8 * (1 + 0.4 * (this.save.chapter - 1));
      for (const e of this.enemies) {
        if (e.dead) continue;
        e.shield = 0;
        e.stunUntil = Math.max(e.stunUntil, this.time + 2.5);
        e.revealedUntil = Math.max(e.revealedUntil, this.time + 4);
        this.damageEnemy(e, damage, 'tech', true, Object.values(this.save.towers)[0] ?? ({} as TowerSave), this.emptyStats(), false);
      }
      this.vfx.add('emp', this.screenX(0), this.screenY(0), { scale: 1.05, palette: PAL.tech, light: 1 });
      this.flashScreen(0xa86bff, 0.12);
      this.shake = 0.6;
      useUI.getState().toast('EMP TOÀN VÀNH ĐAI — khiên bị xóa, địch choáng 2.5s', 'good');
    } else if (skill === 'shield') {
      this.shieldUntil = this.time + 8;
      this.vfx.add('shield', this.screenX(0), this.screenY(0), { scale: 0.9, palette: PAL.energy, light: 0.9 });
      this.addRing(0, 0, 20, 120, 0.7, 0x35e0e8, 3);
      this.flashScreen(0x35e0e8, 0.08);
      useUI.getState().toast('KHIÊN KHẨN CẤP — chặn toàn bộ quái lọt trong 8 giây', 'good');
    }
    this.sync();
    this.persist();
    return true;
  }

  private emptyStats(): TowerComputed {
    return { damage: 0, interval: 1, range: 0, dps: 0, auraRate: 0, buff: 0, slow: 0, stun: 0, splash: 0, cardSlots: 1 };
  }

  equipCard(towerId: string, cardId: string) {
    const tower = this.save.towers[towerId];
    const card = this.save.cards.find((c) => c.id === cardId);
    if (!tower || !card) return false;
    if (tower.cards.includes(cardId)) return false;
    if (this.save.towers && Object.values(this.save.towers).some((t) => t.cards.includes(cardId))) {
      useUI.getState().toast('Thẻ đã được gắn vào trụ khác.', 'warn');
      return false;
    }
    const slots = 1 + (tower.tier > 0 ? 1 : 0);
    if (tower.cards.length >= slots) {
      useUI.getState().toast('Ô thẻ đã đầy — gỡ một thẻ trước.', 'warn');
      return false;
    }
    tower.cards.push(cardId);
    this.sync();
    this.persist();
    return true;
  }

  unequipCard(towerId: string, cardId: string) {
    const tower = this.save.towers[towerId];
    if (!tower) return false;
    tower.cards = tower.cards.filter((id) => id !== cardId);
    this.sync();
    this.persist();
    return true;
  }

  mergeCards(defId: string, rarity: Rarity) {
    if (rarity === 'legendary') {
      useUI.getState().toast('Thẻ Huyền thoại không thể hợp nhất thêm.', 'warn');
      return false;
    }
    const equipped = new Set<string>();
    for (const t of Object.values(this.save.towers)) for (const id of t.cards) equipped.add(id);
    const matches = this.save.cards.filter((c) => c.defId === defId && c.rarity === rarity && !equipped.has(c.id));
    if (matches.length < 3) {
      useUI.getState().toast('Cần 3 thẻ cùng loại (chưa gắn) để hợp nhất.', 'warn');
      return false;
    }
    const remove = new Set(matches.slice(0, 3).map((c) => c.id));
    this.save.cards = this.save.cards.filter((c) => !remove.has(c.id));
    const next = RARITY_ORDER[RARITY_ORDER.indexOf(rarity) + 1];
    const card: CardInstance = { id: `c${this.save.nextCardId++}`, defId, rarity: next };
    this.save.cards.push(card);
    useUI.getState().toast(`HỢP NHẤT THẺ — nhận ${RARITY_LABEL[next]} ${CARD_DEFS[defId].name}`, 'good');
    this.sync();
    this.persist();
    return true;
  }

  setSetting(key: 'showRanges' | 'sound', value: boolean) {
    this.save.settings[key] = value;
    this.sync();
    this.persist();
    return true;
  }

  setCommander(id: CommanderId) {
    if (!this.save.commanders.includes(id)) {
      useUI.getState().toast('Chỉ huy chưa được mở khóa.', 'warn');
      return false;
    }
    this.save.activeCommander = id;
    this.sync();
    this.persist();
    useUI.getState().toast(`CHỈ HUY: ${COMMANDERS[id].name} — ${COMMANDERS[id].aura}`, 'info');
    return true;
  }

  buyPrestigeNode(id: PrestigeNodeId) {
    const level = this.save.prestige.upgrades[id];
    const def = PRESTIGE_NODES[id];
    if (level >= def.max) {
      useUI.getState().toast('Nút này đã đạt cấp tối đa.', 'warn');
      return false;
    }
    const cost = prestigeNodeCost(id, level);
    if (this.save.resources.essence < cost) {
      useUI.getState().toast(`Cần ${cost} Tinh hoa Vành Đai.`, 'warn');
      return false;
    }
    this.save.resources.essence -= cost;
    this.save.prestige.essence = this.save.resources.essence;
    this.save.prestige.upgrades[id]++;
    if (id === 'offline') {
      // cap is read live from prestige upgrades
    }
    this.sync();
    this.persist();
    useUI.getState().toast(`NÂNG CẤP PRESTIGE: ${def.name} Cấp ${level + 1}`, 'good');
    return true;
  }

  prestigePreview() {
    const gain = prestigeGain(
      this.save.chapter,
      this.save.raidIndex,
      this.save.claimed.length,
      totalTowerLevels(this.save),
      this.save.prestige.count,
    );
    return {
      gain,
      can: this.save.chapter >= 3 && gain > 0,
      chapter: this.save.chapter,
      claimed: this.save.claimed.length,
      towerLevels: totalTowerLevels(this.save),
    };
  }

  doPrestige() {
    const preview = this.prestigePreview();
    if (!preview.can) {
      useUI.getState().toast('Cần đạt Vòng 3 và có tiến độ để Tái thiết.', 'warn');
      return false;
    }
    const old = this.save;
    const fresh = newSave();
    fresh.createdAt = old.createdAt;
    fresh.lastSeen = Date.now();
    fresh.playTime = old.playTime;
    fresh.cards = old.cards;
    fresh.nextCardId = old.nextCardId;
    fresh.nextTowerId = old.nextTowerId;
    fresh.prestige = {
      essence: old.prestige.essence + preview.gain,
      count: old.prestige.count + 1,
      upgrades: { ...old.prestige.upgrades },
    };
    fresh.resources.essence = fresh.prestige.essence;
    fresh.resources.metal = Math.floor(170 * salvageMult(fresh.prestige.upgrades));
    fresh.commanders = [...old.commanders];
    if (!fresh.commanders.includes('warden')) fresh.commanders.push('warden');
    fresh.activeCommander = old.activeCommander;
    fresh.settings = { ...old.settings };
    fresh.tutorial = { step: 3, done: true, upgraded: true, usedSkill: true };
    fresh.stats = { ...old.stats, prestiges: old.stats.prestiges + 1, bestChapter: old.stats.bestChapter };
    this.save = fresh;
    this.offlineReport = null;
    this.offlinePending = false;
    this.enemies = [];
    this.projectiles = [];
    this.sparks = [];
    this.tracers = [];
    this.rings = [];
    this.scheduled = [];
    for (const view of this.towerViews.values()) view.container.destroy({ children: true });
    this.towerViews.clear();
    this.towerRuntime.clear();
    this.towerByCell.clear();
    for (const view of this.enemyViews.values()) view.container.destroy({ children: true });
    this.enemyViews.clear();
    this.nextEnemyId = 1;
    this.raidIndex = 0;
    this.raidPhase = 'prep';
    this.phaseTimer = FIRST_RAID_PREP_SECONDS;
    this.raidTotal = 0;
    this.maxRing = 1;
    this.save.lastSeen = Date.now();
    assignSectors(WORLD_CELLS, new Set(this.save.claimed), sectorCountFor(this.save.chapter));
    this.rebuildMap();
    this.vfx.add('level', this.screenX(0), this.screenY(0), { scale: 0.9, light: 1 });
    this.vfx.add('shield', this.screenX(0), this.screenY(0), { scale: 0.9, palette: PAL.gold, light: 0.8 });
    this.flashScreen(0xffcf6b, 0.16);
    useUI.getState().closeModal();
    useUI.getState().toast(`TÁI THIẾT VÀNH ĐAI — +${preview.gain} Tinh hoa Vành Đai`, 'good');
    this.sync();
    this.persist();
    return true;
  }

  claimOffline() {
    if (!this.offlineReport) return false;
    const r = this.offlineReport;
    this.save.resources.metal += r.metal;
    this.save.resources.crystal += r.crystal;
    this.save.stats.metalEarned += r.metal;
    this.offlineReport = null;
    this.offlinePending = false;
    this.save.lastSeen = Date.now();
    useUI.getState().setOffline(null);
    useUI.getState().closeModal();
    useUI.getState().toast(
      `ĐÃ NHẬN TIẾP TẾ — +${fmt(r.metal)} kim loại · +${fmt(r.crystal)} tinh thể`,
      'good',
    );
    this.sync();
    this.persist();
    return true;
  }

  forceSave() {
    this.persist();
    useUI.getState().toast('Đã lưu tiến độ.', 'info');
  }

  debugAdd() {
    this.save.resources.metal += 5000;
    this.save.resources.crystal += 300;
    this.save.resources.tech += 15;
    this.save.claimTokens += 3;
    this.refreshClaimHighlights();
    this.sync();
    this.persist();
    useUI.getState().toast('DEV: +5000 kim loại, +300 tinh thể, +15 công nghệ, +3 điểm mở rộng', 'info');
  }

  debugKillAll() {
    for (const e of this.enemies) {
      if (!e.dead) this.killEnemy(e);
    }
    this.sync();
  }

  debugAdvance() {
    this.save.chapter++;
    this.save.raidIndex = 0;
    this.raidIndex = 0;
    this.save.stats.bestChapter = Math.max(this.save.stats.bestChapter, this.save.chapter);
    assignSectors(WORLD_CELLS, new Set(this.save.claimed), sectorCountFor(this.save.chapter));
    if (this.save.chapter >= 4 && !this.save.commanders.includes('engineer')) this.save.commanders.push('engineer');
    this.enemies = [];
    for (const view of this.enemyViews.values()) view.container.destroy({ children: true });
    this.enemyViews.clear();
    this.projectiles = [];
    this.spawnQueue = [];
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.raidPhase = 'prep';
    this.phaseTimer = 4;
    this.rebuildMap();
    this.sync();
    this.persist();
    useUI.getState().toast(`DEV: chuyển tới Vòng ${this.save.chapter}`, 'info');
  }

  debugShield() {
    this.shieldUntil = this.time + 30;
    this.sync();
    useUI.getState().toast('DEV: khiên khẩn cấp bật 30 giây', 'info');
  }

  private onVisibility = () => {
    if (document.hidden) {
      this.persist();
      return;
    }
    if (this.offlinePending) return;
    const report = computeOfflineReport(this.save);
    if (report) {
      this.offlineReport = report;
      this.offlinePending = true;
      useUI.getState().setOffline(report);
      useUI.getState().openModal('offline');
      this.sync();
    }
  };

  private onUnload = () => {
    this.persist();
  };
}

export const startGame = async (host: HTMLElement) => {
  const game = await BeltGame.create(host);
  (window as unknown as { beltGame?: BeltGame }).beltGame = game;
  return game;
};

export const resetAll = () => {
  clearSave();
  window.location.reload();
};

export const chapterList = CHAPTERS;
export const towerList = TOWER_LIST;
export const enemyList = Object.values(ENEMIES);
export const commanderList = COMMANDERS;
export const skillList = SKILLS;
export const prestigeNodeList = PRESTIGE_NODES;
