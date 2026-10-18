export interface DataPoint {
  x: number;
  y: number;
  label: number; // 0 or 1
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateXOR(n = 200): DataPoint[] {
  const points: DataPoint[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;
    const label = (x > 0) !== (y > 0) ? 1 : 0;
    points.push({ x, y, label });
  }
  return shuffle(points);
}

export function generateCircle(n = 200): DataPoint[] {
  const points: DataPoint[] = [];
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const isInner = i < n / 2;
    const r = isInner ? Math.random() * 0.5 : 0.7 + Math.random() * 0.3;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    points.push({ x, y, label: isInner ? 0 : 1 });
  }
  return shuffle(points);
}

export function generateSpiral(n = 200): DataPoint[] {
  const points: DataPoint[] = [];
  const half = n / 2;
  for (let i = 0; i < half; i++) {
    const t = (i / half) * 3 * Math.PI + Math.random() * 0.3;
    const r = (i / half) * 0.8;
    points.push({ x: r * Math.cos(t), y: r * Math.sin(t), label: 0 });
    points.push({ x: -r * Math.cos(t), y: -r * Math.sin(t), label: 1 });
  }
  return shuffle(points);
}

export function generateGaussian(n = 200): DataPoint[] {
  const points: DataPoint[] = [];
  const randn = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  for (let i = 0; i < n; i++) {
    const isClassA = i < n / 2;
    const cx = isClassA ? -0.4 : 0.4;
    const cy = isClassA ? -0.4 : 0.4;
    const x = cx + randn() * 0.25;
    const y = cy + randn() * 0.25;
    points.push({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), label: isClassA ? 0 : 1 });
  }
  return shuffle(points);
}

export const datasets: Record<string, (n?: number) => DataPoint[]> = {
  xor: generateXOR,
  circle: generateCircle,
  spiral: generateSpiral,
  gaussian: generateGaussian,
};
