/**
 * IndexedDB Persistent Model Storage
 * Preserves model weights, neural topologies, hyperparameters, and training histories
 * across browser refreshes for Robo-Dojo, Neural Network Playground, and RL Gridworld.
 */

const DB_NAME = 'RoboDojo_ML_Playground_DB';
const DB_VERSION = 1;

export interface StoredDQNData {
  serializedJson: string;
  redWins: number;
  blueWins: number;
  draws: number;
  round: number;
  dqnEpisodeRewards: number[];
  dqnRecentWins: boolean[];
  rewardWeights: any;
  timestamp: number;
}

export interface StoredNNData {
  datasetType: string;
  activationType: string;
  hiddenLayers: number[];
  learningRate: number;
  epoch: number;
  lossHistory: number[];
  weights: number[][][];
  biases: number[][];
  timestamp: number;
}

export interface StoredRLData {
  algorithmType: 'qlearning' | 'sarsa';
  epsilon: number;
  alpha: number;
  gamma: number;
  episode: number;
  episodeRewards: number[];
  episodeSteps: number[];
  gridCells?: string[][];
  qTable: number[][][];
  timestamp: number;
}

class PersistenceService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('dqn')) {
          db.createObjectStore('dqn');
        }
        if (!db.objectStoreNames.contains('logs')) {
          db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('nn')) {
          db.createObjectStore('nn');
        }
        if (!db.objectStoreNames.contains('rl')) {
          db.createObjectStore('rl');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- Robo-Dojo (DQN Agent) Methods ---
  async saveDQN(data: StoredDQNData): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('dqn', 'readwrite');
      tx.objectStore('dqn').put(data, 'dqn_checkpoint');
    } catch (err) {
      console.warn('Failed to persist DQN weights to IndexedDB:', err);
    }
  }

  async loadDQN(): Promise<StoredDQNData | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('dqn', 'readonly');
        const req = tx.objectStore('dqn').get('dqn_checkpoint');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // --- Neural Network Playground Methods ---
  async saveNN(data: StoredNNData): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('nn', 'readwrite');
      tx.objectStore('nn').put(data, 'nn_checkpoint');
    } catch (err) {
      console.warn('Failed to persist NN weights to IndexedDB:', err);
    }
  }

  async loadNN(): Promise<StoredNNData | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('nn', 'readonly');
        const req = tx.objectStore('nn').get('nn_checkpoint');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // --- RL Gridworld Methods ---
  async saveRL(data: StoredRLData): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('rl', 'readwrite');
      tx.objectStore('rl').put(data, 'rl_checkpoint');
    } catch (err) {
      console.warn('Failed to persist RL Q-table to IndexedDB:', err);
    }
  }

  async loadRL(): Promise<StoredRLData | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('rl', 'readonly');
        const req = tx.objectStore('rl').get('rl_checkpoint');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }
}

export const persistenceService = new PersistenceService();
