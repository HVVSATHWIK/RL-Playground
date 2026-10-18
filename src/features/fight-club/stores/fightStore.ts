import { create } from 'zustand';
import {
  createFighter,
  discretizeState,
  ACTIONS,
  ARENA_WIDTH,
  type FighterState,
  type Action,
} from '../lib/fighter';
import { stepArena, resetRound, type RewardWeights, DEFAULT_REWARD_WEIGHTS } from '../lib/arena';
import { FightAgent } from '../lib/fightAgent';
import { expertAction, warmStartAgent, warmStartDQNAgent } from '../lib/expertPolicy';
import { DQNAgent, extractObservation, type DQNConfig, DEFAULT_DQN_CONFIG } from '../lib/dqnAgent';
import { globalKeyboardController } from '../lib/keyboardController';
import { persistenceService } from '../../../lib/storage/persistence';

export type RoboMode = 'dojo' | 'train' | 'eval' | 'showtime';
export type FighterPolicy = 'human' | 'dqn' | 'tabular' | 'expert';

export interface EvalBenchmarkResult {
  totalRounds: number;
  redPolicy: FighterPolicy;
  bluePolicy: FighterPolicy;
  redWins: number;
  blueWins: number;
  draws: number;
  avgRedHpRemaining: number;
  avgBlueHpRemaining: number;
}

export interface HitEvent {
  id: number;
  attacker: 'red' | 'blue';
  target: 'red' | 'blue';
  damage: number;
  isCrit: boolean;
  isBlocked: boolean;
  attackType: 'punch' | 'kick';
  x: number;
  timestamp: number;
}

interface FightState {
  lastHitEvent: HitEvent | null;
  // Mode
  mode: RoboMode;
  redPolicy: FighterPolicy;
  bluePolicy: FighterPolicy;

  // Agents
  dqnAgent: DQNAgent;
  redTabularAgent: FightAgent;
  blueTabularAgent: FightAgent;

  // Arena Fighters
  red: FighterState;
  blue: FighterState;

  // Simulation parameters
  round: number;
  stepCount: number;
  maxSteps: number;
  redWins: number;
  blueWins: number;
  draws: number;
  roundRewards: { red: number; blue: number }[];
  runState: 'idle' | 'running' | 'paused';
  speed: number;
  lastWinner: 'red' | 'blue' | 'draw' | null;
  announceTimer: number;
  redHitsThisRound: number;
  blueHitsThisRound: number;

  // Telemetry
  lastRedQValues: number[];
  lastBlueQValues: number[];
  lastRedAction: Action;
  lastBlueAction: Action;

  // Tabular Hyperparameters
  epsilon: number;
  alpha: number;
  gamma: number;
  useExpertStart: boolean;

  // DQN Hyperparameters & Reward Shaping
  rewardWeights: RewardWeights;
  dqnConfig: DQNConfig;
  dqnLossHistory: number[];
  dqnEpisodeRewards: number[];
  dqnRecentWins: boolean[];
  trainingTargetEpisodes: number;
  isTrainingActive: boolean;

  // Benchmark stats
  evalResults: EvalBenchmarkResult | null;
  evalTargetRounds: number;

  // Mode status
  isShowtime: boolean;

  // Actions
  setMode: (mode: RoboMode) => void;
  setRedPolicy: (p: FighterPolicy) => void;
  setBluePolicy: (p: FighterPolicy) => void;

  step: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  resetAgents: () => void;
  setSpeed: (s: number) => void;

  // Tabular setters
  setEpsilon: (v: number) => void;
  setAlpha: (v: number) => void;
  setGamma: (v: number) => void;
  setUseExpertStart: (v: boolean) => void;
  setShowtime: (v: boolean) => void;

  // DQN & Training studio setters
  setRewardWeights: (weights: Partial<RewardWeights>) => void;
  setDQNConfig: (config: Partial<DQNConfig>) => void;
  setTrainingTargetEpisodes: (episodes: number) => void;
  warmStartDQN: () => void;
  startTrainingStudio: () => void;
  stopTrainingStudio: () => void;
  runBenchmark: (rounds?: number) => void;

  // Model serialization & Persistence
  exportDQNModel: () => string;
  importDQNModel: (jsonString: string) => { success: boolean; error?: string };
  loadPresetDQN: (preset: 'balanced' | 'aggressive' | 'defensive') => void;
  loadFromPersistence: () => Promise<void>;
  saveToPersistence: () => Promise<void>;

  // 3D Rendering Mode
  view3D: boolean;
  setView3D: (v: boolean) => void;
  toggle3D: () => void;
}

let hitEventCounter = 0;

export const useFightStore = create<FightState>((set, get) => {
  const dqnAgent = new DQNAgent();
  const redTabular = new FightAgent(0.3, 0.2, 0.9);
  const blueTabular = new FightAgent(0.3, 0.2, 0.9);

  // Pre-seed DQN and Tabular agents with expert sparring demonstrations on startup
  try {
    warmStartDQNAgent(dqnAgent, 35);
    warmStartAgent(redTabular, 100);
    warmStartAgent(blueTabular, 100);
  } catch {
    // Fallback if environment doesn't allow pre-seed
  }

  return {
    lastHitEvent: null,
    mode: 'dojo',
    redPolicy: 'human',
    bluePolicy: 'dqn',

    dqnAgent,
    redTabularAgent: redTabular,
    blueTabularAgent: blueTabular,

    red: createFighter(150, 1),
    blue: createFighter(ARENA_WIDTH - 150, -1),

    round: 1,
    stepCount: 0,
    maxSteps: 800,
    redWins: 0,
    blueWins: 0,
    draws: 0,
    roundRewards: [],
    runState: 'idle',
    speed: 1,
    lastWinner: null,
    announceTimer: 0,
    redHitsThisRound: 0,
    blueHitsThisRound: 0,

    lastRedQValues: [0, 0, 0, 0, 0, 0],
    lastBlueQValues: [0, 0, 0, 0, 0, 0],
    lastRedAction: 'idle',
    lastBlueAction: 'idle',

    epsilon: 0.2,
    alpha: 0.2,
    gamma: 0.9,
    useExpertStart: true,

    rewardWeights: { ...DEFAULT_REWARD_WEIGHTS },
    dqnConfig: { ...DEFAULT_DQN_CONFIG },
    dqnLossHistory: [],
    dqnEpisodeRewards: [],
    dqnRecentWins: [],
    trainingTargetEpisodes: 300,
    isTrainingActive: false,

    evalResults: null,
    evalTargetRounds: 50,

    isShowtime: false,

    setMode: (mode) => {
      if (mode === 'dojo') {
        globalKeyboardController.attach();
        set({
          mode,
          redPolicy: 'human',
          bluePolicy: 'dqn',
          speed: 1,
          isShowtime: false,
          maxSteps: 800,
        });
      } else if (mode === 'train') {
        globalKeyboardController.detach();
        set({
          mode,
          redPolicy: 'dqn',
          bluePolicy: 'expert',
          speed: 20,
          isShowtime: false,
          maxSteps: 600,
        });
      } else if (mode === 'eval') {
        globalKeyboardController.detach();
        set({
          mode,
          redPolicy: 'dqn',
          bluePolicy: 'tabular',
          speed: 50,
          isShowtime: false,
          maxSteps: 600,
        });
      } else if (mode === 'showtime') {
        globalKeyboardController.detach();
        set({
          mode,
          redPolicy: 'tabular',
          bluePolicy: 'tabular',
          speed: 1,
          isShowtime: true,
          maxSteps: 1500,
        });
      }
    },

    setRedPolicy: (p) => {
      if (p === 'human') globalKeyboardController.attach();
      else if (get().bluePolicy !== 'human') globalKeyboardController.detach();
      set({ redPolicy: p });
    },

    setBluePolicy: (p) => {
      if (p === 'human') return; // Blue is strictly AI in Robo-Dojo lab
      set({ bluePolicy: p });
    },

    step: () => {
      const state = get();
      const {
        red,
        blue,
        redPolicy,
        bluePolicy,
        dqnAgent,
        redTabularAgent,
        blueTabularAgent,
        stepCount,
        maxSteps,
        round,
        redWins,
        blueWins,
        draws,
        roundRewards,
        announceTimer,
        isShowtime,
        redHitsThisRound,
        blueHitsThisRound,
        rewardWeights,
        mode,
        dqnEpisodeRewards,
        dqnRecentWins,
        dqnLossHistory,
      } = state;

      // Handle round end banner delay
      if (announceTimer > 0) {
        set({ announceTimer: announceTimer - 1 });
        if (announceTimer <= 1) {
          resetRound(red, blue);
          set({
            red: { ...red },
            blue: { ...blue },
            stepCount: 0,
            lastWinner: null,
            redHitsThisRound: 0,
            blueHitsThisRound: 0,
          });
        }
        return;
      }

      // 1. Determine action for RED fighter
      let redAction: Action;
      let redQVals = [0, 0, 0, 0, 0, 0];
      const redObs = extractObservation(red, blue);
      const redDiscState = discretizeState(red, blue);

      if (redPolicy === 'human') {
        redAction = globalKeyboardController.getAction(red, blue);
      } else if (redPolicy === 'dqn') {
        const isGreedy = mode === 'dojo' || mode === 'eval';
        const dqnDecision = dqnAgent.chooseAction(redObs, isGreedy, red, blue);
        redAction = dqnDecision.action;
        redQVals = dqnDecision.qValues;
      } else if (redPolicy === 'expert') {
        redAction = expertAction(red, blue);
        const redActIdx = ACTIONS.indexOf(redAction as any);
        redQVals = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
        if (redActIdx >= 0) redQVals[redActIdx] = 1.0;
      } else {
        redAction = redTabularAgent.chooseAction(redDiscState, red, blue);
        redQVals = [0, 1, 2, 3, 4, 5].map((a) => redTabularAgent.getQ(redDiscState, a));
      }

      // 2. Determine action for BLUE fighter
      let blueAction: Action;
      let blueQVals = [0, 0, 0, 0, 0, 0];
      const blueObs = extractObservation(blue, red);
      const blueDiscState = discretizeState(blue, red);

      if (bluePolicy === 'dqn') {
        const isGreedy = mode === 'dojo' || mode === 'eval';
        const dqnDecision = dqnAgent.chooseAction(blueObs, isGreedy, blue, red);
        blueAction = dqnDecision.action;
        blueQVals = dqnDecision.qValues;
      } else if (bluePolicy === 'expert') {
        blueAction = expertAction(blue, red);
        const blueActIdx = ACTIONS.indexOf(blueAction as any);
        blueQVals = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
        if (blueActIdx >= 0) blueQVals[blueActIdx] = 1.0;
      } else {
        blueAction = blueTabularAgent.chooseAction(blueDiscState, blue, red);
        blueQVals = [0, 1, 2, 3, 4, 5].map((a) => blueTabularAgent.getQ(blueDiscState, a));
      }

      // Update state telemetry for real-time live inspect
      state.lastRedQValues = redQVals;
      state.lastBlueQValues = blueQVals;
      state.lastRedAction = redAction;
      state.lastBlueAction = blueAction;

      // 3. Step physics and collision simulation
      const result = stepArena(red, blue, redAction, blueAction, rewardWeights);

      // 4. Update Tabular Q-Learning agents if active
      if (redPolicy === 'tabular') {
        const newRedDiscState = discretizeState(red, blue);
        const redActionIdx = ACTIONS.indexOf(redAction as any);
        if (redActionIdx >= 0) {
          redTabularAgent.update(redDiscState, redActionIdx, result.redReward, newRedDiscState, result.roundOver);
        }
      }
      if (bluePolicy === 'tabular') {
        const newBlueDiscState = discretizeState(blue, red);
        const blueActionIdx = ACTIONS.indexOf(blueAction as any);
        if (blueActionIdx >= 0) {
          blueTabularAgent.update(blueDiscState, blueActionIdx, result.blueReward, newBlueDiscState, result.roundOver);
        }
      }

      // 5. Update DQN Agent if active and training
      if (redPolicy === 'dqn') {
        const newRedObs = extractObservation(red, blue);
        const redActionIdx = ACTIONS.indexOf(redAction as any);
        if (redActionIdx >= 0) {
          dqnAgent.storeTransition(redObs, redActionIdx, result.redReward, newRedObs, result.roundOver);
        }

        if (mode === 'train' || state.isTrainingActive) {
          const trainRes = dqnAgent.trainStep();
          if (trainRes && trainRes.loss > 0) {
            dqnLossHistory.push(trainRes.loss);
            if (dqnLossHistory.length > 100) dqnLossHistory.shift();
          }
        }
      } else if (bluePolicy === 'dqn') {
        const newBlueObs = extractObservation(blue, red);
        const blueActionIdx = ACTIONS.indexOf(blueAction as any);
        if (blueActionIdx >= 0) {
          dqnAgent.storeTransition(blueObs, blueActionIdx, result.blueReward, newBlueObs, result.roundOver);
        }

        if (mode === 'train' || state.isTrainingActive) {
          const trainRes = dqnAgent.trainStep();
          if (trainRes && trainRes.loss > 0) {
            dqnLossHistory.push(trainRes.loss);
            if (dqnLossHistory.length > 100) dqnLossHistory.shift();
          }
        }
      }

      const newRedHits = redHitsThisRound + (result.redLanded ? 1 : 0);
      const newBlueHits = blueHitsThisRound + (result.blueLanded ? 1 : 0);
      const newStepCount = stepCount + 1;
      let roundOver = result.roundOver || newStepCount >= maxSteps;
      let winner = result.winner;

      let lastHitEvent = state.lastHitEvent;
      if (result.redLanded) {
        lastHitEvent = {
          id: ++hitEventCounter,
          attacker: 'red',
          target: 'blue',
          damage: result.redDamage,
          isCrit: result.redDamage >= 14,
          isBlocked: result.redBlocked,
          attackType: redAction === 'kick' ? 'kick' : 'punch',
          x: (red.x + blue.x * 2) / 3,
          timestamp: Date.now(),
        };
      } else if (result.blueLanded) {
        lastHitEvent = {
          id: ++hitEventCounter,
          attacker: 'blue',
          target: 'red',
          damage: result.blueDamage,
          isCrit: result.blueDamage >= 14,
          isBlocked: result.blueBlocked,
          attackType: blueAction === 'kick' ? 'kick' : 'punch',
          x: (blue.x + red.x * 2) / 3,
          timestamp: Date.now(),
        };
      }

      // Handle match timeout by comparing remaining HP (higher HP wins!)
      if (newStepCount >= maxSteps && !result.roundOver) {
        if (red.hp > blue.hp) {
          winner = 'red';
        } else if (blue.hp > red.hp) {
          winner = 'blue';
        } else {
          winner = 'draw';
        }
        roundOver = true;
      }

      // 6. Handle Round Conclusion
      if (roundOver) {
        // Decay DQN exploration at episode boundary
        if (redPolicy === 'dqn' || bluePolicy === 'dqn') {
          dqnAgent.decayEpsilon();
          const dqnReward = redPolicy === 'dqn' ? red.roundReward : blue.roundReward;
          dqnAgent.recentRewards.push(dqnReward);
          if (dqnAgent.recentRewards.length > 20) dqnAgent.recentRewards.shift();

          dqnEpisodeRewards.push(dqnReward);
          if (dqnEpisodeRewards.length > 150) dqnEpisodeRewards.shift();

          const dqnWon = (redPolicy === 'dqn' && winner === 'red') || (bluePolicy === 'dqn' && winner === 'blue');
          dqnRecentWins.push(dqnWon);
          if (dqnRecentWins.length > 30) dqnRecentWins.shift();
        }

        set({
          lastHitEvent,
          red: { ...red },
          blue: { ...blue },
          stepCount: newStepCount,
          redHitsThisRound: newRedHits,
          blueHitsThisRound: newBlueHits,
          round: round + 1,
          redWins: redWins + (winner === 'red' ? 1 : 0),
          blueWins: blueWins + (winner === 'blue' ? 1 : 0),
          draws: draws + (winner === 'draw' ? 1 : 0),
          roundRewards: [...roundRewards, { red: red.roundReward, blue: blue.roundReward }],
          lastWinner: winner,
          announceTimer: mode === 'dojo' ? 55 : isShowtime ? 65 : 12,
          lastRedQValues: redQVals,
          lastBlueQValues: blueQVals,
          lastRedAction: redAction,
          lastBlueAction: blueAction,
          dqnEpisodeRewards: [...dqnEpisodeRewards],
          dqnRecentWins: [...dqnRecentWins],
          dqnLossHistory: [...dqnLossHistory],
        });

        // Persist model weights and scores after round completion
        get().saveToPersistence();
      } else {
        set({
          lastHitEvent,
          red: { ...red },
          blue: { ...blue },
          stepCount: newStepCount,
          redHitsThisRound: newRedHits,
          blueHitsThisRound: newBlueHits,
          lastRedQValues: redQVals,
          lastBlueQValues: blueQVals,
          lastRedAction: redAction,
          lastBlueAction: blueAction,
        });
      }
    },

    play: () => set({ runState: 'running' }),
    pause: () => {
      set({ runState: 'paused' });
      get().saveToPersistence();
    },

    reset: () => {
      const red = createFighter(150, 1);
      const blue = createFighter(ARENA_WIDTH - 150, -1);
      set({
        lastHitEvent: null,
        red,
        blue,
        round: 1,
        stepCount: 0,
        redWins: 0,
        blueWins: 0,
        draws: 0,
        roundRewards: [],
        runState: 'idle',
        lastWinner: null,
        announceTimer: 0,
        redHitsThisRound: 0,
        blueHitsThisRound: 0,
      });
    },

    resetAgents: () => {
      const { epsilon, alpha, gamma, dqnConfig, useExpertStart } = get();
      const redTabular = new FightAgent(epsilon, alpha, gamma);
      const blueTabular = new FightAgent(epsilon, alpha, gamma);
      const dqnAgent = new DQNAgent(dqnConfig);

      if (useExpertStart) {
        warmStartAgent(redTabular, 150);
        warmStartAgent(blueTabular, 150);
        warmStartDQNAgent(dqnAgent, 35);
      }

      set({
        redTabularAgent: redTabular,
        blueTabularAgent: blueTabular,
        dqnAgent,
        round: 1,
        stepCount: 0,
        redWins: 0,
        blueWins: 0,
        draws: 0,
        roundRewards: [],
        lastWinner: null,
        announceTimer: 0,
        dqnLossHistory: [],
        dqnEpisodeRewards: [],
        dqnRecentWins: [],
      });
    },

    setSpeed: (s) => set({ speed: s }),
    setEpsilon: (v) => {
      const { redTabularAgent, blueTabularAgent, dqnAgent } = get();
      redTabularAgent.epsilon = v;
      blueTabularAgent.epsilon = v;
      dqnAgent.epsilon = v;
      set({ epsilon: v });
    },
    setAlpha: (v) => {
      get().redTabularAgent.alpha = v;
      get().blueTabularAgent.alpha = v;
      set({ alpha: v });
    },
    setGamma: (v) => {
      get().redTabularAgent.gamma = v;
      get().blueTabularAgent.gamma = v;
      set({ gamma: v });
    },
    setUseExpertStart: (v) => set({ useExpertStart: v }),
    setShowtime: (v) => set({ isShowtime: v, maxSteps: v ? 1500 : 800 }),

    setRewardWeights: (weights) => {
      set({ rewardWeights: { ...get().rewardWeights, ...weights } });
    },

    setDQNConfig: (config) => {
      const updated = { ...get().dqnConfig, ...config };
      get().dqnAgent.config = updated;
      set({ dqnConfig: updated });
    },

    setTrainingTargetEpisodes: (episodes) => set({ trainingTargetEpisodes: episodes }),

    warmStartDQN: () => {
      const { dqnAgent } = get();
      warmStartDQNAgent(dqnAgent, 45);
      set({ dqnAgent });
    },

    startTrainingStudio: () => {
      set({
        isTrainingActive: true,
        runState: 'running',
        mode: 'train',
        redPolicy: 'dqn',
        bluePolicy: 'expert',
        speed: 20,
      });
    },

    stopTrainingStudio: () => {
      set({
        isTrainingActive: false,
        runState: 'paused',
      });
    },

    runBenchmark: (targetRounds = 40) => {
      const { dqnAgent, redTabularAgent } = get();
      const red = createFighter(150, 1);
      const blue = createFighter(ARENA_WIDTH - 150, -1);
      let rWins = 0,
        bWins = 0,
        dr = 0;
      let totalRedHp = 0,
        totalBlueHp = 0;

      for (let ep = 0; ep < targetRounds; ep++) {
        resetRound(red, blue);
        let s = 0;
        while (s < 500) {
          const redObs = extractObservation(red, blue);
          const redAction = dqnAgent.chooseAction(redObs, true, red, blue).action;

          const blueDisc = discretizeState(blue, red);
          const blueAction = redTabularAgent.chooseAction(blueDisc);

          const res = stepArena(red, blue, redAction, blueAction);
          s++;
          if (res.roundOver) {
            if (res.winner === 'red') rWins++;
            else if (res.winner === 'blue') bWins++;
            else dr++;
            totalRedHp += red.hp;
            totalBlueHp += blue.hp;
            break;
          }
        }
      }

      set({
        evalResults: {
          totalRounds: targetRounds,
          redPolicy: 'dqn',
          bluePolicy: 'tabular',
          redWins: rWins,
          blueWins: bWins,
          draws: dr,
          avgRedHpRemaining: Math.round(totalRedHp / targetRounds),
          avgBlueHpRemaining: Math.round(totalBlueHp / targetRounds),
        },
      });
    },

    exportDQNModel: () => {
      return get().dqnAgent.exportToJSON('RoboDojo-Trained-Agent');
    },

    importDQNModel: (jsonString: string) => {
      const result = get().dqnAgent.importFromJSON(jsonString);
      if (result.success) {
        set({
          dqnConfig: { ...get().dqnAgent.config },
          epsilon: get().dqnAgent.epsilon,
        });
      }
      return result;
    },

    loadPresetDQN: (preset: 'balanced' | 'aggressive' | 'defensive') => {
      const { dqnAgent } = get();
      dqnAgent.reset();

      if (preset === 'aggressive') {
        set({
          rewardWeights: {
            aggression: 2.2,
            survival: 0.6,
            defense: 0.5,
            spacing: 1.5,
            winBonus: 1.5,
          },
        });
      } else if (preset === 'defensive') {
        set({
          rewardWeights: {
            aggression: 0.8,
            survival: 2.0,
            defense: 2.5,
            spacing: 0.8,
            winBonus: 1.0,
          },
        });
      } else {
        set({
          rewardWeights: { ...DEFAULT_REWARD_WEIGHTS },
        });
      }

      warmStartDQNAgent(dqnAgent, 35);
      set({ dqnAgent });
      get().saveToPersistence();
    },

    loadFromPersistence: async () => {
      const saved = await persistenceService.loadDQN();
      if (!saved) return;

      try {
        const { dqnAgent } = get();
        if (saved.serializedJson) {
          dqnAgent.importFromJSON(saved.serializedJson);
        }

        set({
          redWins: saved.redWins ?? 0,
          blueWins: saved.blueWins ?? 0,
          draws: saved.draws ?? 0,
          round: saved.round ?? 1,
          dqnEpisodeRewards: saved.dqnEpisodeRewards || [],
          dqnRecentWins: saved.dqnRecentWins || [],
          rewardWeights: saved.rewardWeights || { ...DEFAULT_REWARD_WEIGHTS },
          dqnAgent,
        });
      } catch (err) {
        console.warn('Failed to restore DQN model state:', err);
      }
    },

    saveToPersistence: async () => {
      const { dqnAgent, redWins, blueWins, draws, round, dqnEpisodeRewards, dqnRecentWins, rewardWeights } = get();
      if (!dqnAgent) return;

      const serializedJson = dqnAgent.exportToJSON('RoboDojo-Trained-Agent');
      await persistenceService.saveDQN({
        serializedJson,
        redWins,
        blueWins,
        draws,
        round,
        dqnEpisodeRewards,
        dqnRecentWins,
        rewardWeights,
        timestamp: Date.now(),
      });
    },

    view3D: true,
    setView3D: (v) => set({ view3D: v }),
    toggle3D: () => set({ view3D: !get().view3D }),
  };
});

// Auto-restore saved DQN agent on app load
if (typeof window !== 'undefined') {
  useFightStore.getState().loadFromPersistence();
  window.addEventListener('beforeunload', () => {
    useFightStore.getState().saveToPersistence();
  });
}

