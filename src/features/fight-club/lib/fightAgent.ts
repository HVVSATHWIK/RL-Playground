import { NUM_ACTIONS, STATE_SPACE_SIZE, type Action, ACTIONS, KICK_RANGE, PUNCH_RANGE } from './fighter';

export class FightAgent {
  qTable: Float32Array;
  epsilon: number;
  alpha: number;
  gamma: number;
  prevState: number;
  prevAction: number;
  lastTDError: number;
  visitedStates: Set<number>;

  constructor(epsilon = 0.2, alpha = 0.2, gamma = 0.95) {
    this.qTable = new Float32Array(STATE_SPACE_SIZE * NUM_ACTIONS);
    this.epsilon = epsilon;
    this.alpha = alpha;
    this.gamma = gamma;
    this.prevState = 0;
    this.prevAction = 0;
    this.lastTDError = 0;
    this.visitedStates = new Set<number>();
  }

  getQ(state: number, action: number): number {
    return this.qTable[state * NUM_ACTIONS + action];
  }

  setQ(state: number, action: number, value: number): void {
    this.qTable[state * NUM_ACTIONS + action] = value;
  }

  toEgoAction(worldIdx: number, self?: import('./fighter').FighterState, opponent?: import('./fighter').FighterState): number {
    if (self && opponent && self.x > opponent.x) {
      if (worldIdx === 0) return 1;
      if (worldIdx === 1) return 0;
    }
    return worldIdx;
  }

  chooseAction(state: number, self?: import('./fighter').FighterState, opponent?: import('./fighter').FighterState): Action {
    if (self?.animState === 'stunned') return 'idle';

    const legal = [true, true, true, true, true, true];
    if (self && opponent) {
      const dx = Math.abs(opponent.x - self.x);
      const dz = (opponent.z - self.z) * 0.35;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const approachIdx = self.x < opponent.x ? 1 : 0;
      const retreatIdx = self.x < opponent.x ? 0 : 1;
      const oppAttacking = opponent.animState === 'punching' || opponent.animState === 'kicking';

      if (self.cooldown > 0) {
        legal[2] = false;
        legal[3] = false;
        legal[5] = false;
      }
      if (dist > KICK_RANGE + 18) {
        legal[2] = false;
        legal[3] = false;
        legal[4] = false;
        legal[5] = false;
        legal[retreatIdx] = false;
      } else if (dist > PUNCH_RANGE + 12) {
        legal[2] = false;
      }
      if (!oppAttacking && dist > PUNCH_RANGE + 10) {
        legal[4] = false;
      }
      if ((self.consecutiveAttacks || 0) >= 3) {
        legal[2] = false;
        legal[3] = false;
      }
      void approachIdx;
    }

    const validIndices: number[] = [];
    for (let i = 0; i < NUM_ACTIONS; i++) {
      if (legal[i]) validIndices.push(i);
    }
    const pool = validIndices.length > 0 ? validIndices : [0, 1];

    if (Math.random() < this.epsilon) {
      return ACTIONS[pool[Math.floor(Math.random() * pool.length)]];
    }

    let bestWorld = pool[0];
    let bestVal = this.getQ(state, this.toEgoAction(bestWorld, self, opponent));
    for (const wIdx of pool) {
      const v = this.getQ(state, this.toEgoAction(wIdx, self, opponent));
      if (v > bestVal) {
        bestVal = v;
        bestWorld = wIdx;
      }
    }
    return ACTIONS[bestWorld];
  }

  greedyAction(state: number, pool?: number[]): number {
    const candidates = pool && pool.length > 0 ? pool : [0, 1, 2, 3, 4, 5];
    let best = candidates[0];
    let bestVal = this.getQ(state, best);
    for (const a of candidates) {
      const v = this.getQ(state, a);
      if (v > bestVal) {
        bestVal = v;
        best = a;
      }
    }
    return best;
  }

  update(
    state: number,
    action: number,
    reward: number,
    nextState: number,
    done: boolean,
    self?: import('./fighter').FighterState,
    opponent?: import('./fighter').FighterState
  ): void {
    const egoAct = this.toEgoAction(action, self, opponent);
    this.visitedStates.add(state);
    const maxNext = done ? 0 : this.getQ(nextState, this.greedyAction(nextState));
    const current = this.getQ(state, egoAct);
    const tdError = reward + this.gamma * maxNext - current;
    this.lastTDError = tdError;
    const newVal = current + this.alpha * tdError;
    this.setQ(state, egoAct, newVal);
  }

  reset(): void {
    this.qTable.fill(0);
    this.visitedStates.clear();
  }
}
