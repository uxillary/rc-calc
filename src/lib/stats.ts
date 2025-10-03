import { HamsterId, LogEntry } from '../types';

export type LinearFit = {
  alpha: number;
  beta: number;
  r2: number;
};

export type GeometricFit = {
  a: number;
  r: number;
  r2: number;
};

export function fitLinear(xs: number[], ys: number[]): LinearFit | null {
  const n = xs.length;
  if (n < 2) return null;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXX = xs.reduce((a, b) => a + b * b, 0);
  const sumXY = xs.reduce((acc, x, idx) => acc + x * ys[idx], 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  const beta = (n * sumXY - sumX * sumY) / denominator;
  const alpha = (sumY - beta * sumX) / n;
  const meanY = sumY / n;
  const ssTot = ys.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((acc, y, idx) => acc + (y - (alpha + beta * xs[idx])) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { alpha, beta, r2 };
}

export function fitGeometric(levels: number[], costs: number[]): GeometricFit | null {
  if (levels.length !== costs.length || levels.length < 2) return null;
  const lnCosts = costs.map((c) => Math.log(c));
  const linear = fitLinear(levels, lnCosts);
  if (!linear) return null;
  const a = Math.exp(linear.alpha);
  const r = Math.exp(linear.beta);
  return { a, r, r2: linear.r2 };
}

export function rollingZScores<T extends { dHr: number; cost: number; lvlTo: number }>(
  entries: T[],
  window = 6
): Map<T, { gainZ?: number; costZ?: number }> {
  const map = new Map<T, { gainZ?: number; costZ?: number }>();
  const sorted = [...entries].sort((a, b) => a.lvlTo - b.lvlTo);
  for (let i = 0; i < sorted.length; i++) {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    const gainStats = computeZ(slice.map((e) => e.dHr), sorted[i].dHr);
    const costStats = computeZ(slice.map((e) => e.cost), sorted[i].cost);
    map.set(sorted[i], {
      gainZ: gainStats,
      costZ: costStats,
    });
  }
  return map;
}

function computeZ(values: number[], value: number): number | undefined {
  if (values.length < 2) return undefined;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return undefined;
  return (value - mean) / sd;
}

export function groupByHamster(entries: LogEntry[]): Record<HamsterId, LogEntry[]> {
  return entries.reduce<Record<HamsterId, LogEntry[]>>((acc, entry) => {
    acc[entry.ham] ??= [];
    acc[entry.ham].push(entry);
    return acc;
  }, {});
}

export function consecutiveLevelSpan(levels: number[]): number {
  if (levels.length === 0) return 0;
  const sorted = [...levels].sort((a, b) => a - b);
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current += 1;
    } else if (sorted[i] !== sorted[i - 1]) {
      current = 1;
    }
    best = Math.max(best, current);
  }
  return best;
}
