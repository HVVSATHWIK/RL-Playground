import { ACTIONS, type Action } from './gridWorld';

export class SarsaAgent {
  qTable: number[][][];
  epsilon: number;
  alpha: number;
  gamma: number;
  height: number;
  width: number;

  constructor(height: number, width: number, epsilon = 0.3, alpha = 0.1, gamma = 0.95) {
    this.height = height;
    this.width = width;
    this.epsilon = epsilon;
    this.alpha = alpha;
    this.gamma = gamma;
    this.qTable = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => new Array(4).fill(0))
    );
  }

  chooseAction(row: number, col: number): Action {
    if (Math.random() < this.epsilon) {
      return ACTIONS[Math.floor(Math.random() * 4)];
    }
    return this.greedyAction(row, col);
  }

  greedyAction(row: number, col: number): Action {
    const qValues = this.qTable[row][col];
    let bestAction = 0;
    let bestValue = qValues[0];
    for (let a = 1; a < 4; a++) {
      if (qValues[a] > bestValue) {
        bestValue = qValues[a];
        bestAction = a;
      }
    }
    return bestAction as Action;
  }

  update(
    row: number, col: number, action: Action,
    reward: number,
    nextRow: number, nextCol: number,
    nextAction: Action,
    done: boolean
  ): { oldQ: number; newQ: number; target: number } {
    const oldQ = this.qTable[row][col][action];
    const nextQ = done ? 0 : this.qTable[nextRow][nextCol][nextAction];
    const target = reward + this.gamma * nextQ;
    const newQ = oldQ + this.alpha * (target - oldQ);
    this.qTable[row][col][action] = newQ;
    return { oldQ, newQ, target };
  }

  getPolicy(): number[][] {
    return this.qTable.map(row => row.map(cell => {
      let best = 0;
      for (let a = 1; a < 4; a++) {
        if (cell[a] > cell[best]) best = a;
      }
      return best;
    }));
  }

  getStateValues(): number[][] {
    return this.qTable.map(row => row.map(cell => Math.max(...cell)));
  }

  reset(): void {
    this.qTable = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => new Array(4).fill(0))
    );
  }
}
