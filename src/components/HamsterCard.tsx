import { HamsterFit } from '../types';
import { formatNumber } from '../lib/parse';

type HamsterCardProps = {
  fit: HamsterFit;
};

export function HamsterCard({ fit }: HamsterCardProps) {
  const { hamster, lastLevel, avgMultiplier, gainAlpha, gainBeta, confidence, levels, costs, gains } = fit;
  const badgeClass = confidence >= 0.75 ? 'badge good' : confidence >= 0.4 ? 'badge medium' : 'badge low';

  return (
    <div className="hamster-card">
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{hamster}</h3>
        <span className={badgeClass}>confidence {Math.round(confidence * 100)}%</span>
      </div>
      <div className="grid cols-2">
        <div>
          <span className="muted small">Last level</span>
          <div>{lastLevel ?? '—'}</div>
        </div>
        <div>
          <span className="muted small">Avg cost ×</span>
          <div>{avgMultiplier ? avgMultiplier.toFixed(3) : '—'}</div>
        </div>
        <div>
          <span className="muted small">Gain intercept α</span>
          <div>{gainAlpha !== null ? formatNumber(gainAlpha, 2) : '—'}</div>
        </div>
        <div>
          <span className="muted small">Gain slope β</span>
          <div>{gainBeta !== null ? gainBeta.toFixed(3) : '—'}</div>
        </div>
      </div>
      <div className="muted small">Fits use {levels.length} points</div>
      <Sparkline levels={levels} costs={costs} gains={gains} />
    </div>
  );
}

type SparklineProps = {
  levels: number[];
  costs: number[];
  gains: number[];
};

function Sparkline({ levels, costs, gains }: SparklineProps) {
  if (levels.length < 2) {
    return <div className="muted small">Not enough data for charts yet.</div>;
  }

  const minLevel = Math.min(...levels);
  const maxLevel = Math.max(...levels);
  const levelSpan = maxLevel - minLevel || 1;

  const logCosts = costs.map((c) => Math.log10(c));
  const minCost = Math.min(...logCosts);
  const maxCost = Math.max(...logCosts);
  const costSpan = maxCost - minCost || 1;

  const minGain = Math.min(...gains);
  const maxGain = Math.max(...gains);
  const gainSpan = maxGain - minGain || 1;

  const toX = (lvl: number) => ((lvl - minLevel) / levelSpan) * 100;
  const costPath = levels
    .map((lvl, idx) => {
      const y = 100 - ((logCosts[idx] - minCost) / costSpan) * 100;
      return `${idx === 0 ? 'M' : 'L'}${toX(lvl)},${y}`;
    })
    .join(' ');

  const gainPath = levels
    .map((lvl, idx) => {
      const y = 100 - ((gains[idx] - minGain) / gainSpan) * 100;
      return `${idx === 0 ? 'M' : 'L'}${toX(lvl)},${y}`;
    })
    .join(' ');

  return (
    <div className="sparkline">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <path className="cost" d={costPath} />
        <path className="gain" d={gainPath} />
      </svg>
    </div>
  );
}
