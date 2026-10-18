export interface ActivationFn {
  name: string;
  fn: (x: number) => number;
  derivative: (x: number) => number;
}

export const sigmoid: ActivationFn = {
  name: 'sigmoid',
  fn: (x) => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))),
  derivative: (x) => {
    const s = 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
    return s * (1 - s);
  },
};

export const relu: ActivationFn = {
  name: 'relu',
  fn: (x) => Math.max(0, x),
  derivative: (x) => (x > 0 ? 1 : 0),
};

export const tanh_: ActivationFn = {
  name: 'tanh',
  fn: (x) => Math.tanh(x),
  derivative: (x) => 1 - Math.tanh(x) ** 2,
};

export const linear: ActivationFn = {
  name: 'linear',
  fn: (x) => x,
  derivative: () => 1,
};

export const activations: Record<string, ActivationFn> = {
  sigmoid,
  relu,
  tanh: tanh_,
  linear,
};
