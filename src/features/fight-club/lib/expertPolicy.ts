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

export function expertAction(self: FighterState, opponent: FighterState): Action {
  const dx = opponent.x - self.x;
  const dz = (opponent.z - self.z) * 0.35;
  const dist = Math.sqrt(dx * dx + dz * dz);

  const oppAttacking = opponent.animState === 'punching' || opponent.animState === 'kicking';
  const oppStunned = opponent.animState === 'stunned';
  const canAct = self.cooldown <= 0 && self.animState !== 'stunned';

  const approachAction: Action = dx > 0 ? 'moveRight' : 'moveLeft';
  const retreatAction: Action = dx > 0 ? 'moveLeft' : 'moveRight';

  // 1. Out of strike range: always close the gap aggressively
  if (dist > KICK_RANGE + 5) {
    return approachAction;
  }

  // 2. Combo reset after 3 strikes
  if ((self.consecutiveAttacks || 0) >= 3 && canAct) {
    return dist <= PUNCH_RANGE ? 'dodge' : retreatAction;
  }

  // 3. React to incoming attack when in threat range
  if (oppAttacking && dist <= KICK_RANGE + 10 && canAct) {
    return Math.random() < 0.45 ? 'dodge' : 'block';
  }

  // 4. Punish stunned or blocking opponent
  if (oppStunned && canAct) {
    return dist <= PUNCH_RANGE ? 'punch' : 'kick';
  }
  if (opponent.isBlocking && canAct) {
    return dist <= KICK_RANGE ? 'kick' : approachAction;
  }

  // 5. In Punch range: execute rapid jab/cross/kick combinations
  if (dist <= PUNCH_RANGE && canAct) {
    return Math.random() < 0.65 ? 'punch' : 'kick';
  }

  // 6. In Kick range: heavy kick or step into punch range
  if (dist <= KICK_RANGE && canAct) {
    return Math.random() < 0.65 ? 'kick' : approachAction;
  }

  // 7. On cooldown at close range: footwork or brief guard if opponent swings
  if (oppAttacking) return 'block';
  return dist > PUNCH_RANGE ? approachAction : 'idle';
}

export function warmStartAgent(agent: FightAgent, episodes = 120) {
  const red = createFighter(200, 1, 0);
  const blue = createFighter(ARENA_WIDTH - 200, -1, 0);

  for (let ep = 0; ep < episodes; ep++) {
    resetRound(red, blue);
    let steps = 0;
    while (steps < 300) {
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
        agent.update(redDisc, redActIdx, result.redReward, nextRedDisc, result.roundOver, red, blue);
      }
      if (blueActIdx >= 0) {
        agent.update(blueDisc, blueActIdx, result.blueReward, nextBlueDisc, result.roundOver, blue, red);
      }

      steps++;
      if (result.roundOver) break;
    }
  }
}

export function warmStartDQNAgent(dqnAgent: any, episodes = 35) {
  const red = createFighter(200, 1, 0);
  const blue = createFighter(ARENA_WIDTH - 200, -1, 0);

  for (let ep = 0; ep < episodes; ep++) {
    resetRound(red, blue);
    let steps = 0;
    while (steps < 280) {
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
        dqnAgent.storeTransition(stateRed, redActIdx, result.redReward, nextStateRed, result.roundOver, red, blue);
      }
      if (blueActIdx >= 0) {
        dqnAgent.storeTransition(stateBlue, blueActIdx, result.blueReward, nextStateBlue, result.roundOver, blue, red);
      }

      if (steps % 3 === 0) {
        dqnAgent.trainStep();
      }

      steps++;
      if (result.roundOver) break;
    }
    dqnAgent.decayEpsilon();
  }
}
