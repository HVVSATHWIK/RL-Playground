import { create } from 'zustand';
import { NeuralNetwork, type LayerSnapshot } from '../lib/nn/network';
import { activations } from '../lib/math/activations';
import { datasets, type DataPoint } from '../lib/nn/datasets';
import { sigmoid } from '../lib/math/activations';
import { persistenceService } from '../lib/storage/persistence';

interface NNState {
  hiddenLayers: number[];
  activationType: string;
  learningRate: number;
  datasetType: string;
  network: NeuralNetwork | null;
  trainingState: 'idle' | 'running' | 'paused';
  epoch: number;
  lossHistory: number[];
  dataPoints: DataPoint[];
  snapshot: LayerSnapshot[];
  inputValues: number[];

  setHiddenLayers: (layers: number[]) => void;
  setActivation: (type: string) => void;
  setLearningRate: (lr: number) => void;
  setDataset: (type: string) => void;
  initNetwork: () => void;
  trainStep: () => number;
  play: () => void;
  pause: () => void;
  reset: () => void;
  loadFromPersistence: () => Promise<void>;
  saveToPersistence: () => Promise<void>;
}

export const useNNStore = create<NNState>((set, get) => ({
  hiddenLayers: [4, 4],
  activationType: 'relu',
  learningRate: 0.03,
  datasetType: 'xor',
  network: null,
  trainingState: 'idle',
  epoch: 0,
  lossHistory: [],
  dataPoints: [],
  snapshot: [],
  inputValues: [],

  setHiddenLayers: (layers) => {
    set({ hiddenLayers: layers });
    get().saveToPersistence();
  },
  setActivation: (type) => {
    set({ activationType: type });
    get().saveToPersistence();
  },
  setLearningRate: (lr) => {
    set({ learningRate: lr });
    get().saveToPersistence();
  },

  setDataset: (type) => {
    const data = datasets[type]?.(200) ?? [];
    set({ datasetType: type, dataPoints: data });
    get().saveToPersistence();
  },

  initNetwork: () => {
    const { hiddenLayers, activationType, datasetType } = get();
    const data = datasets[datasetType]?.(200) ?? [];
    const sizes = [2, ...hiddenLayers, 1];
    const activation = activations[activationType] ?? activations.relu;
    const network = new NeuralNetwork(sizes, activation, sigmoid);
    set({
      network,
      dataPoints: data,
      epoch: 0,
      lossHistory: [],
      snapshot: network.getSnapshot(),
      trainingState: 'idle',
    });
  },

  loadFromPersistence: async () => {
    const saved = await persistenceService.loadNN();
    if (!saved) return;

    try {
      const data = datasets[saved.datasetType]?.(200) ?? datasets.xor(200);
      const sizes = [2, ...saved.hiddenLayers, 1];
      const activation = activations[saved.activationType] ?? activations.relu;
      const network = new NeuralNetwork(sizes, activation, sigmoid);

      if (saved.weights && saved.biases) {
        network.setWeightsAndBiases(saved.weights, saved.biases);
      }

      set({
        datasetType: saved.datasetType,
        activationType: saved.activationType,
        hiddenLayers: saved.hiddenLayers,
        learningRate: saved.learningRate,
        epoch: saved.epoch,
        lossHistory: saved.lossHistory || [],
        dataPoints: data,
        network,
        snapshot: network.getSnapshot(),
      });
    } catch (err) {
      console.warn('Failed to restore saved NN model:', err);
    }
  },

  saveToPersistence: async () => {
    const { network, datasetType, activationType, hiddenLayers, learningRate, epoch, lossHistory } = get();
    if (!network) return;

    const { weights, biases } = network.getWeightsAndBiases();
    await persistenceService.saveNN({
      datasetType,
      activationType,
      hiddenLayers,
      learningRate,
      epoch,
      lossHistory,
      weights,
      biases,
      timestamp: Date.now(),
    });
  },

  trainStep: () => {
    const { network, dataPoints, learningRate, epoch, lossHistory, saveToPersistence } = get();
    if (!network || dataPoints.length === 0) return 0;

    const inputs = dataPoints.map(p => [p.x, p.y]);
    const targets = dataPoints.map(p => [p.label]);

    const loss = network.train(inputs, targets, learningRate);
    const newHistory = [...lossHistory, loss];
    const newEpoch = epoch + 1;

    set({
      epoch: newEpoch,
      lossHistory: newHistory,
      snapshot: network.getSnapshot(),
    });

    // Auto-persist every 20 epochs
    if (newEpoch % 20 === 0) {
      saveToPersistence();
    }

    return loss;
  },

  play: () => set({ trainingState: 'running' }),
  pause: () => {
    set({ trainingState: 'paused' });
    get().saveToPersistence();
  },

  reset: () => {
    get().initNetwork();
    get().saveToPersistence();
  },
}));

// Load saved weights on boot
if (typeof window !== 'undefined') {
  useNNStore.getState().loadFromPersistence();
  window.addEventListener('beforeunload', () => {
    useNNStore.getState().saveToPersistence();
  });
}

