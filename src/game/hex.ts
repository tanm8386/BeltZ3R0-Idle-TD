import type { CellDef, CellKind } from './types';

export const HEX_SIZE = 36;
export const MAX_RING = 8;
export const SQRT3 = Math.sqrt(3);

export interface Axial {
  q: number;
  r: number;
}

export const keyOf = (q: number, r: number) => `${q},${r}`;

export const axialToWorld = (q: number, r: number) => ({
  x: HEX_SIZE * SQRT3 * (q + r / 2),
  y: HEX_SIZE * 1.5 * r,
});

export const DIRS: Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const neighbors = (q: number, r: number): Axial[] =>
  DIRS.map((d) => ({ q: q + d.q, r: r + d.r }));

export const ringOf = (q: number, r: number) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

export const angleOf = (q: number, r: number) => {
  const { x, y } = axialToWorld(q, r);
  let a = Math.atan2(x, -y);
  if (a < 0) a += Math.PI * 2;
  return a;
};

export const sectorOf = (q: number, r: number, count: number) =>
  Math.floor((angleOf(q, r) / (Math.PI * 2)) * count) % count;

export const hexPoints = (radius: number): number[] => {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  return pts;
};

/** Deterministic 0..1 hash used for cell content. */
const hash01 = (q: number, r: number, salt = 0) => {
  let h = (q * 374761393 + r * 668265263 + salt * 1442695040) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const sectorCountForChapter = (chapter: number) => (chapter >= 5 ? 8 : chapter >= 3 ? 7 : 6);

export const makeWorld = () => {
  const cells = new Map<string, CellDef>();
  const hq: CellDef = {
    key: '0,0',
    q: 0,
    r: 0,
    ring: 0,
    angle: 0,
    x: 0,
    y: 0,
    kind: 'hq',
    sector: 0,
  };
  cells.set(hq.key, hq);

  for (let ring = 1; ring <= MAX_RING; ring++) {
    const ringCells: Axial[] = [];
    let h = { q: -ring, r: ring };
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < ring; step++) {
        ringCells.push(h);
        h = { q: h.q + DIRS[side].q, r: h.r + DIRS[side].r };
      }
    }
    ringCells.sort((a, b) => angleOf(a.q, a.r) - angleOf(b.q, b.r));

    const kinds: CellKind[] = ringCells.map((c) => {
      if (ring === 1) return 'empty';
      const v = hash01(c.q, c.r, 17);
      if (v < 0.27) return 'slot';
      if (v < 0.61) return 'mine';
      if (v < 0.67) return 'chest';
      return 'empty';
    });

    if (ring === 1) {
      // Three starter slots, two mines and one sealed chest around the station.
      const fixed: CellKind[] = ['slot', 'mine', 'slot', 'chest', 'mine', 'slot'];
      fixed.forEach((k, i) => (kinds[i] = k));
    } else {
      if (!kinds.includes('chest')) kinds[Math.floor(ringCells.length * 0.66)] = 'chest';
      let slots = kinds.filter((k) => k === 'slot').length;
      for (let i = 0; i < ringCells.length && slots < Math.max(2, Math.floor(ring / 2)); i++) {
        if (kinds[i] === 'empty') {
          kinds[i] = 'slot';
          slots++;
        }
      }
    }

    ringCells.forEach((c, i) => {
      const { x, y } = axialToWorld(c.q, c.r);
      const key = keyOf(c.q, c.r);
      cells.set(key, {
        key,
        q: c.q,
        r: c.r,
        ring,
        angle: angleOf(c.q, c.r),
        x,
        y,
        kind: kinds[i],
        sector: 0,
      });
    });
  }

  return cells;
};

export const WORLD_CELLS = makeWorld();

export const initialClaimed = (): string[] => {
  const out = ['0,0'];
  for (const cell of WORLD_CELLS.values()) if (cell.ring === 1) out.push(cell.key);
  return out;
};

export const assignSectors = (cells: Map<string, CellDef>, claimed: Set<string>, count: number) => {
  for (const cell of cells.values()) {
    cell.sector = sectorOf(cell.q, cell.r, count);
  }
  void claimed;
};

export const borderCells = (claimSet: Set<string>) => {
  const out: CellDef[] = [];
  for (const key of claimSet) {
    const cell = WORLD_CELLS.get(key);
    if (!cell || cell.kind === 'hq') continue;
    for (const n of neighbors(cell.q, cell.r)) {
      const nk = keyOf(n.q, n.r);
      if (WORLD_CELLS.has(nk) && !claimSet.has(nk)) {
        out.push(cell);
        break;
      }
    }
  }
  return out;
};

export const claimableCells = (claimSet: Set<string>) => {
  const out = new Set<string>();
  for (const key of claimSet) {
    const cell = WORLD_CELLS.get(key);
    if (!cell) continue;
    for (const n of neighbors(cell.q, cell.r)) {
      const nk = keyOf(n.q, n.r);
      if (WORLD_CELLS.has(nk) && !claimSet.has(nk)) out.add(nk);
    }
  }
  return out;
};

export const ringRadius = (ring: number) => HEX_SIZE * 1.5 * ring;

export const mineYield = (ring: number) => ({
  metal: 0.85 + Math.max(0, ring - 1) * 0.62,
  crystal: 0.035 + Math.max(0, ring - 1) * 0.016,
});

export const linePoints = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  steps = 5,
): number[] => {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }
  return pts;
};
