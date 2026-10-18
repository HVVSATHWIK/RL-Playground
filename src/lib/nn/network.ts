import { Matrix } from '../math/matrix';
import type { ActivationFn } from '../math/activations';
import { Layer } from './layer';
import { mseDeriv } from '../math/loss';

export interface LayerSnapshot {
  weights: number[][];
  biases: number[];
  outputs: number[];
}

export class NeuralNetwork {
  layers: Layer[];
  layerSizes: number[];

  constructor(layerSizes: number[], activation: ActivationFn, outputActivation?: ActivationFn) {
    this.layerSizes = layerSizes;
    this.layers = [];
    for (let i = 0; i < layerSizes.length - 1; i++) {
      const isLast = i === layerSizes.length - 2;
      const act = isLast && outputActivation ? outputActivation : activation;
      this.layers.push(new Layer(layerSizes[i], layerSizes[i + 1], act));
    }
  }

  forward(input: number[]): number[] {
    let current = Matrix.fromArray(input);
    for (const layer of this.layers) {
      current = layer.forward(current);
    }
    return current.toArray();
  }

  train(inputs: number[][], targets: number[][], learningRate: number): number {
    let totalLoss = 0;

    for (let i = 0; i < inputs.length; i++) {
      // Forward pass
      const output = this.forward(inputs[i]);
      const target = targets[i];

      // Calculate loss
      for (let j = 0; j < output.length; j++) {
        totalLoss += (output[j] - target[j]) ** 2;
      }

      // Backward pass - start with output gradient
      let gradient = Matrix.fromArray(
        output.map((o, j) => mseDeriv(o, target[j]))
      );

      for (let l = this.layers.length - 1; l >= 0; l--) {
        gradient = this.layers[l].backward(gradient, learningRate);
      }
    }

    return totalLoss / inputs.length;
  }

  backward(outputGradient: number[], learningRate: number): void {
    let gradient = Matrix.fromArray(outputGradient);
    for (let l = this.layers.length - 1; l >= 0; l--) {
      gradient = this.layers[l].backward(gradient, learningRate);
    }
  }

  copyWeightsFrom(other: NeuralNetwork, tau = 1.0): void {
    for (let l = 0; l < this.layers.length; l++) {
      const srcW = other.layers[l].weights;
      const srcB = other.layers[l].biases;
      const dstW = this.layers[l].weights;
      const dstB = this.layers[l].biases;

      for (let r = 0; r < dstW.rows; r++) {
        for (let c = 0; c < dstW.cols; c++) {
          if (tau >= 1.0) {
            dstW.data[r][c] = srcW.data[r][c];
          } else {
            dstW.data[r][c] = (1 - tau) * dstW.data[r][c] + tau * srcW.data[r][c];
          }
        }
      }

      for (let r = 0; r < dstB.rows; r++) {
        if (tau >= 1.0) {
          dstB.data[r][0] = srcB.data[r][0];
        } else {
          dstB.data[r][0] = (1 - tau) * dstB.data[r][0] + tau * srcB.data[r][0];
        }
      }
    }
  }

  clone(): NeuralNetwork {
    const act = this.layers[0].activation;
    const outAct = this.layers[this.layers.length - 1].activation;
    const cloned = new NeuralNetwork(this.layerSizes, act, outAct);
    cloned.copyWeightsFrom(this, 1.0);
    return cloned;
  }

  getWeightsAndBiases(): { weights: number[][][]; biases: number[][] } {
    return {
      weights: this.layers.map(layer => layer.weights.data.map(row => [...row])),
      biases: this.layers.map(layer => layer.biases.toArray()),
    };
  }

  setWeightsAndBiases(weights: number[][][], biases: number[][]): void {
    if (weights.length !== this.layers.length || biases.length !== this.layers.length) {
      throw new Error(`Layer count mismatch: expected ${this.layers.length}, got ${weights.length}`);
    }
    for (let l = 0; l < this.layers.length; l++) {
      this.layers[l].weights = Matrix.from2D(weights[l]);
      this.layers[l].biases = Matrix.fromArray(biases[l]);
    }
  }

  getSnapshot(): LayerSnapshot[] {
    return this.layers.map(layer => ({
      weights: layer.weights.data.map(r => [...r]),
      biases: layer.biases.toArray(),
      outputs: layer.lastOutput ? layer.lastOutput.toArray() : new Array(layer.weights.rows).fill(0),
    }));
  }
}
