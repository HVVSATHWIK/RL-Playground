import { create } from 'zustand';
import { createDefaultGrid, step, type Action, type CellType, type GridWorld } from '../lib/rl/gridWorld';
import { QLearningAgent } from '../lib/rl/qLearning';
import { SarsaAgent } from '../lib/rl/sarsa';
import { persistenceService } from '../lib/storage/persistence';

export interface LastUpdate {
  row: number;
  col: number;
  action: Action;
  reward: number;
  nextRow: number;
  nextCol: number;
  oldQ: number;
  newQ: number;
  target: number;
}

interface RLState {
  grid: GridWorld;
  agent: QLearningAgent | SarsaAgent;
  algorithmType: 'qlearning' | 'sarsa';
  agentPos: [number, number];
  episode: number;
  stepCount: number;
  episodeReward: number;
  episodeRewards: number[];
  episodeSteps: number[];
  runState: 'idle' | 'running' | 'paused';
  speed: number;
  showQValues: boolean;
  showPolicy: boolean;
  showStateValues: boolean;
  lastUpdate: LastUpdate | null;
  epsilon: number;
  alpha: number;
  gamma: number;

  stepAgent: () => boolean; // returns true if episode ended
  startEpisode: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  resetAgent: () => void;
  setCellType: (row: number, col: number, type: CellType) => void;
  setAlgorithm: (type: 'qlearning' | 'sarsa') => void;
  setSpeed: (speed: number) => void;
  setShowQValues: (v: boolean) => void;
  setShowPolicy: (v: boolean) => void;
  setShowStateValues: (v: boolean) => void;
  setEpsilon: (v: number) => void;
  setAlpha: (v: number) => void;
  setGamma: (v: number) => void;
  loadFromPersistence: () => Promise<void>;
  saveToPersistence: () => Promise<void>;
}

export const useRLStore = create<RLState>((set, get) => {
  const defaultGrid = createDefaultGrid();
  const defaultAgent = new QLearningAgent(defaultGrid.height, defaultGrid.width);

  return {
    grid: defaultGrid,
    agent: defaultAgent,
    algorithmType: 'qlearning',
    agentPos: [...defaultGrid.startPos],
    episode: 0,
    stepCount: 0,
    episodeReward: 0,
    episodeRewards: [],
    episodeSteps: [],
    runState: 'idle',
    speed: 5,
    showQValues: true,
    showPolicy: true,
    showStateValues: false,
    lastUpdate: null,
    epsilon: 0.3,
    alpha: 0.1,
    gamma: 0.95,

    loadFromPersistence: async () => {
      const saved = await persistenceService.loadRL();
      if (!saved) return;

      try {
        const grid = createDefaultGrid();
        if (saved.gridCells && saved.gridCells.length === grid.height) {
          grid.cells = saved.gridCells as CellType[][];
        }

        const agent = saved.algorithmType === 'sarsa'
          ? new SarsaAgent(grid.height, grid.width, saved.epsilon, saved.alpha, saved.gamma)
          : new QLearningAgent(grid.height, grid.width, saved.epsilon, saved.alpha, saved.gamma);

        if (Array.isArray(saved.qTable) && saved.qTable.length === grid.height) {
          agent.qTable = saved.qTable;
        }

        set({
          grid,
          agent,
          algorithmType: saved.algorithmType,
          epsilon: saved.epsilon,
          alpha: saved.alpha,
          gamma: saved.gamma,
          episode: saved.episode,
          episodeRewards: saved.episodeRewards || [],
          episodeSteps: saved.episodeSteps || [],
        });
      } catch (err) {
        console.warn('Failed to restore RL model state:', err);
      }
    },

    saveToPersistence: async () => {
      const { agent, algorithmType, epsilon, alpha, gamma, episode, episodeRewards, episodeSteps, grid } = get();
      await persistenceService.saveRL({
        algorithmType,
        epsilon,
        alpha,
        gamma,
        episode,
        episodeRewards,
        episodeSteps,
        gridCells: grid.cells,
        qTable: agent.qTable,
        timestamp: Date.now(),
      });
    },

    stepAgent: () => {
      const { grid, agent, agentPos, stepCount, episodeReward, saveToPersistence } = get();
      const [row, col] = agentPos;
      const action = agent.chooseAction(row, col);
      const { nextPos, reward, done } = step(grid, agentPos, action);

      let updateInfo: { oldQ: number; newQ: number; target: number };

      if (agent instanceof SarsaAgent) {
        const nextAction = agent.chooseAction(nextPos[0], nextPos[1]);
        updateInfo = agent.update(row, col, action, reward, nextPos[0], nextPos[1], nextAction, done);
      } else {
        updateInfo = (agent as QLearningAgent).update(row, col, action, reward, nextPos[0], nextPos[1], done);
      }

      const newEpisodeReward = episodeReward + reward;

      set({
        agentPos: nextPos,
        stepCount: stepCount + 1,
        episodeReward: newEpisodeReward,
        lastUpdate: {
          row, col, action, reward,
          nextRow: nextPos[0], nextCol: nextPos[1],
          ...updateInfo,
        },
      });

      if (done || stepCount > 200) {
        const { episode, episodeRewards, episodeSteps } = get();
        const newEpisode = episode + 1;
        set({
          episode: newEpisode,
          episodeRewards: [...episodeRewards, newEpisodeReward],
          episodeSteps: [...episodeSteps, stepCount + 1],
          agentPos: [grid.startPos[0], grid.startPos[1]] as [number, number],
          stepCount: 0,
          episodeReward: 0,
        });

        // Persist every 5 episodes
        if (newEpisode % 5 === 0) {
          saveToPersistence();
        }

        return true;
      }
      return false;
    },

    startEpisode: () => {
      const { grid } = get();
      set({ agentPos: [grid.startPos[0], grid.startPos[1]] as [number, number], stepCount: 0, episodeReward: 0 });
    },

    play: () => set({ runState: 'running' }),
    pause: () => {
      set({ runState: 'paused' });
      get().saveToPersistence();
    },

    reset: () => {
      const grid = createDefaultGrid();
      const { algorithmType, epsilon, alpha, gamma } = get();
      const agent = algorithmType === 'sarsa'
        ? new SarsaAgent(grid.height, grid.width, epsilon, alpha, gamma)
        : new QLearningAgent(grid.height, grid.width, epsilon, alpha, gamma);
      set({
        grid,
        agent,
        agentPos: [grid.startPos[0], grid.startPos[1]] as [number, number],
        episode: 0,
        stepCount: 0,
        episodeReward: 0,
        episodeRewards: [],
        episodeSteps: [],
        runState: 'idle',
        lastUpdate: null,
      });
      get().saveToPersistence();
    },

    resetAgent: () => {
      const { grid, algorithmType, epsilon, alpha, gamma } = get();
      const agent = algorithmType === 'sarsa'
        ? new SarsaAgent(grid.height, grid.width, epsilon, alpha, gamma)
        : new QLearningAgent(grid.height, grid.width, epsilon, alpha, gamma);
      set({
        agent,
        agentPos: [grid.startPos[0], grid.startPos[1]] as [number, number],
        episode: 0,
        stepCount: 0,
        episodeReward: 0,
        episodeRewards: [],
        episodeSteps: [],
        lastUpdate: null,
      });
      get().saveToPersistence();
    },

    setCellType: (row, col, type) => {
      const { grid } = get();
      const newCells = grid.cells.map((r: CellType[]) => [...r]);
      newCells[row][col] = type;
      const newGrid = { ...grid, cells: newCells };
      if (type === 'goal') {
        newGrid.goalPos = [row, col];
      }
      set({ grid: newGrid });
      get().saveToPersistence();
    },

    setAlgorithm: (type) => {
      const { grid, epsilon, alpha, gamma } = get();
      const agent = type === 'sarsa'
        ? new SarsaAgent(grid.height, grid.width, epsilon, alpha, gamma)
        : new QLearningAgent(grid.height, grid.width, epsilon, alpha, gamma);
      set({ algorithmType: type, agent, episode: 0, episodeRewards: [], episodeSteps: [], lastUpdate: null });
      get().saveToPersistence();
    },

    setSpeed: (speed) => set({ speed }),
    setShowQValues: (v) => set({ showQValues: v }),
    setShowPolicy: (v) => set({ showPolicy: v }),
    setShowStateValues: (v) => set({ showStateValues: v }),

    setEpsilon: (v) => {
      const { agent } = get();
      agent.epsilon = v;
      set({ epsilon: v });
      get().saveToPersistence();
    },
    setAlpha: (v) => {
      const { agent } = get();
      agent.alpha = v;
      set({ alpha: v });
      get().saveToPersistence();
    },
    setGamma: (v) => {
      const { agent } = get();
      agent.gamma = v;
      set({ gamma: v });
      get().saveToPersistence();
    },
  };
});

// Load saved RL model state on boot
if (typeof window !== 'undefined') {
  useRLStore.getState().loadFromPersistence();
  window.addEventListener('beforeunload', () => {
    useRLStore.getState().saveToPersistence();
  });
}

