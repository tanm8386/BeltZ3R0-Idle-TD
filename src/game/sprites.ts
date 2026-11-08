import { Texture } from 'pixi.js';
import type { EnemyKind, TowerType } from './types';

const TAU = Math.PI * 2;

const makeTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  draw(g);
  const t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  return t;
};

const hash = (x: number, y: number, s = 1) => {
  let h = (x * 374761393 + y * 668265263 + s * 1442695040) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const polys = (g: CanvasRenderingContext2D, pts: [number, number][], fill: string) => {
  g.fillStyle = fill;
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  g.fill();
};

const rect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

const circle = (g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) => {
  g.fillStyle = c;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
};

const towerPalette = {
  kinetic: { dark: '#1d232a', base: '#343e47', metal: '#626f79', light: '#9aa7ae', accent: '#ff7a3c', glow: '#ffd0a8' },
  energy: { dark: '#12262e', base: '#24414c', metal: '#477887', light: '#8ee9f1', accent: '#35e0e8', glow: '#d4ffff' },
  tech: { dark: '#1d1531', base: '#33264e', metal: '#644c91', light: '#c3a4ff', accent: '#a86bff', glow: '#ead9ff' },
  support: { dark: '#2b2414', base: '#4a3f25', metal: '#817446', light: '#ffe6a4', accent: '#f2d98a', glow: '#fff4cf' },
};

const towerSystem: Record<TowerType, keyof typeof towerPalette> = {
  railgun: 'kinetic',
  flak: 'kinetic',
  laser: 'energy',
  plasma: 'energy',
  emp: 'tech',
  hack: 'tech',
  repair: 'support',
  amp: 'support',
};

const baseTex = (system: keyof typeof towerPalette) => {
  const P = towerPalette[system];
  return makeTex(32, 30, (g) => {
    g.globalAlpha = 0.45;
    circle(g, 16, 25, 11, '#000000');
    g.globalAlpha = 1;
    // legs
    rect(g, 5, 22, 4, 5, P.dark);
    rect(g, 23, 22, 4, 5, P.dark);
    rect(g, 10, 24, 12, 4, P.dark);
    // platform
    polys(g, [[16, 8], [29, 15], [29, 21], [16, 28], [3, 21], [3, 15]], P.base);
    polys(g, [[16, 10], [27, 16], [27, 20], [16, 26], [5, 20], [5, 16]], P.dark);
    rect(g, 6, 17, 3, 4, P.metal);
    rect(g, 23, 17, 3, 4, P.metal);
    rect(g, 14, 12, 4, 3, P.metal);
    rect(g, 4, 20, 2, 2, P.accent);
    rect(g, 26, 20, 2, 2, P.accent);
    rect(g, 15, 24, 2, 2, P.light);
    // rivets
    rect(g, 8, 18, 1, 1, P.light);
    rect(g, 23, 18, 1, 1, P.light);
  });
};

const turretTex = (type: TowerType) => {
  const system = towerSystem[type];
  const P = towerPalette[system];
  return makeTex(34, 20, (g) => {
    circle(g, 9, 10, 6, P.dark);
    circle(g, 9, 10, 4, P.metal);
    rect(g, 7, 8, 4, 4, P.light);
    if (type === 'railgun') {
      rect(g, 12, 8, 18, 2, P.metal);
      rect(g, 12, 11, 18, 2, P.metal);
      rect(g, 12, 9, 17, 1, P.accent);
      rect(g, 12, 12, 17, 1, P.accent);
      rect(g, 28, 7, 4, 6, P.dark);
      rect(g, 30, 8, 2, 4, P.glow);
      rect(g, 10, 5, 3, 2, P.dark);
    } else if (type === 'flak') {
      rect(g, 12, 6, 14, 2, P.metal);
      rect(g, 12, 9, 16, 2, P.metal);
      rect(g, 12, 12, 14, 2, P.metal);
      rect(g, 25, 6, 3, 2, P.accent);
      rect(g, 27, 9, 3, 2, P.accent);
      rect(g, 25, 12, 3, 2, P.accent);
      rect(g, 10, 5, 4, 1, P.light);
    } else if (type === 'laser') {
      rect(g, 12, 8, 10, 4, P.dark);
      polys(g, [[20, 5], [30, 10], [20, 15]], P.metal);
      polys(g, [[23, 8], [28, 10], [23, 12]], P.accent);
      rect(g, 13, 9, 6, 2, P.light);
      rect(g, 30, 9, 2, 2, P.glow);
    } else if (type === 'plasma') {
      rect(g, 12, 7, 9, 6, P.dark);
      circle(g, 25, 10, 6, P.dark);
      circle(g, 25, 10, 4, P.metal);
      circle(g, 25, 10, 3, P.accent);
      circle(g, 25, 10, 1.5, P.glow);
      rect(g, 12, 9, 6, 2, P.light);
      rect(g, 31, 9, 2, 2, P.glow);
    } else if (type === 'emp') {
      rect(g, 12, 9, 8, 3, P.metal);
      rect(g, 18, 4, 2, 13, P.metal);
      rect(g, 20, 6, 7, 8, P.dark);
      rect(g, 21, 7, 5, 2, P.accent);
      rect(g, 21, 11, 5, 2, P.accent);
      rect(g, 22, 9, 3, 2, P.glow);
    } else if (type === 'hack') {
      rect(g, 12, 9, 5, 3, P.metal);
      rect(g, 17, 4, 2, 12, P.metal);
      rect(g, 19, 3, 5, 2, P.accent);
      rect(g, 21, 5, 5, 2, P.accent);
      rect(g, 22, 7, 4, 2, P.accent);
      rect(g, 23, 9, 2, 2, P.glow);
      rect(g, 18, 15, 2, 3, P.dark);
    } else if (type === 'repair') {
      rect(g, 12, 8, 8, 5, P.metal);
      rect(g, 17, 5, 3, 11, P.accent);
      rect(g, 14, 9, 11, 3, P.accent);
      rect(g, 21, 6, 5, 2, P.light);
      circle(g, 25, 10, 3, P.dark);
      circle(g, 25, 10, 1, P.glow);
    } else {
      rect(g, 12, 9, 6, 3, P.metal);
      rect(g, 17, 4, 2, 13, P.metal);
      circle(g, 25, 10, 7, P.dark);
      circle(g, 25, 10, 5, P.metal);
      circle(g, 25, 10, 3, P.accent);
      circle(g, 25, 10, 1, P.glow);
      rect(g, 27, 2, 2, 4, P.accent);
    }
  });
};

export const towerSprites = Object.fromEntries(
  (['railgun', 'flak', 'laser', 'plasma', 'emp', 'hack', 'repair', 'amp'] as TowerType[]).map((type) => {
    const system = towerSystem[type];
    return [type, { base: baseTex(system), turret: turretTex(type), system }];
  }),
) as Record<TowerType, { base: Texture; turret: Texture; system: keyof typeof towerPalette }>;

export const TOWER_ACCENT: Record<TowerType, number> = {
  railgun: 0xff7a3c,
  flak: 0xffa05f,
  laser: 0x35e0e8,
  plasma: 0x5af0ff,
  emp: 0xa86bff,
  hack: 0xc08bff,
  repair: 0xf2d98a,
  amp: 0xffe7a8,
};

const rock = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, cols: string[]) => {
  const pts: [number, number][] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (0.78 + hash(i, seed, 3) * 0.36);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  polys(g, pts, cols[0]);
  const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.66, cy + (y - cy) * 0.66] as [number, number]);
  polys(g, inner, cols[1]);
  for (let i = 0; i < 3; i++) {
    const x = cx + (hash(i, seed, 8) - 0.5) * r * 0.9;
    const y = cy + (hash(i, seed, 9) - 0.5) * r * 0.9;
    circle(g, x, y, 1 + hash(i, seed, 10) * 1.6, cols[2]);
  }
  // lit rim, top-left
  g.strokeStyle = cols[3];
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, r * 0.95, Math.PI * 0.95, Math.PI * 1.75);
  g.stroke();
};

const enemyTex = (kind: EnemyKind) => {
  if (kind === 'asteroid' || kind === 'splitter' || kind === 'shard' || kind === 'boss-asteroid') {
    const boss = kind === 'boss-asteroid';
    const size = boss ? 72 : kind === 'shard' ? 18 : kind === 'splitter' ? 38 : 34;
    return makeTex(size, size, (g) => {
      const c = boss
        ? ['#4a3021', '#6b472b', '#2c1d15', '#c98e57', '#ff7a3c']
        : kind === 'shard'
          ? ['#4a3a31', '#6b5648', '#2b211c', '#a58b76', '#ffb07a']
          : ['#4b382b', '#6a503b', '#2b211a', '#9c7d60', '#e0a06b'];
      const r = size * 0.36;
      rock(g, size / 2, size / 2 + 1, r, kind.length * 7, c);
      if (kind === 'splitter' || boss) {
        g.strokeStyle = c[4];
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(size / 2 - r * 0.5, size / 2 - r * 0.4);
        g.lineTo(size / 2 - 1, size / 2);
        g.lineTo(size / 2 - r * 0.2, size / 2 + r * 0.55);
        g.moveTo(size / 2 + 1, size / 2 - r * 0.1);
        g.lineTo(size / 2 + r * 0.55, size / 2 - r * 0.3);
        g.stroke();
      }
      if (boss) {
        for (let i = 0; i < 5; i++) circle(g, size / 2 + (hash(i, 3) - 0.5) * r, size / 2 + (hash(i, 4) - 0.5) * r, 1.5, '#ffb07a');
      }
    });
  }
  if (kind === 'scout' || kind === 'ship' || kind === 'boss-alien') {
    const boss = kind === 'boss-alien';
    const size = boss ? 76 : kind === 'ship' ? 44 : 30;
    return makeTex(size, size, (g) => {
      const body = boss ? '#3b2a63' : '#352b5c';
      const edge = boss ? '#8a6bff' : '#7b63d9';
      const light = boss ? '#ff6bd6' : '#b49aff';
      const cockpit = '#7ef6ff';
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.34;
      // wing silhouette
      polys(g, [[cx, cy - r], [cx + r * 1.05, cy + r * 0.35], [cx + r * 0.35, cy + r * 0.55], [cx, cy + r * 0.9], [cx - r * 0.35, cy + r * 0.55], [cx - r * 1.05, cy + r * 0.35]], body);
      polys(g, [[cx, cy - r * 0.75], [cx + r * 0.65, cy + r * 0.25], [cx, cy + r * 0.45], [cx - r * 0.65, cy + r * 0.25]], edge);
      circle(g, cx, cy - r * 0.05, r * 0.3, cockpit);
      circle(g, cx, cy - r * 0.05, r * 0.16, '#ffffff');
      rect(g, cx - r * 0.85, cy + r * 0.22, 3, 3, light);
      rect(g, cx + r * 0.72, cy + r * 0.22, 3, 3, light);
      if (boss) {
        rect(g, cx - r * 0.9, cy - r * 0.9, 2, 10, '#ff6bd6');
        rect(g, cx + r * 0.82, cy - r * 0.9, 2, 10, '#ff6bd6');
        circle(g, cx, cy + r * 0.5, 3, '#ff6bd6');
      }
    });
  }
  if (kind === 'spider') {
    return makeTex(28, 28, (g) => {
      const cx = 14;
      const cy = 14;
      g.strokeStyle = '#6fae5e';
      g.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const yy = 9 + i * 3;
        g.beginPath();
        g.moveTo(cx - 3, yy);
        g.lineTo(cx - 9 - (i % 2) * 2, yy - 4);
        g.moveTo(cx + 3, yy);
        g.lineTo(cx + 9 + (i % 2) * 2, yy - 4);
        g.stroke();
      }
      circle(g, cx, cy, 6, '#3f6f3a');
      circle(g, cx, cy - 1, 4, '#6fae5e');
      circle(g, cx - 2, cy - 2, 1, '#d6ff9c');
      circle(g, cx + 2, cy - 2, 1, '#d6ff9c');
      circle(g, cx, cy + 3, 2, '#2b4a29');
    });
  }
  if (kind === 'tentacle' || kind === 'boss-monster') {
    const boss = kind === 'boss-monster';
    const size = boss ? 88 : 52;
    return makeTex(size, size, (g) => {
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.28;
      g.strokeStyle = boss ? '#5b8f4a' : '#5f9a55';
      g.lineWidth = boss ? 5 : 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        g.beginPath();
        g.moveTo(cx, cy + 3);
        g.quadraticCurveTo(cx + Math.cos(a) * r * 2.1, cy + Math.sin(a) * r * 1.6, cx + Math.cos(a + 0.4) * r * 2.3, cy + Math.sin(a + 0.4) * r * 1.9);
        g.stroke();
      }
      circle(g, cx, cy, r * 1.25, '#3d6b3c');
      circle(g, cx, cy - 2, r, '#79bf64');
      circle(g, cx - r * 0.4, cy - r * 0.25, r * 0.2, '#f2ffb8');
      circle(g, cx + r * 0.4, cy - r * 0.25, r * 0.2, '#f2ffb8');
      circle(g, cx - r * 0.4, cy - r * 0.25, r * 0.08, '#10200f');
      circle(g, cx + r * 0.4, cy - r * 0.25, r * 0.08, '#10200f');
      g.strokeStyle = '#2a4d2a';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy + r * 0.15, r * 0.45, 0.2, Math.PI - 0.2);
      g.stroke();
      if (boss) {
        for (let i = 0; i < 5; i++) circle(g, cx + (hash(i, 8) - 0.5) * r * 1.4, cy - r * 1.1 + (hash(i, 9) - 0.5) * 10, 2, '#b7ff8a');
      }
    });
  }
  return makeTex(20, 20, (g) => circle(g, 10, 10, 6, '#ffffff'));
};

export const enemySprites: Record<EnemyKind, Texture> = {
  asteroid: enemyTex('asteroid'),
  splitter: enemyTex('splitter'),
  shard: enemyTex('shard'),
  scout: enemyTex('scout'),
  ship: enemyTex('ship'),
  spider: enemyTex('spider'),
  tentacle: enemyTex('tentacle'),
  'boss-asteroid': enemyTex('boss-asteroid'),
  'boss-alien': enemyTex('boss-alien'),
  'boss-monster': enemyTex('boss-monster'),
};

export const cellIcons = {
  mine: makeTex(18, 18, (g) => {
    polys(g, [[9, 2], [16, 8], [13, 16], [5, 16], [2, 8]], '#1a343c');
    polys(g, [[9, 4], [13, 8], [11, 13], [6, 13], [4, 8]], '#2e6573');
    polys(g, [[9, 5], [11, 8], [9, 11], [7, 8]], '#5fd8e8');
    rect(g, 8, 6, 2, 4, '#c9ffff');
    rect(g, 4, 14, 10, 2, '#0b151b');
    rect(g, 2, 8, 2, 2, '#8fe6ee');
    rect(g, 14, 8, 2, 2, '#8fe6ee');
  }),
  chest: makeTex(18, 16, (g) => {
    rect(g, 2, 6, 14, 9, '#4b331a');
    rect(g, 3, 7, 12, 7, '#6b4822');
    rect(g, 2, 4, 14, 4, '#5a3d1e');
    rect(g, 3, 5, 12, 2, '#8a5c2a');
    rect(g, 3, 8, 12, 1, '#d7a74d');
    rect(g, 8, 8, 2, 4, '#ffcf6b');
    rect(g, 7, 10, 4, 2, '#ffcf6b');
    rect(g, 4, 12, 1, 1, '#ffcf6b');
    rect(g, 13, 12, 1, 1, '#ffcf6b');
  }),
  slot: makeTex(20, 20, (g) => {
    g.strokeStyle = '#3f5966';
    g.lineWidth = 1;
    g.strokeRect(2.5, 2.5, 15, 15);
    rect(g, 4, 9, 12, 2, '#2b414d');
    rect(g, 9, 4, 2, 12, '#2b414d');
    rect(g, 9, 9, 2, 2, '#7ee7f2');
    rect(g, 1, 1, 3, 1, '#7ee7f2');
    rect(g, 1, 1, 1, 3, '#7ee7f2');
    rect(g, 16, 16, 3, 1, '#7ee7f2');
    rect(g, 18, 14, 1, 3, '#7ee7f2');
  }),
  hq: makeTex(56, 56, (g) => {
    const cx = 28;
    const cy = 28;
    circle(g, cx, cy, 23, 'rgba(0,0,0,0.5)');
    circle(g, cx, cy, 20, '#27323a');
    circle(g, cx, cy, 16, '#151d23');
    circle(g, cx, cy, 13, '#2b3b44');
    polys(g, [[cx, 8], [cx + 16, 20], [cx + 13, 40], [cx - 13, 40], [cx - 16, 20]], '#3b4d58');
    polys(g, [[cx, 12], [cx + 11, 21], [cx + 9, 35], [cx - 9, 35], [cx - 11, 21]], '#1a252c');
    circle(g, cx, cy - 1, 7, '#0d151a');
    circle(g, cx, cy - 1, 5, '#ff7a3c');
    circle(g, cx, cy - 1, 2, '#ffe3c2');
    rect(g, cx - 21, cy - 2, 5, 3, '#5c707a');
    rect(g, cx + 16, cy - 2, 5, 3, '#5c707a');
    rect(g, cx - 2, 5, 4, 6, '#5c707a');
    rect(g, cx - 1, 2, 2, 4, '#f2d98a');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      rect(g, cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 2, 2, '#f2d98a');
    }
  }),
};

export const makeEarth = () =>
  makeTex(108, 108, (g) => {
    const cx = 54;
    const cy = 54;
    // atmosphere
    for (let r = 52; r > 44; r--) {
      g.globalAlpha = 0.05 + (52 - r) * 0.012;
      circle(g, cx, cy, r, '#2fb7d6');
    }
    g.globalAlpha = 1;
    circle(g, cx, cy, 44, '#0a2340');
    // ocean bands
    for (let y = 10; y < 98; y++) {
      for (let x = 10; x < 98; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > 43 * 43) continue;
        const n =
          Math.sin(x * 0.11 + Math.sin(y * 0.08) * 2.1) +
          Math.sin(y * 0.13 + Math.cos(x * 0.09) * 1.8) +
          hash(Math.floor(x / 3), Math.floor(y / 3), 2) * 0.9;
        if (n > 1.35) {
          const shade = n > 1.95 ? '#4f9b6b' : n > 1.65 ? '#35765a' : '#245a4c';
          g.fillStyle = shade;
          g.fillRect(x, y, 1, 1);
        } else if (n < -1.1) {
          g.fillStyle = hash(x, y, 5) > 0.5 ? '#0d2c50' : '#0f3358';
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    // north polar cap
    g.globalAlpha = 0.85;
    circle(g, cx, cy - 36, 12, '#c7e5ef');
    g.globalAlpha = 1;
    // cloud streaks
    for (let i = 0; i < 7; i++) {
      const yy = 22 + i * 10;
      g.fillStyle = 'rgba(210,240,255,0.16)';
      g.fillRect(cx - 30 + (i % 3) * 8, yy, 26 + (i % 2) * 14, 2);
    }
    // terminator / dark side on the right
    g.globalAlpha = 0.36;
    for (let x = 54; x < 100; x++) {
      const h = Math.sqrt(Math.max(0, 44 * 44 - (x - cx) * (x - cx)));
      g.fillStyle = '#02070c';
      g.fillRect(x, cy - h, 1, h * 2);
    }
    g.globalAlpha = 1;
    // rim light
    g.strokeStyle = 'rgba(130,235,255,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, 43.5, Math.PI * 0.8, Math.PI * 1.55);
    g.stroke();
  });

export const starTex = makeTex(160, 160, (g) => {
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(hash(i, 1, 5) * 160);
    const y = Math.floor(hash(i, 2, 6) * 160);
    const b = hash(i, 3, 7);
    g.fillStyle = b > 0.9 ? '#cfe9f5' : b > 0.62 ? '#7fa3b8' : '#3c5665';
    g.fillRect(x, y, 1, b > 0.94 ? 2 : 1);
  }
});
