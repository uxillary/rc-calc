import { HamsterId, HamsterFit, LogEntry } from '../types';
import { consecutiveLevelSpan, fitGeometric, fitLinear, groupByHamster } from './stats';

export function buildHamsterFits(entries: LogEntry[]): HamsterFit[] {
  const groups = groupByHamster(entries);
  return Object.entries(groups).map(([hamster, list]) => {
    const included = list.filter((entry) => !entry.excluded);
    const sorted = [...included].sort((a, b) => a.lvlTo - b.lvlTo);
    const levels = sorted.map((e) => e.lvlTo);
    const gains = sorted.map((e) => e.dHr);
    const costs = sorted.map((e) => e.cost);
    const costFit = fitGeometric(levels, costs);
    const gainFit = fitLinear(levels, gains);
    const last = list.reduce((acc, item) => (item.lvlTo > (acc?.lvlTo ?? -Infinity) ? item : acc), null as LogEntry | null);
    const multipliers: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].cost > 0) {
        multipliers.push(sorted[i].cost / sorted[i - 1].cost);
      }
    }
    const avgMultiplier = multipliers.length
      ? multipliers.reduce((a, b) => a + b, 0) / multipliers.length
      : null;

    const confidence = computeConfidence({
      points: sorted.length,
      levels,
      costR2: costFit?.r2 ?? 0,
      gainR2: gainFit?.r2 ?? 0,
    });

    return {
      hamster: hamster as HamsterId,
      lastLevel: last?.lvlTo ?? null,
      avgMultiplier,
      gainAlpha: gainFit?.alpha ?? null,
      gainBeta: gainFit?.beta ?? null,
      confidence,
      costFitR2: costFit?.r2 ?? null,
      gainFitR2: gainFit?.r2 ?? null,
      levels,
      costs,
      gains,
    };
  });
}

function computeConfidence({
  points,
  levels,
  costR2,
  gainR2,
}: {
  points: number;
  levels: number[];
  costR2: number;
  gainR2: number;
}): number {
  const p = Math.min(points / 6, 1);
  const span = Math.min(consecutiveLevelSpan(levels) / 6, 1);
  const confidence = 0.2 * p + 0.2 * span + 0.3 * gainR2 + 0.3 * costR2;
  return Math.round(confidence * 100) / 100;
}
