import { NeuralNetwork } from '../../../lib/nn/network';
import { relu, linear } from '../../../lib/math/activations';
import {
  type FighterState,
  type Action,
  ACTIONS,
  NUM_ACTIONS,
  ARENA_WIDTH,
  ARENA_DEPTH,
  MAX_HP,
  PUNCH_RANGE,
  KICK_RANGE,
} from './fighter';

export const OBSERVATION_SIZE = 16;

/**
 * Extracts a side-invariant (ego-centric) 16-dimensional continuous feature vector
 * so the trained Q-network generalizes identically whether playing as Red (left) or Blue (right).
 */
export function extractObservation(self: FighterState, opponent: FighterState): number[] {
  const onLeft = self.x <= opponent.x;
  const egoSelfX = onLeft ? self.x / ARENA_WIDTH : (ARENA_WIDTH - self.x) / ARENA_WIDTH;
  const egoOppX = onLeft ? opponent.x / ARENA_WIDTH : (ARENA_WIDTH - opponent.x) / ARENA_WIDTH;

  const normSelfZ = Math.max(0, Math.min(1, (self.z + ARENA_DEPTH / 2) / ARENA_DEPTH));
  const normSelfHp = Math.max(0, Math.min(1, self.hp / MAX_HP));

  const normOppZ = Math.max(0, Math.min(1, (opponent.z + ARENA_DEPTH / 2) / ARENA_DEPTH));
  const normOppHp = Math.max(0, Math.min(1, opponent.hp / MAX_HP));

  const dx = Math.abs(opponent.x - self.x);
  const dz = (opponent.z - self.z) * 0.35;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const normDist = Math.max(0, Math.min(1, dist / ARENA_WIDTH));

  const inPunchRange = dist <= PUNCH_RANGE ? 1 : 0;
  const inKickRange = dist <= KICK_RANGE ? 1 : 0;
  const hpAdvantage = Math.max(-1, Math.min(1, (self.hp - opponent.hp) / MAX_HP));

  const selfReady = self.cooldown <= 0 ? 1 : 0;
  const selfBlocking = self.isBlocking ? 1 : 0;
  const selfStunned = self.animState === 'stunned' ? 1 : 0;

  const oppBlocking = opponent.isBlocking ? 1 : 0;
  const oppAttacking = opponent.animState === 'punching' || opponent.animState === 'kicking' ? 1 : 0;
  const oppThreat = oppAttacking && dist <= KICK_RANGE + 20 ? 1 : 0;

  return [
    egoSelfX,
    normSelfZ,
    normSelfHp,
    egoOppX,
    normOppZ,
    normOppHp,
    normDist,
    inPunchRange,
    inKickRange,
    hpAdvantage,
    selfReady,
    selfBlocking,
    selfStunned,
    oppBlocking,
    oppAttacking,
    oppThreat,
  ];
}

export interface Transition {
  state: number[];
  action: number;
  reward: number;
  nextState: number[];
  done: boolean;
}

export class ReplayBuffer {
  capacity: number;
  buffer: Transition[];
  position: number;

  constructor(capacity = 5000) {
    this.capacity = capacity;
    this.buffer = [];
    this.position = 0;
  }

  push(transition: Transition): void {
    if (this.buffer.length < this.capacity) {
      this.buffer.push(transition);
    } else {
      this.buffer[this.position] = transition;
    }
    this.position = (this.position + 1) % this.capacity;
  }

  sample(batchSize: number): Transition[] {
    const size = this.buffer.length;
    if (size === 0) return [];
    const count = Math.min(batchSize, size);
    const result: Transition[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * size);
      result[i] = this.buffer[idx];
    }
    return result;
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
    this.position = 0;
  }
}

export interface DQNConfig {
  learningRate: number;
  gamma: number;
  epsilonStart: number;
  epsilonMin: number;
  epsilonDecay: number;
  batchSize: number;
  targetUpdateFreq: number;
  tau: number;
  bufferCapacity: number;
}

export const DEFAULT_DQN_CONFIG: DQNConfig = {
  learningRate: 0.008,
  gamma: 0.95,
  epsilonStart: 0.35,
  epsilonMin: 0.05,
  epsilonDecay: 0.992,
  batchSize: 32,
  targetUpdateFreq: 80,
  tau: 0.2,
  bufferCapacity: 5000,
};

export interface SerializedDQN {
  format: 'robo-dojo-agent';
  version: '1.0';
  name: string;
  timestamp: string;
  architecture: {
    inputSize: number;
    hiddenLayers: number[];
    outputSize: number;
  };
  weights: number[][][];
  biases: number[][];
  config: DQNConfig;
  stats?: {
    episodesTrained: number;
    winRate: number;
    avgReward: number;
  };
}

export class DQNAgent {
  qNetwork: NeuralNetwork;
  targetNetwork: NeuralNetwork;
  replayBuffer: ReplayBuffer;
  config: DQNConfig;
  epsilon: number;
  stepCount: number;
  episodesTrained: number;
  lastLoss: number;
  lastTDError: number;
  lastTargetQ: number;
  lossHistory: number[];
  recentRewards: number[];

  constructor(config: Partial<DQNConfig> = {}) {
    this.config = { ...DEFAULT_DQN_CONFIG, ...config };
    this.epsilon = this.config.epsilonStart;
    this.stepCount = 0;
    this.episodesTrained = 0;
    this.lastLoss = 0;
    this.lastTDError = 0;
    this.lastTargetQ = 0;
    this.lossHistory = [];
    this.recentRewards = [];

    const layerSizes = [OBSERVATION_SIZE, 32, 24, NUM_ACTIONS];
    this.qNetwork = new NeuralNetwork(layerSizes, relu, linear);
    this.targetNetwork = this.qNetwork.clone();
    this.replayBuffer = new ReplayBuffer(this.config.bufferCapacity);
  }

  predict(state: number[]): number[] {
    return this.qNetwork.forward(state);
  }

  predictTarget(state: number[]): number[] {
    return this.targetNetwork.forward(state);
  }

  /**
   * Maps world action index (0=moveLeft, 1=moveRight) to ego-centric network index
   * (0=retreat, 1=approach) when fighter is on the right side of the opponent.
   */
  toEgoActionIdx(worldActionIdx: number, self?: FighterState, opponent?: FighterState): number {
    if (!self || !opponent) return worldActionIdx;
    if (self.x > opponent.x) {
      if (worldActionIdx === 0) return 1; // moveLeft is approach when on right
      if (worldActionIdx === 1) return 0; // moveRight is retreat when on right
    }
    return worldActionIdx;
  }

  chooseAction(
    state: number[],
    greedy = false,
    self?: FighterState,
    opponent?: FighterState
  ): {
    action: Action;
    actionIdx: number;
    qValues: number[];
    isExploration: boolean;
  } {
    const rawEgoQ = this.predict(state);
    // Map ego Q-values [0=retreat, 1=approach] back to world [0=moveLeft, 1=moveRight]
    const worldQ = [...rawEgoQ];
    if (self && opponent && self.x > opponent.x) {
      worldQ[0] = rawEgoQ[1]; // moveLeft = approach
      worldQ[1] = rawEgoQ[0]; // moveRight = retreat
    }

    const qValues = [...worldQ];
    const legalMask = [true, true, true, true, true, true];

    if (self && opponent) {
      if (self.animState === 'stunned') {
        return { action: 'idle', actionIdx: -1, qValues, isExploration: false };
      }
      if (self.cooldown > 0 || self.stamina < 6) {
        legalMask[2] = false;
        legalMask[3] = false;
      }
      if ((self.dodgeCooldown || 0) > 0 || self.stamina < 10) {
        legalMask[5] = false;
      }
      if ((self.consecutiveAttacks || 0) >= 3) {
        qValues[2] -= 0.65;
        qValues[3] -= 0.65;
      }
    }

    const validIndices: number[] = [];
    for (let i = 0; i < NUM_ACTIONS; i++) {
      if (legalMask[i]) validIndices.push(i);
    }
    const eligibleIndices = validIndices.length > 0 ? validIndices : [0, 1];

    if (!greedy && Math.random() < this.epsilon) {
      const randomIdx = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
      return {
        action: ACTIONS[randomIdx],
        actionIdx: randomIdx,
        qValues: worldQ,
        isExploration: true,
      };
    }

    let bestIdx = eligibleIndices[0];
    let bestVal = qValues[bestIdx];
    for (const idx of eligibleIndices) {
      if (qValues[idx] > bestVal) {
        bestVal = qValues[idx];
        bestIdx = idx;
      }
    }

    return {
      action: ACTIONS[bestIdx],
      actionIdx: bestIdx,
      qValues: worldQ,
      isExploration: false,
    };
  }

  storeTransition(
    state: number[],
    action: number,
    reward: number,
    nextState: number[],
    done: boolean,
    self?: FighterState,
    opponent?: FighterState
  ): void {
    const egoAct = this.toEgoActionIdx(action, self, opponent);
    if (egoAct >= 0 && egoAct < NUM_ACTIONS) {
      this.replayBuffer.push({ state, action: egoAct, reward, nextState, done });
      // Immediate single-transition TD update so the robot learns from every single action
      const curQ = this.predict(state);
      let targetQ = reward;
      if (!done) {
        const nextTargetQ = this.predictTarget(nextState);
        targetQ += this.config.gamma * Math.max(...nextTargetQ);
      }
      const err = Math.max(-4, Math.min(4, curQ[egoAct] - targetQ));
      const grad = new Array(NUM_ACTIONS).fill(0);
      grad[egoAct] = err;
      this.qNetwork.backward(grad, this.config.learningRate);
    }
  }

  trainStep(): { loss: number; tdError: number; targetQ: number } | null {
    if (this.replayBuffer.size() < 16) {
      return null;
    }

    const batch = this.replayBuffer.sample(Math.min(this.config.batchSize, this.replayBuffer.size()));
    let totalLoss = 0;
    let lastErr = 0;
    let lastTgt = 0;

    for (const transition of batch) {
      const { state, action, reward, nextState, done } = transition;
      const currentQ = this.predict(state);

      let targetQ = reward;
      if (!done) {
        const nextTargetQ = this.predictTarget(nextState);
        const maxNextTarget = Math.max(...nextTargetQ);
        targetQ += this.config.gamma * maxNextTarget;
      }

      const currentVal = currentQ[action];
      const error = currentVal - targetQ;
      const clippedError = Math.max(-4, Math.min(4, error));

      lastErr = targetQ - currentVal;
      lastTgt = targetQ;
      totalLoss += clippedError * clippedError;

      const outputGradient = new Array(NUM_ACTIONS).fill(0);
      outputGradient[action] = clippedError;

      this.qNetwork.backward(outputGradient, this.config.learningRate);
    }

    const avgLoss = totalLoss / batch.length;
    this.lastLoss = avgLoss;
    this.lastTDError = lastErr;
    this.lastTargetQ = lastTgt;

    if (this.lossHistory.length >= 100) {
      this.lossHistory.shift();
    }
    this.lossHistory.push(avgLoss);

    this.stepCount++;

    if (this.stepCount % this.config.targetUpdateFreq === 0) {
      this.targetNetwork.copyWeightsFrom(this.qNetwork, this.config.tau);
    }

    return { loss: avgLoss, tdError: lastErr, targetQ: lastTgt };
  }

  decayEpsilon(): void {
    this.epsilon = Math.max(this.config.epsilonMin, this.epsilon * this.config.epsilonDecay);
    this.episodesTrained++;
  }

  updateTargetNetworkHard(): void {
    this.targetNetwork.copyWeightsFrom(this.qNetwork, 1.0);
  }

  reset(): void {
    const layerSizes = [OBSERVATION_SIZE, 32, 24, NUM_ACTIONS];
    this.qNetwork = new NeuralNetwork(layerSizes, relu, linear);
    this.targetNetwork = this.qNetwork.clone();
    this.replayBuffer.clear();
    this.epsilon = this.config.epsilonStart;
    this.stepCount = 0;
    this.episodesTrained = 0;
    this.lastLoss = 0;
    this.lastTDError = 0;
    this.lastTargetQ = 0;
    this.lossHistory = [];
    this.recentRewards = [];
  }

  exportToJSON(name = 'RoboDojo-Agent'): string {
    const { weights, biases } = this.qNetwork.getWeightsAndBiases();
    const avgRew =
      this.recentRewards.length > 0
        ? this.recentRewards.reduce((a, b) => a + b, 0) / this.recentRewards.length
        : 0;

    const data: SerializedDQN = {
      format: 'robo-dojo-agent',
      version: '1.0',
      name,
      timestamp: new Date().toISOString(),
      architecture: {
        inputSize: OBSERVATION_SIZE,
        hiddenLayers: [32, 24],
        outputSize: NUM_ACTIONS,
      },
      weights,
      biases,
      config: { ...this.config },
      stats: {
        episodesTrained: this.episodesTrained,
        winRate: 0,
        avgReward: Number(avgRew.toFixed(1)),
      },
    };

    return JSON.stringify(data, null, 2);
  }

  importFromJSON(jsonString: string): { success: boolean; error?: string } {
    try {
      const data = JSON.parse(jsonString) as SerializedDQN;
      if (!data || data.format !== 'robo-dojo-agent') {
        return { success: false, error: 'Invalid file format. Expected robo-dojo-agent format.' };
      }
      if (
        !data.architecture ||
        data.architecture.inputSize !== OBSERVATION_SIZE ||
        data.architecture.outputSize !== NUM_ACTIONS
      ) {
        return {
          success: false,
          error: `Architecture mismatch. Expected input: ${OBSERVATION_SIZE}, output: ${NUM_ACTIONS}`,
        };
      }
      if (!Array.isArray(data.weights) || !Array.isArray(data.biases)) {
        return { success: false, error: 'Malformed weights or biases in model payload.' };
      }
      for (const layerW of data.weights) {
        for (const row of layerW) {
          for (const val of row) {
            if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
              return { success: false, error: 'Model contains NaN or infinite weights.' };
            }
          }
        }
      }
      this.qNetwork.setWeightsAndBiases(data.weights, data.biases);
      this.targetNetwork.copyWeightsFrom(this.qNetwork, 1.0);
      if (data.config) {
        this.config = { ...this.config, ...data.config };
      }
      if (data.stats?.episodesTrained) {
        this.episodesTrained = data.stats.episodesTrained;
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Failed to parse JSON model: ${err.message}` };
    }
  }
}
