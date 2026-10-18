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
export const MOVE_SPEED = 8.5;
export const DODGE_SPEED = 24;
export const PUNCH_RANGE = 78;
export const KICK_RANGE = 102;
export const PUNCH_DAMAGE = 10;
export const KICK_DAMAGE = 15;
export const BLOCK_REDUCTION = 0.7;
export const PUNCH_COOLDOWN = 6;
export const KICK_COOLDOWN = 10;
export const BLOCK_DURATION = 6;
export const DODGE_COOLDOWN = 10;
export const STUN_DURATION = 2;
export const MAX_HP = 100;
export const MAX_STAMINA = 100;
export const KNOCKBACK = 12;
export const GRAVITY = 2.4;

export type AnimState = 'idle' | 'punching' | 'kicking' | 'blocking' | 'dodging' | 'stunned' | 'hit';

export interface DamageIndicator {
  value: number;
  x: number;
  y: number;
  age: number;
  isEvade?: boolean;
  isCrit?: boolean;
  isBlocked?: boolean;
  label?: string;
}

export interface FighterState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hp: number;
  stamina: number;
  facing: 1 | -1; // 1 = right (+X), -1 = left (-X)
  animState: AnimState;
  animTimer: number;
  cooldown: number;
  dodgeCooldown?: number;
  dodgeTimer?: number;
  isBlocking: boolean;
  consecutiveBlocks: number;
  lastAction: Action;
  roundReward: number;
  hitFlash: number;
  consecutiveAttacks: number;
  strikeHand: 0 | 1;
  sidestepDir: 1 | -1;
  damageNumbers: DamageIndicator[];
}

export function createFighter(x: number, facing: 1 | -1, z = 0): FighterState {
  return {
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    hp: MAX_HP,
    stamina: MAX_STAMINA,
    facing,
    animState: 'idle',
    animTimer: 0,
    cooldown: 0,
    dodgeCooldown: 0,
    dodgeTimer: 0,
    isBlocking: false,
    consecutiveBlocks: 0,
    lastAction: 'idle',
    roundReward: 0,
    hitFlash: 0,
    consecutiveAttacks: 0,
    strikeHand: 0,
    sidestepDir: facing,
    damageNumbers: [],
  };
}

// Ego-centric discretized state (1600 states) so Tabular Q works identically on left or right side
export function discretizeState(self: FighterState, opponent: FighterState): number {
  const relX = self.x <= opponent.x ? self.x : ARENA_WIDTH - self.x;
  const posZone = Math.min(9, Math.max(0, Math.floor(relX / (ARENA_WIDTH / 10))));
  const hpLevel = self.hp > 75 ? 0 : self.hp > 50 ? 1 : self.hp > 25 ? 2 : 3;

  const dx = self.x - opponent.x;
  const dz = (self.z - opponent.z) * 0.35;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const distLevel = dist < 65 ? 0 : dist < 105 ? 1 : dist < 180 ? 2 : dist < 320 ? 3 : 4;

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
