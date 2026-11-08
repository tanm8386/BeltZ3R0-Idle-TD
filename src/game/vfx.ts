import { CanvasSource, Sprite, Texture } from 'pixi.js';
import { clearFrame, composite, createFrame, createFx } from 'pixelfx';
import * as hitSpark from 'pixelfx/fx/impacts/hit-spark';
import * as poof from 'pixelfx/fx/spawn/poof';
import * as zapHit from 'pixelfx/fx/lightning/zap-hit';
import * as plasmaExplosion from 'pixelfx/fx/explosions/plasma-explosion';
import * as empBlast from 'pixelfx/fx/scifi/emp-blast';
import * as lightningStrike from 'pixelfx/fx/lightning/lightning-strike';
import * as healAoe from 'pixelfx/fx/holy/heal-aoe';
import * as chestOpen from 'pixelfx/fx/pickups/chest-open';
import * as collectBurst from 'pixelfx/fx/pickups/collect-burst';
import * as levelUp from 'pixelfx/fx/ui/level-up';

export const PAL = {
  kinetic: ['#2a130a', '#5e2410', '#a83d18', '#e86123', '#ff9a4e', '#ffd0a8', '#fff6e8'],
  energy: ['#062026', '#0b4550', '#126877', '#1e9bab', '#35e0e8', '#9ffaff', '#f0ffff'],
  tech: ['#140a24', '#2a1650', '#4c2b86', '#7445c8', '#a86bff', '#d7b8ff', '#f6edff'],
  support: ['#241a08', '#4a3511', '#7d5d1e', '#b78e35', '#f2d98a', '#fff0bf', '#fffdf2'],
  alien: ['#120b26', '#2a1852', '#4d2b8f', '#7e4cd6', '#b58cff', '#e0ccff', '#ffffff'],
  monster: ['#0b1a0c', '#173915', '#2b5f26', '#4d9140', '#8bd47a', '#c9ffb8', '#f4fff0'],
  danger: ['#250606', '#541010', '#951c1c', '#d42f2f', '#ff5a5a', '#ffb0a8', '#fff2ef'],
  gold: ['#241a08', '#4e3510', '#86601c', '#c9942f', '#ffcf6b', '#ffe9b8', '#fffdf2'],
};

export type FxId =
  | 'hit'
  | 'poof'
  | 'zap'
  | 'plasma'
  | 'emp'
  | 'orbital'
  | 'shield'
  | 'chest'
  | 'burst'
  | 'level';

const MODULES: Record<FxId, any> = {
  hit: hitSpark,
  poof,
  zap: zapHit,
  plasma: plasmaExplosion,
  emp: empBlast,
  orbital: lightningStrike,
  shield: healAoe,
  chest: chestOpen,
  burst: collectBurst,
  level: levelUp,
};

interface LiveFx {
  fx: any;
  temp: ReturnType<typeof createFrame> | null;
  origin: [number, number];
  scale: number;
  screenX: number;
  screenY: number;
}

const addLight = (a: number, b: number) => {
  const r = Math.min(255, (a & 255) + (b & 255));
  const g = Math.min(255, ((a >>> 8) & 255) + ((b >>> 8) & 255));
  const b2 = Math.min(255, ((a >>> 16) & 255) + ((b >>> 16) & 255));
  return (0xff000000 | (b2 << 16) | (g << 8) | r) >>> 0;
};

export class VfxLayer {
  sprite: Sprite;
  private source: CanvasSource;
  private texture: Texture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frame: ReturnType<typeof createFrame>;
  private image: ImageData;
  private live: LiveFx[] = [];
  private accumulator = 0;
  private dirty = false;

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    this.frame = createFrame(width, height);
    this.image = new ImageData(width, height);
    this.source = new CanvasSource({ resource: this.canvas, scaleMode: 'nearest' });
    this.texture = new Texture({ source: this.source });
    this.sprite = new Sprite(this.texture);
    this.sprite.visible = false;
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.frame = createFrame(width, height);
    this.image = new ImageData(width, height);
    this.live.length = 0;
    this.sprite.visible = false;
    this.source.resize(width, height);
    this.dirty = false;
  }

  add(id: FxId, x: number, y: number, opts: Record<string, unknown> = {}) {
    const mod = MODULES[id];
    if (!mod) return;
    if (this.live.length > 30) this.live.shift();
    const scale = typeof opts.scale === 'number' ? opts.scale : 1;
    const meta = mod.meta ?? {};
    const size = (meta.size as [number, number] | undefined) ?? [160, 120];
    const origin = (meta.origin as [number, number] | undefined) ?? [size[0] / 2, size[1] / 2];
    let fx: any;
    let temp = null;
    if (scale !== 1) {
      temp = createFrame(size[0], size[1]);
      fx = createFx(mod, { ...opts, x: origin[0], y: origin[1], scale: undefined });
    } else {
      fx = createFx(mod, { ...opts, x, y, scale: undefined });
    }
    this.live.push({ fx, temp, origin, scale, screenX: x, screenY: y });
    this.sprite.visible = true;
    this.dirty = true;
  }

  clear() {
    this.live.length = 0;
    this.accumulator = 0;
    this.flush();
  }

  private flush() {
    this.frame.color.fill(0);
    this.frame.light.fill(0);
    this.image.data.fill(0);
    this.ctx.putImageData(this.image, 0, 0);
    this.source.update();
    this.sprite.visible = false;
    this.dirty = false;
  }

  private blit(live: LiveFx) {
    if (!live.temp) return;
    const { temp, origin, scale, screenX, screenY } = live;
    const dw = Math.max(1, Math.ceil(temp.w * scale));
    const dh = Math.max(1, Math.ceil(temp.h * scale));
    const dx0 = Math.floor(screenX - origin[0] * scale);
    const dy0 = Math.floor(screenY - origin[1] * scale);
    const W = this.frame.w;
    const H = this.frame.h;
    for (let dy = 0; dy < dh; dy++) {
      const sy = Math.min(temp.h - 1, Math.floor(dy / scale));
      const py = dy0 + dy;
      if (py < 0 || py >= H) continue;
      for (let dx = 0; dx < dw; dx++) {
        const sx = Math.min(temp.w - 1, Math.floor(dx / scale));
        const px = dx0 + dx;
        if (px < 0 || px >= W) continue;
        const srcI = sy * temp.w + sx;
        const c = temp.color[srcI];
        const l = temp.light[srcI] & 0xffffff;
        const dstI = py * W + px;
        if (c) {
          const sa = (c >>> 24) / 255;
          const d = this.frame.color[dstI];
          if (!d) {
            this.frame.color[dstI] = c;
          } else {
            const da = (d >>> 24) / 255;
            const oa = sa + da * (1 - sa);
            if (oa > 0) {
              const mix = (s: number, t: number) => Math.round((s * sa + t * da * (1 - sa)) / oa);
              const rr = mix(c & 255, d & 255);
              const gg = mix((c >>> 8) & 255, (d >>> 8) & 255);
              const bb = mix((c >>> 16) & 255, (d >>> 16) & 255);
              this.frame.color[dstI] = ((Math.round(oa * 255) & 255) << 24) | (bb << 16) | (gg << 8) | rr;
            }
          }
        }
        if (l) this.frame.light[dstI] = addLight(this.frame.light[dstI], l);
      }
    }
  }

  update(dt: number) {
    if (!this.live.length) {
      if (this.dirty) this.flush();
      return;
    }
    this.accumulator += Math.min(dt, 0.1);
    if (this.accumulator < 1 / 30) return;
    const step = this.accumulator;
    this.accumulator = 0;

    for (const live of this.live) live.fx.update(step);
    this.live = this.live.filter((l) => !l.fx.done());

    clearFrame(this.frame);
    for (const live of this.live) {
      if (live.temp) {
        clearFrame(live.temp);
        live.fx.draw(live.temp, 'front');
        this.blit(live);
      } else {
        live.fx.draw(this.frame, 'front');
      }
    }
    composite(this.frame, this.image.data, null);
    this.ctx.putImageData(this.image, 0, 0);
    this.source.update();
    this.sprite.visible = true;
    this.dirty = true;
  }
}
