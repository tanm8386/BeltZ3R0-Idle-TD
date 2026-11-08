import type { BeltGame } from '../game/engine';

export const getGame = () => (window as unknown as { beltGame?: BeltGame }).beltGame;
