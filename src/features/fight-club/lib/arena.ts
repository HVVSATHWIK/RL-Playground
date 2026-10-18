import {
  type FighterState,
  type Action,
  createFighter,
  ARENA_WIDTH,
  ARENA_DEPTH,
  FLOOR_Y,
  ROBOT_WIDTH,
  ROBOT_HEIGHT,
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
  MAX_STAMINA,
  KNOCKBACK,
  GRAVITY,
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
  aggression: number;
  survival: number;
  defense: number;
  spacing: number;
  winBonus: number;
}

export const DEFAULT_REWARD_WEIGHTS: RewardWeights = {
  aggression: 1.5,
  survival: 1.2,
  defense: 1.2,
  spacing: 1.4,
  winBonus: 1.5,
};

const SOLID_SEPARATION = 44;

function clampArena(fighter: FighterState) {
  const minX = ROBOT_WIDTH / 2;
  const maxX = ARENA_WIDTH - ROBOT_WIDTH / 2;
  const minZ = -ARENA_DEPTH / 2;
  const maxZ = ARENA_DEPTH / 2;
  fighter.x = Math.max(minX, Math.min(maxX, fighter.x));
  fighter.z = Math.max(minZ, Math.min(maxZ, fighter.z));
  if (fighter.y < 0) {
    fighter.y = 0;
    fighter.vy = 0;
  }
}

function enforceSolidSeparation(red: FighterState, blue: FighterState) {
  const minX = ROBOT_WIDTH / 2;
  const maxX = ARENA_WIDTH - ROBOT_WIDTH / 2;
  const currentGap = Math.abs(blue.x - red.x);
  if (currentGap >= SOLID_SEPARATION) return;

  if (red.x <= blue.x) {
    const mid = (red.x + blue.x) / 2;
    let newRedX = mid - SOLID_SEPARATION / 2;
    let newBlueX = mid + SOLID_SEPARATION / 2;
    if (newRedX < minX) {
      newRedX = minX;
      newBlueX = minX + SOLID_SEPARATION;
    } else if (newBlueX > maxX) {
      newBlueX = maxX;
      newRedX = maxX - SOLID_SEPARATION;
    }
    red.x = newRedX;
    blue.x = newBlueX;
  } else {
    const mid = (red.x + blue.x) / 2;
    let newBlueX = mid - SOLID_SEPARATION / 2;
    let newRedX = mid + SOLID_SEPARATION / 2;
    if (newBlueX < minX) {
      newBlueX = minX;
      newRedX = minX + SOLID_SEPARATION;
    } else if (newRedX > maxX) {
      newRedX = maxX;
      newBlueX = maxX - SOLID_SEPARATION;
    }
    blue.x = newBlueX;
    red.x = newRedX;
  }
}

// Applies movement, attack lunge, cooldowns, and animations BEFORE hit detection
function applyStateAndMovement(fighter: FighterState, action: Action, opponent: FighterState): {
  initiatedAttack: 'punch' | 'kick' | null;
  initiatedDodge: boolean;
} {
  fighter.lastAction = action;

  if (fighter.animTimer > 0) fighter.animTimer--;
  if (fighter.cooldown > 0) fighter.cooldown--;
  if ((fighter.dodgeCooldown || 0) > 0) fighter.dodgeCooldown!--;
  if ((fighter.dodgeTimer || 0) > 0) fighter.dodgeTimer!--;
  if (fighter.hitFlash > 0) fighter.hitFlash--;

  fighter.damageNumbers = fighter.damageNumbers
    .map((d) => ({ ...d, age: d.age + 1, y: d.y - 1.4 }))
    .filter((d) => d.age < 36);

  if (fighter.y > 0 || fighter.vy !== 0) {
    fighter.y += fighter.vy;
    fighter.vy -= GRAVITY;
    if (fighter.y <= 0) {
      fighter.y = 0;
      fighter.vy = 0;
    }
  }

  // Natural Z-lane return so fighters don't drift out of Z alignment
  fighter.z *= 0.88;
  if (Math.abs(fighter.z) < 0.5) fighter.z = 0;

  if (action === 'idle' || action === 'moveLeft' || action === 'moveRight') {
    fighter.stamina = Math.min(MAX_STAMINA, (fighter.stamina ?? MAX_STAMINA) + 1.6);
  } else if (action === 'block') {
    fighter.stamina = Math.min(MAX_STAMINA, (fighter.stamina ?? MAX_STAMINA) + 0.3);
  }

  const dx = opponent.x - fighter.x;
  const dirToOpp = dx >= 0 ? 1 : -1;
  const absDx = Math.abs(dx);

  if (fighter.animState === 'stunned') {
    if (fighter.animTimer <= 0) {
      fighter.animState = 'idle';
    } else {
      fighter.consecutiveAttacks = 0;
      fighter.isBlocking = false;
      clampArena(fighter);
      return { initiatedAttack: null, initiatedDodge: false };
    }
  }

  if (fighter.animTimer <= 0 && fighter.animState !== 'idle') {
    fighter.animState = 'idle';
  }

  fighter.isBlocking = false;
  let initiatedAttack: 'punch' | 'kick' | null = null;
  let initiatedDodge = false;

  switch (action) {
    case 'moveLeft':
      fighter.consecutiveAttacks = 0;
      fighter.consecutiveBlocks = 0;
      if (fighter.x > opponent.x) {
        fighter.x = Math.max(opponent.x + SOLID_SEPARATION, fighter.x - MOVE_SPEED);
      } else {
        fighter.x = fighter.x - MOVE_SPEED;
      }
      break;

    case 'moveRight':
      fighter.consecutiveAttacks = 0;
      fighter.consecutiveBlocks = 0;
      if (fighter.x < opponent.x) {
        fighter.x = Math.min(opponent.x - SOLID_SEPARATION, fighter.x + MOVE_SPEED);
      } else {
        fighter.x = fighter.x + MOVE_SPEED;
      }
      break;

    case 'punch':
      fighter.consecutiveBlocks = 0;
      if (fighter.cooldown <= 0) {
        // Combat step-in lunge so attacks connect crisply
        if (absDx > SOLID_SEPARATION && absDx <= PUNCH_RANGE + 28) {
          fighter.x += dirToOpp * Math.min(12, absDx - SOLID_SEPARATION);
        }
        fighter.animState = 'punching';
        fighter.animTimer = 5;
        fighter.cooldown = PUNCH_COOLDOWN;
        fighter.consecutiveAttacks = (fighter.consecutiveAttacks || 0) + 1;
        fighter.strikeHand = ((fighter.strikeHand || 0) === 0 ? 1 : 0) as 0 | 1;
        fighter.stamina = Math.max(0, (fighter.stamina ?? MAX_STAMINA) - 8);
        initiatedAttack = 'punch';
      }
      break;

    case 'kick':
      fighter.consecutiveBlocks = 0;
      if (fighter.cooldown <= 0) {
        if (absDx > SOLID_SEPARATION && absDx <= KICK_RANGE + 32) {
          fighter.x += dirToOpp * Math.min(15, absDx - SOLID_SEPARATION);
        }
        fighter.animState = 'kicking';
        fighter.animTimer = 7;
        fighter.cooldown = KICK_COOLDOWN;
        fighter.consecutiveAttacks = (fighter.consecutiveAttacks || 0) + 1;
        fighter.stamina = Math.max(0, (fighter.stamina ?? MAX_STAMINA) - 12);
        if (fighter.y === 0) {
          fighter.vy = 4.6;
          fighter.y = 2.0;
        }
        initiatedAttack = 'kick';
      }
      break;

    case 'block':
      fighter.consecutiveAttacks = 0;
      fighter.consecutiveBlocks = (fighter.consecutiveBlocks || 0) + 1;
      fighter.isBlocking = true;
      fighter.animState = 'blocking';
      fighter.animTimer = BLOCK_DURATION;
      break;

    case 'dodge':
      fighter.consecutiveBlocks = 0;
      if ((fighter.dodgeCooldown || 0) <= 0) {
        fighter.animState = 'dodging';
        fighter.animTimer = 9;
        fighter.dodgeTimer = 9;
        fighter.dodgeCooldown = 6;
        fighter.consecutiveAttacks = 0;
        fighter.stamina = Math.max(0, (fighter.stamina ?? MAX_STAMINA) - 14);
        const sideDir = (fighter.sidestepDir || 1) as 1 | -1;
        fighter.sidestepDir = (sideDir === 1 ? -1 : 1) as 1 | -1;
        fighter.x -= dirToOpp * DODGE_SPEED;
        fighter.z += sideDir * 28;
        if (fighter.y === 0) {
          fighter.vy = 4.8;
          fighter.y = 2.2;
        }
        initiatedDodge = true;
      }
      break;

    case 'idle':
    default:
      fighter.consecutiveAttacks = 0;
      fighter.consecutiveBlocks = 0;
      break;
  }

  clampArena(fighter);
  return { initiatedAttack, initiatedDodge };
}

export function stepArena(
  red: FighterState,
  blue: FighterState,
  redAction: Action,
  blueAction: Action,
  rewardWeights: RewardWeights = DEFAULT_REWARD_WEIGHTS
): StepResult {
  if (red.x < blue.x) {
    red.facing = 1;
    blue.facing = -1;
  } else if (red.x > blue.x) {
    red.facing = -1;
    blue.facing = 1;
  }

  const prevDist = Math.abs(blue.x - red.x);

  // Phase 1: Movement & Attack Initiation (with forward strike lunge)
  const redMove = applyStateAndMovement(red, redAction, blue);
  const blueMove = applyStateAndMovement(blue, blueAction, red);

  enforceSolidSeparation(red, blue);

  // Compute effective combat distance (weighted primarily by X separation so minor Z sidesteps don't break punches)
  const dx = blue.x - red.x;
  const dz = (blue.z - red.z) * 0.35;
  const distNow = Math.sqrt(dx * dx + dz * dz);

  // Continuous shaping reward for closing distance vs stalling far away
  const potPrevR = -Math.abs(prevDist - 72) / 140;
  const potNextR = -Math.abs(distNow - 72) / 140;
  let redReward = (0.95 * potNextR - potPrevR) * 2.4 * weights.spacing - 0.03;
  let blueReward = (0.95 * potNextR - potPrevR) * 2.4 * weights.spacing - 0.03;
  if (redMove.initiatedAttack && distNow > KICK_RANGE + 5) redReward -= 1.25 * weights.spacing;
  if (blueMove.initiatedAttack && distNow > KICK_RANGE + 5) blueReward -= 1.25 * weights.spacing;

  const newDist = Math.abs(blue.x - red.x);
  if (prevDist > KICK_RANGE) {
    // Reward whoever actively closed the gap
    if (redAction === (red.x < blue.x ? 'moveRight' : 'moveLeft')) {
      redReward += 0.35 * rewardWeights.spacing;
    }
    if (blueAction === (blue.x < red.x ? 'moveRight' : 'moveLeft')) {
      blueReward += 0.35 * rewardWeights.spacing;
    }
  } else if (newDist <= KICK_RANGE) {
    redReward += 0.12 * rewardWeights.spacing;
    blueReward += 0.12 * rewardWeights.spacing;
  }

  // Penalize useless blocking when opponent is not attacking or out of range
  const redAttacking = redMove.initiatedAttack !== null;
  const blueAttacking = blueMove.initiatedAttack !== null;
  if (redAction === 'block' && (!blueAttacking || distNow > KICK_RANGE + 15)) {
    redReward -= 0.45 * rewardWeights.defense;
  }
  if (blueAction === 'block' && (!redAttacking || distNow > KICK_RANGE + 15)) {
    blueReward -= 0.45 * rewardWeights.defense;
  }

  // Phase 2: Resolve Strike Hits & Damage
  let redDamage = 0;
  let redBlocked = false;
  let blueEvaded = false;
  let blueGuardBroken = false;

  if (redMove.initiatedAttack) {
    const range = redMove.initiatedAttack === 'punch' ? PUNCH_RANGE : KICK_RANGE;
    if (distNow <= range) {
      if (blueMove.initiatedDodge || (blue.dodgeTimer || 0) > 0 || blue.animState === 'dodging' || blueAction === 'dodge') {
        redDamage = 0;
        blueEvaded = true;
      } else if (blue.isBlocking) {
        const raw = redMove.initiatedAttack === 'punch' ? PUNCH_DAMAGE : KICK_DAMAGE;
        if (redMove.initiatedAttack === 'kick' && (blue.stamina < 25 || (blue.consecutiveBlocks || 0) >= 3)) {
          // Guard Break! Kick shatters passive block
          redDamage = raw;
          blueGuardBroken = true;
          redBlocked = false;
        } else {
          redDamage = Math.max(3, Math.round(raw * (1 - BLOCK_REDUCTION)));
          redBlocked = true;
          blue.stamina = Math.max(0, blue.stamina - 16);
        }
      } else {
        redDamage = redMove.initiatedAttack === 'punch' ? PUNCH_DAMAGE : KICK_DAMAGE;
      }
    }
  }

  let blueDamage = 0;
  let blueBlocked = false;
  let redEvaded = false;
  let redGuardBroken = false;

  if (blueMove.initiatedAttack) {
    const range = blueMove.initiatedAttack === 'punch' ? PUNCH_RANGE : KICK_RANGE;
    if (distNow <= range) {
      if (redMove.initiatedDodge || (red.dodgeTimer || 0) > 0 || red.animState === 'dodging' || redAction === 'dodge') {
        blueDamage = 0;
        redEvaded = true;
      } else if (red.isBlocking) {
        const raw = blueMove.initiatedAttack === 'punch' ? PUNCH_DAMAGE : KICK_DAMAGE;
        if (blueMove.initiatedAttack === 'kick' && (red.stamina < 25 || (red.consecutiveBlocks || 0) >= 3)) {
          blueDamage = raw;
          redGuardBroken = true;
          blueBlocked = false;
        } else {
          blueDamage = Math.max(3, Math.round(raw * (1 - BLOCK_REDUCTION)));
          blueBlocked = true;
          red.stamina = Math.max(0, red.stamina - 16);
        }
      } else {
        blueDamage = blueMove.initiatedAttack === 'punch' ? PUNCH_DAMAGE : KICK_DAMAGE;
      }
    }
  }

  const baseIndicatorY = FLOOR_Y - ROBOT_HEIGHT - 16;
  const dirX = dx >= 0 ? 1 : -1;

  // Phase 3: Apply HP Reduction, Knockback, Hit Stun & RL Rewards
  if (redDamage > 0) {
    blue.hp = Math.max(0, blue.hp - redDamage);
    blue.hitFlash = 5;
    const isCrit = redDamage >= KICK_DAMAGE;
    blue.damageNumbers.push({
      value: redDamage,
      x: blue.x,
      y: baseIndicatorY,
      age: 0,
      isCrit,
      isBlocked: redBlocked,
      label: blueGuardBroken
        ? `GUARD BREAK -${redDamage}!`
        : redBlocked
        ? `BLOCKED -${redDamage}`
        : isCrit
        ? `KICK -${redDamage}!`
        : `-${redDamage} HP`,
    });

    const kb = redBlocked ? KNOCKBACK * 0.4 : isCrit ? KNOCKBACK * 1.2 : KNOCKBACK;
    blue.x += dirX * kb;
    clampArena(blue);

    if (!blue.isBlocking || blueGuardBroken) {
      blue.isBlocking = false;
      blue.animState = 'stunned';
      blue.animTimer = blueGuardBroken ? STUN_DURATION + 3 : STUN_DURATION;
    }

    redReward += redDamage * 1.2 * rewardWeights.aggression;
    blueReward -= redDamage * 1.0 * rewardWeights.survival;
    if (redBlocked) {
      blueReward += 4 * rewardWeights.defense;
    }
  }

  if (blueDamage > 0) {
    red.hp = Math.max(0, red.hp - blueDamage);
    red.hitFlash = 5;
    const isCrit = blueDamage >= KICK_DAMAGE;
    red.damageNumbers.push({
      value: blueDamage,
      x: red.x,
      y: baseIndicatorY,
      age: 0,
      isCrit,
      isBlocked: blueBlocked,
      label: redGuardBroken
        ? `GUARD BREAK -${blueDamage}!`
        : blueBlocked
        ? `BLOCKED -${blueDamage}`
        : isCrit
        ? `KICK -${blueDamage}!`
        : `-${blueDamage} HP`,
    });

    const kb = blueBlocked ? KNOCKBACK * 0.4 : isCrit ? KNOCKBACK * 1.2 : KNOCKBACK;
    red.x -= dirX * kb;
    clampArena(red);

    if (!red.isBlocking || redGuardBroken) {
      red.isBlocking = false;
      red.animState = 'stunned';
      red.animTimer = redGuardBroken ? STUN_DURATION + 3 : STUN_DURATION;
    }

    blueReward += blueDamage * 1.2 * rewardWeights.aggression;
    redReward -= blueDamage * 1.0 * rewardWeights.survival;
    if (blueBlocked) {
      redReward += 4 * rewardWeights.defense;
    }
  }

  enforceSolidSeparation(red, blue);

  if (redEvaded) {
    redReward += 8 * rewardWeights.defense;
    red.damageNumbers.push({ value: 0, x: red.x, y: baseIndicatorY, age: 0, isEvade: true, label: 'EVADED' });
  }
  if (blueEvaded) {
    blueReward += 8 * rewardWeights.defense;
    blue.damageNumbers.push({ value: 0, x: blue.x, y: baseIndicatorY, age: 0, isEvade: true, label: 'EVADED' });
  }

  let roundOver = false;
  let winner: 'red' | 'blue' | 'draw' | null = null;

  if (red.hp <= 0 || blue.hp <= 0) {
    roundOver = true;
    if (red.hp <= 0 && blue.hp <= 0) {
      winner = 'draw';
    } else if (red.hp <= 0) {
      winner = 'blue';
      blueReward += 80 * rewardWeights.winBonus;
      redReward -= 60 * rewardWeights.survival;
    } else {
      winner = 'red';
      redReward += 80 * rewardWeights.winBonus;
      blueReward -= 60 * rewardWeights.survival;
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
  Object.assign(red, createFighter(200, 1, 0));
  Object.assign(blue, createFighter(ARENA_WIDTH - 200, -1, 0));
}
