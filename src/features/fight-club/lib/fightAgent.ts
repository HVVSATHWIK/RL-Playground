import { NUM_ACTIONS, STATE_SPACE_SIZE, type Action, ACTIONS } from './fighter';

export class FightAgent {
  qTable: Float32Array;
  epsilon: number;
  alpha: number;
  gamma: number;
  prevState: number;
  prevAction: number;

  constructor(epsilon = 0.3, alpha = 0.15, gamma = 0.95) {
    this.qTable = new Float32Array(STATE_SPACE_SIZE * NUM_ACTIONS);
    this.epsilon = epsilon;
    this.alpha = alpha;
    this.gamma = gamma;
    this.prevState = 0;
    this.prevAction = 0;
  }

  getQ(state: number, action: number): number {
    return this.qTable[state * NUM_ACTIONS + action];
  }

  setQ(state: number, action: number, value: number): void {
    this.qTable[state * NUM_ACTIONS + action] = value;
  }

  chooseAction(state: number, self?: import('./fighter').FighterState, opponent?: import('./fighter').FighterState): Action {
    if (self?.animState === 'stunned') return 'idle';

    // Combat action mask
    const legal = [true, true, true, true, true, true]; // [moveLeft, moveRight, punch, kick, block, dodge]
    if (self && opponent) {
      const dx = opponent.x - self.x;
      const dz = opponent.z - self.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (self.cooldown > 0) {
        legal[2] = false; // punch
        legal[3] = false; // kick
        legal[5] = false; // dodge
      }
      if (dist > 85) {
        legal[2] = false;
        legal[3] = false;
      }
      // Combat combo limit
      if ((self.consecutiveAttacks || 0) >= 2) {
        legal[2] = false;
        legal[3] = false;
      }
    }

    const validIndices: number[] = [];
    for (let i = 0; i < NUM_ACTIONS; i++) {
      if (legal[i]) validIndices.push(i);
    }
    const pool = validIndices.length > 0 ? validIndices : [0, 1, 2, 3, 4, 5];

    if (Math.random() < this.epsilon) {
      return ACTIONS[pool[Math.floor(Math.random() * pool.length)]];
    }
    return ACTIONS[this.greedyAction(state, pool)];
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

  update(state: number, action: number, reward: number, nextState: number, done: boolean): void {
    const maxNext = done ? 0 : this.getQ(nextState, this.greedyAction(nextState));
    const current = this.getQ(state, action);
    const newVal = current + this.alpha * (reward + this.gamma * maxNext - current);
    this.setQ(state, action, newVal);
  }

  reset(): void {
    this.qTable.fill(0);
  }
}
