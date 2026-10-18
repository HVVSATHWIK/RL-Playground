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
 * Extracts a normalized 16-dimensional continuous feature vector from fighter states.
 */
export function extractObservation(self: FighterState, opponent: FighterState): number[] {
  const normSelfX = Math.max(0, Math.min(1, self.x / ARENA_WIDTH));
  const normSelfZ = Math.max(0, Math.min(1, (self.z + ARENA_DEPTH / 2) / ARENA_DEPTH));
  const normSelfHp = Math.max(0, Math.min(1, self.hp / MAX_HP));

  const normOppX = Math.max(0, Math.min(1, opponent.x / ARENA_WIDTH));
  const normOppZ = Math.max(0, Math.min(1, (opponent.z + ARENA_DEPTH / 2) / ARENA_DEPTH));
  const normOppHp = Math.max(0, Math.min(1, opponent.hp / MAX_HP));

  const dx = opponent.x - self.x;
  const dz = opponent.z - self.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const normDist = Math.max(0, Math.min(1, dist / ARENA_WIDTH));

  const facingOpponent = self.x <= opponent.x ? 1 : -1;
  const hpAdvantage = Math.max(-1, Math.min(1, (self.hp - opponent.hp) / MAX_HP));

  const selfReady = self.cooldown <= 0 ? 1 : 0;
  const selfBlocking = self.isBlocking ? 1 : 0;
  const selfStunned = self.animState === 'stunned' ? 1 : 0;
  const selfAttacking = self.animState === 'punching' || self.animState === 'kicking' ? 1 : 0;

  const oppBlocking = opponent.isBlocking ? 1 : 0;
  const oppAttacking = opponent.animState === 'punching' || opponent.animState === 'kicking' ? 1 : 0;
  const oppThreat = oppAttacking && dist <= KICK_RANGE + 20 ? 1 : 0;

  return [
    normSelfX,
    normSelfZ,
    normSelfHp,
    normOppX,
    normOppZ,
    normOppHp,
    normDist,
    facingOpponent,
    hpAdvantage,
    selfReady,
    selfBlocking,
    selfStunned,
    selfAttacking,
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
  learningRate: 0.005,
  gamma: 0.95,
  epsilonStart: 0.8,
  epsilonMin: 0.05,
  epsilonDecay: 0.995,
  batchSize: 32,
  targetUpdateFreq: 120,
  tau: 0.15,
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
  lossHistory: number[];
  recentRewards: number[];

  constructor(config: Partial<DQNConfig> = {}) {
    this.config = { ...DEFAULT_DQN_CONFIG, ...config };
    this.epsilon = this.config.epsilonStart;
    this.stepCount = 0;
    this.episodesTrained = 0;
    this.lastLoss = 0;
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
   * Action selection using the trained Q-network with combat action validation.
   * Prevents picking unavailable attacks (on cooldown / out of range) or moving into walls.
   */
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
    const rawQValues = this.predict(state);
    const qValues = [...rawQValues];

    // Determine legal action masks based on fighter state and spatial geometry
    // Actions: [0: moveLeft, 1: moveRight, 2: punch, 3: kick, 4: block, 5: dodge]
    const legalMask = [true, true, true, true, true, true];

    if (self && opponent) {
      const dx = opponent.x - self.x;
      const dz = opponent.z - self.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const isCoolingDown = self.cooldown > 0;
      const isStunned = self.animState === 'stunned';
      const oppAttacking = opponent.animState === 'punching' || opponent.animState === 'kicking';

      const approachXIdx = self.x < opponent.x ? 1 : 0; // 1 = moveRight, 0 = moveLeft
      const retreatXIdx = self.x < opponent.x ? 0 : 1;

      if (isStunned) {
        // Stunned: can only idle / recover
        return {
          action: 'idle',
          actionIdx: -1,
          qValues,
          isExploration: false,
        };
      }

      // 1. Cooldown constraints: attacks and dodge require cooldown recovery
      if (isCoolingDown) {
        legalMask[2] = false; // punch
        legalMask[3] = false; // kick
        legalMask[5] = false; // dodge
      }

      // 2. Range constraints: mask out attacks when out of strike reach
      if (dist > KICK_RANGE + 15) {
        legalMask[2] = false; // punch
        legalMask[3] = false; // kick
      }

      // 3. Corner constraints: don't retreat when already far
      if (dist > KICK_RANGE + 40) {
        legalMask[retreatXIdx] = false;
      }

      // 4. Combat Rhythm & Combo Pacing: Prevent endless mindless attack spam
      const hasComboed = (self.consecutiveAttacks || 0) >= 2;
      if (hasComboed) {
        // Combo limit reached: fighter must reset neutral, step back, feint, or raise guard
        legalMask[2] = false; // Disallow punch immediately after combo
        legalMask[3] = false; // Disallow kick immediately after combo
        qValues[retreatXIdx] += 1.2; // Step back to reset neutral spacing
        qValues[5] += 1.0; // Tactical backward dodge
        qValues[4] += 0.8; // Or raise guard
      }

      // 5. Strategic Defense Against Incoming Strikes
      if (oppAttacking && dist <= KICK_RANGE + 30) {
        // Opponent is actively swinging! Raise guard or dodge out of way, do not blindly trade hits!
        qValues[2] -= 1.5; // Penalize punching directly into incoming strike
        qValues[3] -= 1.5; // Penalize kicking directly into incoming strike
        qValues[4] += 2.0; // Strong boost to tactical Block
        qValues[5] += 1.8; // Strong boost to evasive Dodge
      } else if (!oppAttacking && dist > 120) {
        // Discourage passive block spam at long range
        qValues[4] -= 0.6;
      }

      // 6. Tactical Response to Opponent Shield / Block
      if (opponent.isBlocking && dist <= KICK_RANGE + 10) {
        // Opponent is blocking: do NOT punch blindly into the shield
        qValues[2] -= 1.2; // Discourage punch into block
        qValues[3] += 0.6; // Heavy kick can challenge or break guard
        qValues[retreatXIdx] += 0.8; // Or step back to bait shield drop
        qValues[5] += 0.7; // Or dodge back
      }

      // 7. Tactical Strike Opportunities (Measured, calculated pacing)
      if (!hasComboed && !oppAttacking) {
        if (dist <= PUNCH_RANGE && !isCoolingDown) {
          if (!opponent.isBlocking) {
            qValues[2] += 0.5; // High priority punch on exposed opponent
          }
        } else if (dist <= KICK_RANGE && !isCoolingDown) {
          qValues[3] += 0.45; // Kick opportunity at mid-range
        }
      }

      // 8. Movement Spacing & Footsies (Closing or maintaining ideal strike distance)
      if (dist > KICK_RANGE + 5) {
        qValues[approachXIdx] += 0.55; // Close distance
      } else if (dist < 40 && !isCoolingDown && !oppAttacking) {
        // Too crowded: step back slightly for leverage
        qValues[retreatXIdx] += 0.35;
      }
    }

    // Get list of valid action indices
    const validIndices: number[] = [];
    for (let i = 0; i < NUM_ACTIONS; i++) {
      if (legalMask[i]) validIndices.push(i);
    }
    const eligibleIndices = validIndices.length > 0 ? validIndices : [0, 1, 2, 3, 4, 5];

    // Epsilon-greedy exploration
    if (!greedy && Math.random() < this.epsilon) {
      const randomIdx = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
      return {
        action: ACTIONS[randomIdx],
        actionIdx: randomIdx,
        qValues: rawQValues,
        isExploration: true,
      };
    }

    // Greedy exploitation among eligible legal combat actions
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
      qValues: rawQValues,
      isExploration: false,
    };
  }

  storeTransition(state: number[], action: number, reward: number, nextState: number[], done: boolean): void {
    if (action >= 0 && action < NUM_ACTIONS) {
      this.replayBuffer.push({ state, action, reward, nextState, done });
    }
  }

  trainStep(): { loss: number } | null {
    if (this.replayBuffer.size() < this.config.batchSize) {
      return null;
    }

    const batch = this.replayBuffer.sample(this.config.batchSize);
    let totalLoss = 0;

    for (const transition of batch) {
      const { state, action, reward, nextState, done } = transition;

      // Current Q predictions
      const currentQ = this.predict(state);

      // Target calculation using Bellman equation with Target Network
      let targetQ = reward;
      if (!done) {
        const nextTargetQ = this.predictTarget(nextState);
        const maxNextTarget = Math.max(...nextTargetQ);
        targetQ += this.config.gamma * maxNextTarget;
      }

      // Compute TD error and clip for numerical stability (Huber loss gradient clipping)
      const currentVal = currentQ[action];
      const error = currentVal - targetQ;
      const clippedError = Math.max(-4, Math.min(4, error));

      totalLoss += clippedError * clippedError;

      // Output gradient: 0 for all actions except the chosen one
      const outputGradient = new Array(NUM_ACTIONS).fill(0);
      outputGradient[action] = clippedError;

      // Backpropagation through primary Q-network
      this.qNetwork.backward(outputGradient, this.config.learningRate);
    }

    const avgLoss = totalLoss / batch.length;
    this.lastLoss = avgLoss;

    if (this.lossHistory.length >= 100) {
      this.lossHistory.shift();
    }
    this.lossHistory.push(avgLoss);

    this.stepCount++;

    // Periodic / soft target network update
    if (this.stepCount % this.config.targetUpdateFreq === 0) {
      this.targetNetwork.copyWeightsFrom(this.qNetwork, this.config.tau);
    }

    return { loss: avgLoss };
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
