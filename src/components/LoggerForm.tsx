import { useEffect, useMemo, useState } from 'react';
import { parseKMB } from '../lib/parse';
import { LogEntryV1, Options } from '../types';

type LoggerFormProps = {
  knownHamsters: string[];
  lastLevels: Record<string, number>;
  options: Options;
  duplicates: Set<string>;
  onSubmit: (entry: LogEntryV1) => void;
};

const DUPLICATE_SIG = (entry: Pick<LogEntryV1, 'ham' | 'lvlTo' | 'cost' | 'dHr'>) =>
  `${entry.ham}|${entry.lvlTo}|${entry.cost}|${entry.dHr}`;

export function LoggerForm({ knownHamsters, lastLevels, options, duplicates, onSubmit }: LoggerFormProps) {
  const [hamster, setHamster] = useState('');
  const [lvlTo, setLvlTo] = useState<number | ''>('');
  const [lvlFrom, setLvlFrom] = useState<number | ''>('');
  const [costRaw, setCostRaw] = useState('');
  const [dHrRaw, setDHrRaw] = useState('');
  const [totBefore, setTotBefore] = useState('');
  const [totAfter, setTotAfter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const known = lastLevels[hamster];
    if (known !== undefined) {
      setLvlFrom(known);
      setLvlTo(known + 1);
    }
  }, [hamster, lastLevels]);

  const costValue = useMemo(() => {
    if (!costRaw) return NaN;
    return options.kmbInput ? parseKMB(costRaw) : Number(costRaw);
  }, [costRaw, options.kmbInput]);

  const dHrValue = useMemo(() => {
    if (!dHrRaw) return NaN;
    return options.kmbInput ? parseKMB(dHrRaw) : Number(dHrRaw);
  }, [dHrRaw, options.kmbInput]);

  const roi = useMemo(() => {
    if (!Number.isFinite(costValue) || costValue <= 0 || !Number.isFinite(dHrValue)) return null;
    return dHrValue / costValue;
  }, [costValue, dHrValue]);

  const perM = useMemo(() => {
    if (roi === null) return null;
    return roi * 1_000_000;
  }, [roi]);

  const signature = useMemo(() => {
    if (!hamster || !Number.isFinite(lvlTo as number) || !Number.isFinite(costValue) || !Number.isFinite(dHrValue)) {
      return null;
    }
    return DUPLICATE_SIG({
      ham: hamster,
      lvlTo: Number(lvlTo),
      cost: costValue,
      dHr: dHrValue,
    });
  }, [hamster, lvlTo, costValue, dHrValue]);

  useEffect(() => {
    setWarning(null);
    if (!totBefore || !totAfter) return;
    const before = options.kmbInput ? parseKMB(totBefore) : Number(totBefore);
    const after = options.kmbInput ? parseKMB(totAfter) : Number(totAfter);
    if (!Number.isFinite(before) || !Number.isFinite(after)) return;
    const delta = after - before;
    if (Number.isFinite(dHrValue) && Math.abs(delta - dHrValue) > Math.max(1, dHrValue * 0.02)) {
      setWarning(`Totals mismatch (Δ=${delta.toLocaleString()} vs input ${dHrValue.toLocaleString()})`);
    }
  }, [totBefore, totAfter, dHrValue]);

  const resetForm = () => {
    setHamster('');
    setLvlFrom('');
    setLvlTo('');
    setCostRaw('');
    setDHrRaw('');
    setTotBefore('');
    setTotAfter('');
    setError(null);
    setWarning(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!hamster.trim()) {
      setError('Hamster name is required.');
      return;
    }
    const levelTo = Number(lvlTo);
    const levelFrom = Number(lvlFrom || (Number.isFinite(levelTo) ? levelTo - 1 : NaN));
    if (!Number.isFinite(levelTo) || !Number.isFinite(levelFrom)) {
      setError('Provide a valid level.');
      return;
    }
    if (levelTo < 1 || levelFrom < 0) {
      setError('Levels must be non-negative and lvlTo at least 1.');
      return;
    }
    if (levelTo !== levelFrom + 1) {
      setError('lvlTo must be lvlFrom + 1.');
      return;
    }
    if (!Number.isFinite(costValue) || costValue <= 0) {
      setError('Cost must be greater than zero.');
      return;
    }
    if (!Number.isFinite(dHrValue) || dHrValue <= 0) {
      setError('Δ/hr must be greater than zero.');
      return;
    }

    const entry: LogEntryV1 = {
      v: 1,
      ham: hamster.trim(),
      lvlFrom: levelFrom,
      lvlTo: levelTo,
      cost: costValue,
      dHr: dHrValue,
      totBefore: totBefore
        ? options.kmbInput
          ? parseKMB(totBefore)
          : Number(totBefore)
        : undefined,
      totAfter: totAfter
        ? options.kmbInput
          ? parseKMB(totAfter)
          : Number(totAfter)
        : undefined,
      roi: roi ?? undefined,
      perM: perM ?? undefined,
    };

    onSubmit(entry);
    setLvlFrom(levelTo);
    setLvlTo(levelTo + 1);
    setCostRaw('');
    setDHrRaw('');
    setTotBefore('');
    setTotAfter('');
    setWarning(null);
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <header>
        <h2>Log an Upgrade</h2>
        <span className="badge">offline-first</span>
      </header>
      <div className="content">
        <div className="grid cols-3">
          <div>
            <label htmlFor="hamster">Hamster</label>
            <input
              id="hamster"
              list="hamsters"
              value={hamster}
              onChange={(e) => setHamster(e.target.value)}
              placeholder="e.g. Robo-Hamster"
            />
            <datalist id="hamsters">
              {knownHamsters.map((ham) => (
                <option key={ham} value={ham} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="lvlTo">Level (after)</label>
            <input
              id="lvlTo"
              type="number"
              min={1}
              value={lvlTo}
              onChange={(e) => {
                const next = e.target.value ? Number(e.target.value) : '';
                setLvlTo(next);
                if (next !== '') {
                  setLvlFrom(Number(next) - 1);
                }
              }}
              placeholder="e.g. 22"
            />
          </div>
          <div>
            <label htmlFor="lvlFrom">Level (before)</label>
            <input
              id="lvlFrom"
              type="number"
              min={0}
              value={lvlFrom}
              onChange={(e) => setLvlFrom(e.target.value ? Number(e.target.value) : '')}
              placeholder="auto"
              readOnly={lastLevels[hamster] !== undefined}
            />
          </div>
        </div>
        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <div>
            <label htmlFor="cost">Cost ({options.kmbInput ? 'k/m/b' : 'RC'})</label>
            <input
              id="cost"
              value={costRaw}
              onChange={(e) => setCostRaw(e.target.value)}
              placeholder={options.kmbInput ? 'e.g. 2.9m' : 'e.g. 2194000'}
            />
          </div>
          <div>
            <label htmlFor="dHr">Δ RC/hour</label>
            <input
              id="dHr"
              value={dHrRaw}
              onChange={(e) => setDHrRaw(e.target.value)}
              placeholder={options.kmbInput ? 'e.g. 766k' : 'e.g. 766000'}
            />
          </div>
          <div>
            <label>Derived KPIs</label>
            <div className="kpi-grid">
              <div className="kpi-box">
                <span className="muted small">ROI (Δ ÷ cost)</span>
                <strong>{roi ? roi.toFixed(5) : '—'}</strong>
              </div>
              <div className="kpi-box">
                <span className="muted small">Δ/hr per 1M</span>
                <strong>{perM ? perM.toFixed(2) : '—'}</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="grid cols-2" style={{ marginTop: 16 }}>
          <div className="grid cols-2">
            <div>
              <label htmlFor="totBefore">Total RC/hr before (opt)</label>
              <input
                id="totBefore"
                value={totBefore}
                onChange={(e) => setTotBefore(e.target.value)}
                placeholder="e.g. 12.5m"
              />
            </div>
            <div>
              <label htmlFor="totAfter">Total RC/hr after (opt)</label>
              <input
                id="totAfter"
                value={totAfter}
                onChange={(e) => setTotAfter(e.target.value)}
                placeholder="e.g. 13.3m"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="alert danger" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}
        {!error && warning && (
          <div className="alert" style={{ marginTop: 16 }}>
            {warning}
          </div>
        )}
        {signature && duplicates.has(signature) && (
          <div className="alert" style={{ marginTop: 16 }}>
            Possible duplicate entry detected for this hamster/level/cost/Δ.
          </div>
        )}

        <div className="flex" style={{ marginTop: 16 }}>
          <button type="submit">Add Entry</button>
          <button type="button" className="ghost" onClick={resetForm}>
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}
