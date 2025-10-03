import { useMemo, useState } from 'react';
import { formatNumber, formatShortNumber } from '../lib/parse';
import { LogEntry, OutlierInfo } from '../types';

type SortKey = 'time' | 'ham' | 'roi' | 'perM';

type EntriesTableProps = {
  logs: LogEntry[];
  outliers: Map<string, OutlierInfo>;
  conflicts: Set<string>;
  onToggleExclude: (id: string) => void;
  onDelete: (id: string) => void;
};

const signature = (entry: LogEntry) => `${entry.ham}|${entry.lvlTo}|${entry.cost}|${entry.dHr}`;

export function EntriesTable({ logs, outliers, conflicts, onToggleExclude, onDelete }: EntriesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('time');

  const sorted = useMemo(() => {
    const arr = [...logs];
    switch (sortKey) {
      case 'ham':
        return arr.sort((a, b) => a.ham.localeCompare(b.ham) || b.lvlTo - a.lvlTo);
      case 'roi':
        return arr.sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0));
      case 'perM':
        return arr.sort((a, b) => (b.perM ?? 0) - (a.perM ?? 0));
      default:
        return arr.sort((a, b) => b.createdAt - a.createdAt);
    }
  }, [logs, sortKey]);

  return (
    <div className="card">
      <header>
        <h2>Entries</h2>
        <div className="table-filter small">
          <span className="muted">Sort:</span>
          <button type="button" className="ghost" onClick={() => setSortKey('time')}>
            time
          </button>
          <button type="button" className="ghost" onClick={() => setSortKey('ham')}>
            hamster
          </button>
          <button type="button" className="ghost" onClick={() => setSortKey('roi')}>
            ROI
          </button>
          <button type="button" className="ghost" onClick={() => setSortKey('perM')}>
            Δ/hr per 1M
          </button>
        </div>
      </header>
      <div className="content table-scroll">
        {sorted.length === 0 ? (
          <p className="muted">No entries logged yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Hamster</th>
                <th>Level</th>
                <th className="right">Cost</th>
                <th className="right">Δ/hr</th>
                <th className="right">ROI</th>
                <th className="right">Δ/hr per 1M</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => {
                const outlier = outliers.get(entry.id);
                const conflict = conflicts.has(signature(entry));
                return (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>{entry.ham}</td>
                    <td>
                      {entry.lvlFrom}→<strong>{entry.lvlTo}</strong>
                    </td>
                    <td className="right">{formatNumber(entry.cost)}</td>
                    <td className="right">{formatNumber(entry.dHr)}</td>
                    <td className="right">{entry.roi !== undefined ? entry.roi.toFixed(6) : '—'}</td>
                    <td className="right">
                      {entry.perM !== undefined ? formatShortNumber(entry.perM, 2) : '—'}
                    </td>
                    <td>
                      <div className="flex small">
                        {entry.excluded && <span className="tag danger">excluded</span>}
                        {conflict && <span className="tag warn">conflict</span>}
                        {outlier &&
                          ((outlier.costZ !== undefined && Math.abs(outlier.costZ) > 2.5) ||
                            (outlier.gainZ !== undefined && Math.abs(outlier.gainZ) > 2.5)) && (
                            <span className="tag warn">outlier?</span>
                          )}
                      </div>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="ghost" onClick={() => onToggleExclude(entry.id)}>
                          {entry.excluded ? 'Include' : 'Exclude'}
                        </button>
                        <button type="button" className="danger" onClick={() => onDelete(entry.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
