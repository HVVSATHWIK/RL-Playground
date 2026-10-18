import {
  type FighterState,
  type Action,
  createFighter,
  ARENA_WIDTH,
  ARENA_DEPTH,
  ROBOT_WIDTH,
  MOVE_SPEED,
  DODGE_SPEED,
  PUNCH_RANGE,
  KICK_RANGE,
  PUNCH_DAMAGE,
  KICK_DAMAGE,
  BLOCK_REDUCTION,
  PUNCH_COOLDOWN,
  KICK_COOLDOWN,
  BLOCK_DURATION,
  DODGE_COOLDOWN,
  STUN_DURATION,
  KNOCKBACK,
} from './fighter';

export interface StepResult {
  redReward: number;
  blueReward: number;
  roundOver: boolean;
  winner: 'red' | 'blue' | 'draw' | null;
  redLanded: boolean;
  blueLanded: boolean;
  redDamage: number;
  blueDamage: number;
  redBlocked: boolean;
  blueBlocked: boolean;
  redEvaded: boolean;
  blueEvaded: boolean;
}

export interface RewardWeights {
  aggression: number; // multiplier for damage dealt (+10/+15)
  survival: number;   // multiplier for damage taken and round defeat
  defense: number;    // multiplier for tactical blocks (+8) and evasive dodges (+5)
  spacing: number;    // multiplier for closing distance and 3D positioning
  winBonus: number;   // multiplier for KO win (+100)
}

export const DEFAULT_REWARD_WEIGHTS: RewardWeights = {
  aggression: 1.2,
  survival: 1.2,
  defense: 1.8, // High positive reward for tactical defense
  spacing: 1.0,
  winBonus: 1.2,
};

// Resolves attack damage in full 3D spatial geometry considering blocking and evasion actions
function resolveSimultaneous(
  red: FighterState,
  blue: FighterState,
  redAction: Action,
  blueAction: Action
): { redDamage: number; blueDamage: number; redBlocked: boolean; blueBlocked: boolean; redEvaded: boolean; blueEvaded: boolean } {
  const redWillBlock = redAction === 'block' && red.animState !== 'stunned';
  const blueWillBlock = blueAction === 'block' && blue.animState !== 'stunned';

  // Dodge grants full invulnerability evasion during active dodge window or when initiating valid dodge
  const redCanDodge = (redAction === 'dodge' && red.cooldown <= 0) || red.animState === 'dodging';
  const redWillDodge = redCanDodge && red.animState !== 'stunned';

  const blueCanDodge = (blueAction === 'dodge' && blue.cooldown <= 0) || blue.animState === 'dodging';
  const blueWillDodge = blueCanDodge && blue.animState !== 'stunned';

  // 3D Euclidean distance calculation
  const dx = blue.x - red.x;
  const dz = blue.z - red.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  let redDamage = 0;
  let redBlocked = false;
  let blueEvaded = false;

  // Check red's attack against blue
  if ((redAction === 'punch' || redAction === 'kick') && red.cooldown <= 0 && red.animState !== 'stunned') {
    const range = redAction === 'punch' ? PUNCH_RANGE : KICK_RANGE;
    if (dist <= range) {
      if (blueWillDodge) {
        // Blue cleanly evades the strike with full I-frames!
        redDamage = 0;
        blueEvaded = true;
      } else if (blue.isBlocking || blueWillBlock) {
        redDamage = Math.max(1, Math.round((redAction === 'punch' ? PUNCH_DAMAGE : KICK_DAMAGE) * (1 - BLOCK_REDUCTION)));
        redBlocked = true;
      } else {
        redDamage = redAction === 'punch' ? PUNCH_DAMAGE : KICK_DAMAGE;
      }
    }
  }

  let blueDamage = 0;
  let blueBlocked = false;
  let redEvaded = false;

  // Check blue's attack against red
  if ((blueAction === 'punch' || blueAction === 'kick') && blue.cooldown <= 0 && blue.animState !== 'stunned') {
    const range = blueAction === 'punch' ? PUNCH_RANGE : KICK_RANGE;
    if (dist <= range) {
      if (redWillDodge) {
        // Red cleanly evades the strike with full I-frames!
        blueDamage = 0;
        redEvaded = true;
      } else if (red.isBlocking || redWillBlock) {
        blueDamage = Math.max(1, Math.round((blueAction === 'punch' ? PUNCH_DAMAGE : KICK_DAMAGE) * (1 - BLOCK_REDUCTION)));
        blueBlocked = true;
      } else {
        blueDamage = blueAction === 'punch' ? PUNCH_DAMAGE : KICK_DAMAGE;
      }
    }
  }

  return { redDamage, blueDamage, redBlocked, blueBlocked, redEvaded, blueEvaded };
}

// Applies state updates, animation counters, cooldowns, and full 3D spatial movement
function applyState(fighter: FighterState, action: Action, opponent: FighterState) {
  fighter.lastAction = action;

  // Decrease timers
  if (fighter.animTimer > 0) fighter.animTimer--;
  if (fighter.cooldown > 0) fighter.cooldown--;
  if (fighter.hitFlash > 0) fighter.hitFlash--;

  // Age floating damage numbers and evasion notifications
  fighter.damageNumbers = fighter.damageNumbers
    .map((d) => ({ ...d, age: d.age + 1, y: d.y - 1.4 }))
    .filter((d) => d.age < 35);

  const minX = ROBOT_WIDTH / 2;
  const maxX = ARENA_WIDTH - ROBOT_WIDTH / 2;
  const minZ = -ARENA_DEPTH / 2;
  const maxZ = ARENA_DEPTH / 2;

  const dx = opponent.x - fighter.x;
  const dz = opponent.z - fighter.z;
  const dist = Math.sqrt(dx * dx + dz * dz) || 1;

  // Decelerating momentum glide during active evasive dodge animation
  if (fighter.animState === 'dodging' && fighter.animTimer > 0) {
    const glideRatio = fighter.animTimer / 10;
    const glideX = (dx / dist) * (glideRatio * 3.2);
    const glideZ = (dz / dist) * (glideRatio * 1.8);
    fighter.x = Math.max(minX, Math.min(maxX, fighter.x - glideX));
    fighter.z = Math.max(minZ, Math.min(maxZ, fighter.z - glideZ));
  }

  // Stun logic: while stunned, cannot perform actions
  if (fighter.animState === 'stunned') {
    if (fighter.animTimer <= 0) fighter.animState = 'idle';
    fighter.consecutiveAttacks = 0;
    return;
  }

  // Reset anim state if timer expired
  if (fighter.animTimer <= 0 && fighter.animState !== 'idle') {
    fighter.animState = 'idle';
  }

  fighter.isBlocking = false;

  switch (action) {
    case 'moveLeft':
      fighter.consecutiveAttacks = 0;
      if (fighter.x > opponent.x) {
        // Moving left towards opponent: stop at solid collision boundary
        fighter.x = Math.max(opponent.x + 52, fighter.x - MOVE_SPEED);
      } else {
        fighter.x = Math.max(minX, fighter.x - MOVE_SPEED);
      }
      break;

    case 'moveRight':
      fighter.consecutiveAttacks = 0;
      if (fighter.x < opponent.x) {
        // Moving right towards opponent: stop at solid collision boundary
        fighter.x = Math.min(opponent.x - 52, fighter.x + MOVE_SPEED);
      } else {
        fighter.x = Math.min(maxX, fighter.x + MOVE_SPEED);
      }
      break;

    case 'punch':
      if (fighter.cooldown <= 0) {
        fighter.animState = 'punching';
        fighter.animTimer = 5;
        fighter.cooldown = PUNCH_COOLDOWN;
        fighter.consecutiveAttacks = (fighter.consecutiveAttacks || 0) + 1;
      }
      break;

    case 'kick':
      if (fighter.cooldown <= 0) {
        fighter.animState = 'kicking';
        fighter.animTimer = 7;
        fighter.cooldown = KICK_COOLDOWN;
        fighter.consecutiveAttacks = (fighter.consecutiveAttacks || 0) + 1;
      }
      break;

    case 'block':
      fighter.isBlocking = true;
      fighter.animState = 'blocking';
      fighter.animTimer = BLOCK_DURATION;
      fighter.consecutiveAttacks = 0;
      break;

    case 'dodge':
      if (fighter.cooldown <= 0) {
        fighter.animState = 'dodging';
        fighter.animTimer = 10;
        fighter.cooldown = DODGE_COOLDOWN;
        fighter.consecutiveAttacks = 0;
        // Agile initial evasive leap away from opponent
        const pushX = (dx / dist) * DODGE_SPEED;
        const pushZ = (dz / dist) * (DODGE_SPEED * 0.6);
        fighter.x = Math.max(minX, Math.min(maxX, fighter.x - pushX));
        fighter.z = Math.max(minZ, Math.min(maxZ, fighter.z - pushZ));
      }
      break;

    case 'idle':
    default:
      fighter.consecutiveAttacks = 0;
      break;
  }
}

export function stepArena(
  red: FighterState,
  blue: FighterState,
  redAction: Action,
  blueAction: Action,
  rewardWeights: RewardWeights = DEFAULT_REWARD_WEIGHTS
): StepResult {
  // Dynamic 3D facing orientation
  if (red.x < blue.x) {
    red.facing = 1;
    blue.facing = -1;
  } else if (red.x > blue.x) {
    red.facing = -1;
    blue.facing = 1;
  }

  // Small baseline engagement reward
  let redReward = -0.02 * rewardWeights.spacing;
  let blueReward = -0.02 * rewardWeights.spacing;

  // Phase 1: Simultaneous 3D damage resolution
  const { redDamage, blueDamage, redBlocked, blueBlocked, redEvaded, blueEvaded } = resolveSimultaneous(
    red,
    blue,
    redAction,
    blueAction
  );

  // Phase 2: Movement & state update
  applyState(red, redAction, blue);
  applyState(blue, blueAction, red);

  // Maintain strict solid-body non-overlapping separation in 3D arena space
  const solidSeparation = 52;
  if (red.x <= blue.x) {
    if (red.x > blue.x - solidSeparation) {
      const mid = (red.x + blue.x) / 2;
      red.x = Math.max(ROBOT_WIDTH / 2, mid - solidSeparation / 2);
      blue.x = Math.min(ARENA_WIDTH - ROBOT_WIDTH / 2, mid + solidSeparation / 2);
    }
  } else {
    if (blue.x > red.x - solidSeparation) {
      const mid = (red.x + blue.x) / 2;
      blue.x = Math.max(ROBOT_WIDTH / 2, mid - solidSeparation / 2);
      red.x = Math.min(ARENA_WIDTH - ROBOT_WIDTH / 2, mid + solidSeparation / 2);
    }
  }

  const dx = blue.x - red.x;
  const dz = blue.z - red.z;
  const distNow = Math.sqrt(dx * dx + dz * dz) || 0.001;

  // Phase 3: Apply damage, 3D knockback, stun, and balanced defensive reward shaping
  if (redDamage > 0) {
    blue.hp = Math.max(0, blue.hp - redDamage);
    blue.hitFlash = 4;
    blue.damageNumbers.push({ value: redDamage, x: blue.x, y: blue.x - 30, age: 0 });

    // 3D Knockback along impact vector
    const normX = dx / distNow;
    const normZ = dz / distNow;
    blue.x = Math.max(ROBOT_WIDTH / 2, Math.min(ARENA_WIDTH - ROBOT_WIDTH / 2, blue.x + normX * KNOCKBACK));
    blue.z = Math.max(-ARENA_DEPTH / 2, Math.min(ARENA_DEPTH / 2, blue.z + normZ * KNOCKBACK));

    if (!blue.isBlocking) {
      blue.animState = 'stunned';
      blue.animTimer = STUN_DURATION;
    }

    const baseAttacker = redBlocked ? 4 : redDamage >= KICK_DAMAGE ? 15 : 10;
    const baseDefender = redBlocked ? 2 : redDamage >= KICK_DAMAGE ? 15 : 10;
    redReward += baseAttacker * rewardWeights.aggression;
    blueReward -= baseDefender * rewardWeights.survival;

    // Tactical defense reward for blocking
    if (redBlocked) {
      blueReward += 8 * rewardWeights.defense;
    }
  }

  if (blueDamage > 0) {
    red.hp = Math.max(0, red.hp - blueDamage);
    red.hitFlash = 4;
    red.damageNumbers.push({ value: blueDamage, x: red.x, y: red.x - 30, age: 0 });

    // 3D Knockback along impact vector
    const normX = dx / distNow;
    const normZ = dz / distNow;
    red.x = Math.max(ROBOT_WIDTH / 2, Math.min(ARENA_WIDTH - ROBOT_WIDTH / 2, red.x - normX * KNOCKBACK));
    red.z = Math.max(-ARENA_DEPTH / 2, Math.min(ARENA_DEPTH / 2, red.z - normZ * KNOCKBACK));

    if (!red.isBlocking) {
      red.animState = 'stunned';
      red.animTimer = STUN_DURATION;
    }

    const baseAttacker = blueBlocked ? 4 : blueDamage >= KICK_DAMAGE ? 15 : 10;
    const baseDefender = blueBlocked ? 2 : blueDamage >= KICK_DAMAGE ? 15 : 10;
    blueReward += baseAttacker * rewardWeights.aggression;
    redReward -= baseDefender * rewardWeights.survival;

    // Tactical defense reward for blocking
    if (blueBlocked) {
      redReward += 8 * rewardWeights.defense;
    }
  }

  // Tactical reward for successful evasive dodge against an incoming attack
  if (redEvaded) {
    redReward += 10 * rewardWeights.defense;
    red.damageNumbers.push({ value: 0, x: red.x, y: 260, age: 0, isEvade: true, label: 'EVADED!' });
  }
  if (blueEvaded) {
    blueReward += 10 * rewardWeights.defense;
    blue.damageNumbers.push({ value: 0, x: blue.x, y: 260, age: 0, isEvade: true, label: 'EVADED!' });
  }

  // Small penalty for passive block spam when opponent is far or idle
  const blueAttacking = blueAction === 'punch' || blueAction === 'kick';
  const redAttacking = redAction === 'punch' || redAction === 'kick';

  if (redAction === 'block' && !blueAttacking && distNow > 140) {
    redReward -= 0.05 * rewardWeights.defense;
  }
  if (blueAction === 'block' && !redAttacking && distNow > 140) {
    blueReward -= 0.05 * rewardWeights.defense;
  }

  // Spacing incentives: rewarding closing distance when far
  if (distNow <= KICK_RANGE + 10) {
    redReward += 0.05 * rewardWeights.spacing;
    blueReward += 0.05 * rewardWeights.spacing;
  }

  // Check round end condition (KO)
  let roundOver = false;
  let winner: 'red' | 'blue' | 'draw' | null = null;

  if (red.hp <= 0 || blue.hp <= 0) {
    roundOver = true;
    if (red.hp <= 0 && blue.hp <= 0) {
      winner = 'draw';
    } else if (red.hp <= 0) {
      winner = 'blue';
      blueReward += 100 * rewardWeights.winBonus;
      redReward -= 80 * rewardWeights.survival;
    } else {
      winner = 'red';
      redReward += 100 * rewardWeights.winBonus;
      blueReward -= 80 * rewardWeights.survival;
    }
  }

  red.roundReward += redReward;
  blue.roundReward += blueReward;

  return {
    redReward,
    blueReward,
    roundOver,
    winner,
    redLanded: redDamage > 0,
    blueLanded: blueDamage > 0,
    redDamage,
    blueDamage,
    redBlocked,
    blueBlocked,
    redEvaded,
    blueEvaded,
  };
}

export function resetRound(red: FighterState, blue: FighterState) {
  Object.assign(red, createFighter(150, 1, 0));
  Object.assign(blue, createFighter(ARENA_WIDTH - 150, -1, 0));
}
