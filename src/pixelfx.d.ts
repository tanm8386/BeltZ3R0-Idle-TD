declare module 'pixelfx' {
  export function createFrame(w: number, h: number, ox?: number, oy?: number): {
    w: number;
    h: number;
    ox: number;
    oy: number;
    color: Uint32Array;
    light: Uint32Array;
  };
  export function clearFrame(f: { color: Uint32Array; light: Uint32Array }): unknown;
  export function createFx(mod: unknown, options?: Record<string, unknown>): {
    update(dt: number): void;
    draw(frame: unknown, layer?: 'back' | 'front'): void;
    done(): boolean;
    stop(): void;
  };
  export function composite(frame: unknown, out: Uint8ClampedArray, bg?: number | null, lightK?: number): Uint8ClampedArray;
}

declare module 'pixelfx/fx/*' {
  export const meta: Record<string, unknown>;
  export function create(options: Record<string, unknown>): Record<string, unknown>;
}
