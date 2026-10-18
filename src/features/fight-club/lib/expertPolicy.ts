import {
  type FighterState,
  type Action,
  createFighter,
  discretizeState,
  ARENA_WIDTH,
  PUNCH_RANGE,
  KICK_RANGE,
  ACTIONS,
} from './fighter';
import { stepArena, resetRound } from './arena';
import { FightAgent } from './fightAgent';
import { extractObservation } from './dqnAgent';

/**
 * Competent, balanced tactical heuristic policy.
 * Weaves in tactical blocks and 3D sidestep dodges when threatened,
 * closes distance in 3D space, and executes crisp punch/kick combos.
 */
export function expertAction(self: FighterState, opponent: FighterState): Action {
  const dx = opponent.x - self.x;
  const dz = opponent.z - self.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  const oppAttacking = opponent.animState === 'punching' || opponent.animState === 'kicking';
  const oppStunned = opponent.animState === 'stunned';
  const canAct = self.cooldown <= 0 && self.animState !== 'stunned';

  // Determine approach vector along X axis
  let approachAction: Action = 'idle';
  if (Math.abs(dx) > 35) {
    approachAction = dx > 0 ? 'moveRight' : 'moveLeft';
  } else {
    approachAction = dx > 0 ? 'moveRight' : 'moveLeft';
  }

  // 1. Combo Limit & Spacing Reset: Prevent endless attack spamming
  const retreatAction: Action = dx > 0 ? 'moveLeft' : 'moveRight';
  if ((self.consecutiveAttacks || 0) >= 2 && canAct) {
    if (dist <= PUNCH_RANGE + 10) {
      return (self.x % 2 === 0) ? 'dodge' : retreatAction;
    }
    return 'block';
  }

  // 2. Critical Defense & Evade: Threatened by incoming strike
  if (oppAttacking && dist <= KICK_RANGE + 30 && canAct) {
    if (dist <= PUNCH_RANGE + 10) {
      return 'dodge'; // Agile evasive backstep
    }
    return 'block'; // Raise guard
  }

  // 3. Tactical Dodge: Low HP panic evasion
  if (self.hp < 30 && oppAttacking && canAct) {
    return 'dodge';
  }

  // 4. Punish stunned or recovering opponent with immediate strike
  if ((oppStunned || (opponent.cooldown > 4 && !opponent.isBlocking)) && canAct) {
    if (dist <= PUNCH_RANGE) return 'punch';
    if (dist <= KICK_RANGE) return 'kick';
    return approachAction;
  }

  // 5. Opponent is blocking: don't mindlessly spam punches into the shield
  if (opponent.isBlocking && canAct) {
    const roll = Math.abs(Math.floor(self.x + opponent.x + dist)) % 10;
    if (roll < 4 && dist <= KICK_RANGE) {
      return 'kick'; // Guard-break kick
    }
    if (roll < 7) {
      return 'dodge'; // Step back to reset neutral
    }
    return retreatAction; // Back up to bait shield drop
  }

  // 6. In close punch range: tactical strike mix with spacing
  if (dist <= PUNCH_RANGE && canAct) {
    const cadence = Math.abs(Math.floor(self.x * 3) + Math.floor(opponent.x * 2)) % 10;
    if (self.consecutiveAttacks >= 1) {
      // Already threw 1 strike: mix in spacing or guard
      if (cadence < 5) return 'punch';
      if (cadence < 7) return 'block';
      if (cadence < 9) return retreatAction;
      return 'dodge';
    }
    // Fresh strike opportunity
    if (cadence < 6) {
      return 'punch';
    } else if (cadence < 8) {
      return 'kick';
    } else if (cadence === 8) {
      return 'block';
    }
    return retreatAction; // Natural combat footsies
  }

  // 7. In kick range: calculated heavy strike or feint
  if (dist <= KICK_RANGE && canAct) {
    const cadence = Math.abs(Math.floor(self.x * 2) + Math.floor(opponent.x * 3)) % 10;
    if (cadence < 5) {
      return 'kick';
    } else if (cadence < 8) {
      return approachAction;
    }
    return 'block';
  }

  // 7. On cooldown while in close range: guard or reposition
  if (dist <= KICK_RANGE && self.cooldown > 0) {
    if (oppAttacking) return 'block';
    return 'idle';
  }

  // 8. Distance > striking range: close gap in 3D
  return approachAction;
}

// Warm-starts tabular Q-agent by simulating expert vs expert sparring
export function warmStartAgent(agent: FightAgent, episodes = 200) {
  const red = createFighter(150, 1, 0);
  const blue = createFighter(ARENA_WIDTH - 150, -1, 0);

  for (let ep = 0; ep < episodes; ep++) {
    resetRound(red, blue);
    let steps = 0;

    while (steps < 400) {
      const redDisc = discretizeState(red, blue);
      const redAct = expertAction(red, blue);
      const redActIdx = ACTIONS.indexOf(redAct as any);

      const blueDisc = discretizeState(blue, red);
      const blueAct = expertAction(blue, red);
      const blueActIdx = ACTIONS.indexOf(blueAct as any);

      const result = stepArena(red, blue, redAct, blueAct);

      const nextRedDisc = discretizeState(red, blue);
      const nextBlueDisc = discretizeState(blue, red);

      if (redActIdx >= 0) {
        agent.update(redDisc, redActIdx, result.redReward, nextRedDisc, result.roundOver);
      }
      if (blueActIdx >= 0) {
        agent.update(blueDisc, blueActIdx, result.blueReward, nextBlueDisc, result.roundOver);
      }

      steps++;
      if (result.roundOver) break;
    }
  }
}

// Warm-starts DQN agent by populating replay buffer with expert sparring transitions
export function warmStartDQNAgent(dqnAgent: any, episodes = 30) {
  const red = createFighter(150, 1, 0);
  const blue = createFighter(ARENA_WIDTH - 150, -1, 0);

  for (let ep = 0; ep < episodes; ep++) {
    resetRound(red, blue);
    let steps = 0;

    while (steps < 350) {
      const stateRed = extractObservation(red, blue);
      const stateBlue = extractObservation(blue, red);

      const redAct = expertAction(red, blue);
      const redActIdx = ACTIONS.indexOf(redAct as any);

      const blueAct = expertAction(blue, red);
      const blueActIdx = ACTIONS.indexOf(blueAct as any);

      const result = stepArena(red, blue, redAct, blueAct);

      const nextStateRed = extractObservation(red, blue);
      const nextStateBlue = extractObservation(blue, red);

      if (redActIdx >= 0) {
        dqnAgent.storeTransition(stateRed, redActIdx, result.redReward, nextStateRed, result.roundOver);
      }
      if (blueActIdx >= 0) {
        dqnAgent.storeTransition(stateBlue, blueActIdx, result.blueReward, nextStateBlue, result.roundOver);
      }

      // Perform a train step every 4 environment steps
      if (steps % 4 === 0) {
        dqnAgent.trainStep();
      }

      steps++;
      if (result.roundOver) break;
    }
    dqnAgent.decayEpsilon();
  }
}

