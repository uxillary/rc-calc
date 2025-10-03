import { useEffect, useMemo, useRef, useState } from 'react';
import { LoggerForm } from './components/LoggerForm';
import { EntriesTable } from './components/EntriesTable';
import { HamsterCard } from './components/HamsterCard';
import { NextBestPanel } from './components/NextBestPanel';
import { buildHamsterFits } from './lib/curves';
import {
  DEFAULT_OPTIONS,
  DEFAULT_STATE,
  createLogEntry,
  loadSnapshot,
  persistLogs,
  persistOptions,
  persistState,
} from './lib/storage';
import { groupByHamster, rollingZScores } from './lib/stats';
import { HamsterFit, LogEntry, LogEntryV1, OutlierInfo, Options } from './types';

const isBrowser = typeof window !== 'undefined';

const signature = (entry: Pick<LogEntryV1, 'ham' | 'lvlTo' | 'cost' | 'dHr'>) =>
  `${entry.ham}|${entry.lvlTo}|${entry.cost}|${entry.dHr}`;

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [prefillLevels, setPrefillLevels] = useState<Record<string, number>>(DEFAULT_STATE.lastHamLevels);
  const [loaded, setLoaded] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isBrowser) return;
    const snapshot = loadSnapshot();
    setLogs(snapshot.logs);
    setOptions(snapshot.options);
    setPrefillLevels(snapshot.state.lastHamLevels ?? {});
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !isBrowser) return;
    persistLogs(logs);
  }, [logs, loaded]);

  useEffect(() => {
    if (!loaded || !isBrowser) return;
    persistOptions(options);
  }, [options, loaded]);

  useEffect(() => {
    if (!loaded || !isBrowser) return;
    persistState({ lastHamLevels: prefillLevels });
  }, [prefillLevels, loaded]);

  useEffect(() => {
    if (!loaded) return;
    setPrefillLevels((prev) => {
      const derived = computeLastLevels(logs);
      if (shallowEqual(prev, derived)) {
        return prev;
      }
      return derived;
    });
  }, [logs, loaded]);

  const hamsters = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((entry) => set.add(entry.ham));
    Object.keys(prefillLevels).forEach((ham) => set.add(ham));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [logs, prefillLevels]);

  const duplicateSignatures = useMemo(() => {
    return new Set(logs.map((entry) => signature(entry)));
  }, [logs]);

  const conflictSignatures = useMemo(() => {
    const grouped = new Map<string, LogEntry[]>();
    logs.forEach((entry) => {
      const key = signature(entry);
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    });
    const conflict = new Set<string>();
    grouped.forEach((list, key) => {
      if (list.length > 1) {
        conflict.add(key);
      }
    });
    return conflict;
  }, [logs]);

  const outliers = useMemo(() => {
    const map = new Map<string, OutlierInfo>();
    const groups = groupByHamster(logs);
    Object.values(groups).forEach((list) => {
      const zScores = rollingZScores(list, 6);
      list.forEach((entry) => {
        const info = zScores.get(entry);
        if (info) {
          map.set(entry.id, info);
        }
      });
    });
    return map;
  }, [logs]);

  const hamsterFits: HamsterFit[] = useMemo(() => buildHamsterFits(logs), [logs]);

  const totalEntries = logs.length;
  const totalHamsters = hamsters.length;
  const latestR = useMemo(() => {
    const ratios: number[] = [];
    const grouped = groupByHamster(logs.filter((entry) => !entry.excluded));
    Object.values(grouped).forEach((list) => {
      const sorted = [...list].sort((a, b) => a.lvlTo - b.lvlTo);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i - 1].cost > 0) {
          ratios.push(sorted[i].cost / sorted[i - 1].cost);
        }
      }
    });
    if (ratios.length === 0) return null;
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }, [logs]);

  const handleAdd = (entry: LogEntryV1) => {
    const roi = entry.dHr / entry.cost;
    const perM = roi * 1_000_000;
    const normalized: LogEntryV1 = {
      ...entry,
      roi,
      perM,
    };
    const log = createLogEntry(normalized);
    setLogs((prev) => [...prev, log]);
    setPrefillLevels((prev) => ({ ...prev, [entry.ham]: entry.lvlTo }));
  };

  const handleToggleExclude = (id: string) => {
    setLogs((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              excluded: !entry.excluded,
            }
          : entry
      )
    );
  };

  const handleDelete = (id: string) => {
    setLogs((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(logs.map(stripMeta), null, 2)], {
      type: 'application/json',
    });
    downloadBlob(blob, `rollertap-logs_v1_${timestamp()}.json`);
  };

  const handleExportCSV = () => {
    const rows = logs.map(stripMeta);
    const header = ['ham', 'lvlFrom', 'lvlTo', 'cost', 'dHr', 'totBefore', 'totAfter', 'roi', 'perM', 'excluded'];
    const lines = [header.join(',')];
    rows.forEach((row) => {
      lines.push(
        header
          .map((key) => {
            const value = (row as Record<string, unknown>)[key];
            if (value === undefined) return '';
            return typeof value === 'number' ? value.toString() : String(value);
          })
          .join(',')
      );
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    downloadBlob(blob, `rollertap-logs_v1_${timestamp()}.csv`);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Invalid file');
      const incoming: LogEntry[] = [];
      const existing = new Map<string, LogEntryV1[]>();
      logs.forEach((entry) => {
        const key = signature(entry);
        existing.set(key, [...(existing.get(key) ?? []), stripMeta(entry)]);
      });
      for (const raw of data) {
        if (!raw || raw.v !== 1) continue;
        const candidate = normalizeRaw(raw as LogEntryV1);
        if (!candidate) continue;
        const key = signature(candidate);
        const matches = existing.get(key) ?? [];
        const isIdentical = matches.some((m) => JSON.stringify(m) === JSON.stringify(candidate));
        if (isIdentical) continue;
        incoming.push(createLogEntry(candidate));
        existing.set(key, [...matches, candidate]);
      }
      if (incoming.length === 0) {
        setImportMessage('No new entries found in import.');
        return;
      }
      setLogs((prev) => [...prev, ...incoming]);
      setPrefillLevels((prev) => {
        const next = { ...prev };
        incoming.forEach((entry) => {
          next[entry.ham] = Math.max(next[entry.ham] ?? 0, entry.lvlTo);
        });
        return next;
      });
      setImportMessage(`Imported ${incoming.length} new entries.`);
    } catch (err) {
      console.error(err);
      setImportMessage('Failed to import file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="app">
      <h1>RollerTap Upgrade Logger</h1>
      <div className="section-grid">
        <LoggerForm
          knownHamsters={hamsters}
          lastLevels={prefillLevels}
          options={options}
          duplicates={duplicateSignatures}
          onSubmit={handleAdd}
        />
        <div className="grid" style={{ gap: 18 }}>
          <div className="card">
            <header>
              <h2>Dataset Snapshot</h2>
            </header>
            <div className="content kpi-grid">
              <div className="kpi-box">
                <span className="muted small">Entries</span>
                <strong>{totalEntries}</strong>
              </div>
              <div className="kpi-box">
                <span className="muted small">Hamsters tracked</span>
                <strong>{totalHamsters}</strong>
              </div>
              <div className="kpi-box">
                <span className="muted small">Avg cost multiplier</span>
                <strong>{latestR ? latestR.toFixed(3) : '—'}</strong>
              </div>
              <div className="kpi-box">
                <span className="muted small">Export</span>
                <div className="flex">
                  <button type="button" className="ghost" onClick={handleExportJSON}>
                    JSON
                  </button>
                  <button type="button" className="ghost" onClick={handleExportCSV}>
                    CSV
                  </button>
                </div>
              </div>
              <div className="kpi-box">
                <span className="muted small">Preferences</span>
                <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={options.kmbInput}
                    onChange={(event) =>
                      setOptions((prev) => ({ ...prev, kmbInput: event.target.checked, schemaVer: 1 }))
                    }
                  />
                  Accept k/m/b shorthand
                </label>
                <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={options.linearGain}
                    onChange={(event) =>
                      setOptions((prev) => ({ ...prev, linearGain: event.target.checked, schemaVer: 1 }))
                    }
                  />
                  Linear gain fit
                </label>
              </div>
              <div className="kpi-box">
                <span className="muted small">Import JSON</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleImport(file);
                    }
                  }}
                />
                {importMessage && <span className="muted small">{importMessage}</span>}
              </div>
            </div>
          </div>
          <NextBestPanel />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <EntriesTable
          logs={logs}
          outliers={outliers}
          conflicts={conflictSignatures}
          onToggleExclude={handleToggleExclude}
          onDelete={handleDelete}
        />
      </div>

      <section style={{ marginTop: 24 }}>
        <h2>Per-hamster models</h2>
        <div className="hamster-cards">
          {hamsterFits.length === 0 ? (
            <p className="muted">Add entries to see fitted curves.</p>
          ) : (
            hamsterFits.map((fit) => <HamsterCard key={fit.hamster} fit={fit} />)
          )}
        </div>
      </section>
    </div>
  );
}

function stripMeta(entry: LogEntry): LogEntryV1 {
  const { id: _id, createdAt: _createdAt, ...rest } = entry;
  return rest;
}

function timestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}`;
}

function downloadBlob(blob: Blob, filename: string) {
  if (!isBrowser) return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeRaw(raw: LogEntryV1): LogEntryV1 | null {
  if (raw.v !== 1) return null;
  if (!raw.ham || typeof raw.ham !== 'string') return null;
  if (typeof raw.lvlTo !== 'number' || typeof raw.lvlFrom !== 'number') return null;
  if (raw.lvlTo !== raw.lvlFrom + 1) return null;
  if (typeof raw.cost !== 'number' || raw.cost <= 0) return null;
  if (typeof raw.dHr !== 'number' || raw.dHr <= 0) return null;
  const roi = raw.dHr / raw.cost;
  return {
    v: 1,
    ham: raw.ham,
    lvlFrom: raw.lvlFrom,
    lvlTo: raw.lvlTo,
    cost: raw.cost,
    dHr: raw.dHr,
    totBefore: raw.totBefore,
    totAfter: raw.totAfter,
    roi,
    perM: roi * 1_000_000,
    excluded: raw.excluded,
  };
}

function computeLastLevels(entries: LogEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((acc, entry) => {
    if (!acc[entry.ham] || entry.lvlTo > acc[entry.ham]) {
      acc[entry.ham] = entry.lvlTo;
    }
    return acc;
  }, {});
}

function shallowEqual(a: Record<string, number>, b: Record<string, number>) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
