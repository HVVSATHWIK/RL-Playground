export function mse(predicted: number[], target: number[]): number {
  let sum = 0;
  for (let i = 0; i < predicted.length; i++) {
    sum += (predicted[i] - target[i]) ** 2;
  }
  return sum / predicted.length;
}

export function mseDeriv(predicted: number, target: number): number {
  return 2 * (predicted - target);
}
