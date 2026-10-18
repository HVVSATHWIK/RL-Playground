export const ACTIONS = [
  'moveLeft',
  'moveRight',
  'punch',
  'kick',
  'block',
  'dodge',
] as const;

export type CombatAction = (typeof ACTIONS)[number];
export type Action = CombatAction | 'idle';
export const NUM_ACTIONS = ACTIONS.length; // 6 actions

export const ARENA_WIDTH = 800;
export const ARENA_DEPTH = 400; // 3D ring depth (-200 to +200)
export const FLOOR_Y = 320;
export const ROBOT_WIDTH = 40;
export const ROBOT_HEIGHT = 70;
export const MOVE_SPEED = 6;
export const DODGE_SPEED = 26;
export const PUNCH_RANGE = 55;
export const KICK_RANGE = 75;
export const PUNCH_DAMAGE = 10;
export const KICK_DAMAGE = 15;
export const BLOCK_REDUCTION = 0.8;
export const PUNCH_COOLDOWN = 8;
export const KICK_COOLDOWN = 14;
export const BLOCK_DURATION = 10;
export const DODGE_COOLDOWN = 12;
export const STUN_DURATION = 6;
export const MAX_HP = 100;
export const KNOCKBACK = 12;

export type AnimState = 'idle' | 'punching' | 'kicking' | 'blocking' | 'dodging' | 'stunned' | 'hit';

export interface DamageIndicator {
  value: number;
  x: number;
  y: number;
  age: number;
  isEvade?: boolean;
  isCrit?: boolean;
  label?: string;
}

export interface FighterState {
  x: number;
  z: number; // 3D arena depth (-200 to +200)
  hp: number;
  facing: 1 | -1; // 1 = right (+X), -1 = left (-X)
  animState: AnimState;
  animTimer: number;
  cooldown: number;
  isBlocking: boolean;
  lastAction: Action;
  roundReward: number;
  hitFlash: number; // frames remaining for hit flash
  consecutiveAttacks: number;
  damageNumbers: DamageIndicator[];
}

export function createFighter(x: number, facing: 1 | -1, z = 0): FighterState {
  return {
    x,
    z,
    hp: MAX_HP,
    facing,
    animState: 'idle',
    animTimer: 0,
    cooldown: 0,
    isBlocking: false,
    lastAction: 'idle',
    roundReward: 0,
    hitFlash: 0,
    consecutiveAttacks: 0,
    damageNumbers: [],
  };
}

// Discretize state for tabular Q-table incorporating 3D Euclidean distance
export function discretizeState(self: FighterState, opponent: FighterState): number {
  const posZone = Math.min(9, Math.max(0, Math.floor(self.x / (ARENA_WIDTH / 10))));
  const hpLevel = self.hp > 75 ? 0 : self.hp > 50 ? 1 : self.hp > 25 ? 2 : 3;

  const dx = self.x - opponent.x;
  const dz = self.z - opponent.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const distLevel = dist < 50 ? 0 : dist < 100 ? 1 : dist < 200 ? 2 : dist < 400 ? 3 : 4;

  const oppAction =
    opponent.animState === 'punching' || opponent.animState === 'kicking'
      ? 1
      : opponent.isBlocking
      ? 2
      : opponent.animState === 'stunned'
      ? 3
      : 0;
  const ready = self.cooldown <= 0 ? 0 : 1;

  return posZone * 160 + hpLevel * 40 + distLevel * 8 + oppAction * 2 + ready;
}

export const STATE_SPACE_SIZE = 10 * 4 * 5 * 4 * 2; // 1600
