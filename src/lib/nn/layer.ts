import { Matrix } from '../math/matrix';
import type { ActivationFn } from '../math/activations';

export class Layer {
  weights: Matrix;
  biases: Matrix;
  activation: ActivationFn;

  // Cached for backprop
  lastInput!: Matrix;
  lastRaw!: Matrix;
  lastOutput!: Matrix;

  constructor(inputSize: number, outputSize: number, activation: ActivationFn) {
    // Xavier initialization
    const scale = Math.sqrt(2 / (inputSize + outputSize));
    this.weights = Matrix.random(outputSize, inputSize, scale);
    this.biases = Matrix.zeros(outputSize, 1);
    this.activation = activation;
  }

  forward(input: Matrix): Matrix {
    this.lastInput = input;
    this.lastRaw = Matrix.add(Matrix.multiply(this.weights, input), this.biases);
    this.lastOutput = Matrix.elementwise(this.lastRaw, this.activation.fn);
    return this.lastOutput;
  }

  backward(outputGradient: Matrix, learningRate: number): Matrix {
    // Activation gradient
    const activationGrad = Matrix.elementwise(this.lastRaw, this.activation.derivative);
    const delta = Matrix.hadamard(outputGradient, activationGrad);

    // Weight and bias gradients
    const weightGrad = Matrix.multiply(delta, Matrix.transpose(this.lastInput));
    const biasGrad = delta;

    // Input gradient (to pass backward)
    const inputGrad = Matrix.multiply(Matrix.transpose(this.weights), delta);

    // Update weights and biases
    this.weights = Matrix.subtract(this.weights, Matrix.scale(weightGrad, learningRate));
    this.biases = Matrix.subtract(this.biases, Matrix.scale(biasGrad, learningRate));

    return inputGrad;
  }
}
