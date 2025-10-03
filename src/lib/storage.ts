import { LogEntry, LogEntryV1, Options, AppState, StorageSnapshot } from '../types';

const LOG_KEY = 'rt.logs';
const OPT_KEY = 'rt.opts';
const STATE_KEY = 'rt.state';

export const DEFAULT_OPTIONS: Options = {
  kmbInput: true,
  linearGain: true,
  schemaVer: 1,
};

export const DEFAULT_STATE: AppState = {
  lastHamLevels: {},
};

export function loadSnapshot(): StorageSnapshot {
  const logsRaw = safeParse<LogEntryV1[]>(localStorage.getItem(LOG_KEY)) ?? [];
  const options = safeParse<Options>(localStorage.getItem(OPT_KEY)) ?? DEFAULT_OPTIONS;
  const state = safeParse<AppState>(localStorage.getItem(STATE_KEY)) ?? DEFAULT_STATE;
  const logs: LogEntry[] = logsRaw.map((entry, index) => ({
    ...entry,
    id: `${entry.ham}-${entry.lvlTo}-${entry.cost}-${entry.dHr}-${index}`,
    createdAt: Date.now() - (logsRaw.length - index) * 1000,
  }));
  return { logs, options, state };
}

export function persistSnapshot(snapshot: StorageSnapshot) {
  const plainLogs: LogEntryV1[] = snapshot.logs.map(({ id, createdAt, ...rest }) => rest);
  localStorage.setItem(LOG_KEY, JSON.stringify(plainLogs));
  localStorage.setItem(OPT_KEY, JSON.stringify(snapshot.options));
  localStorage.setItem(STATE_KEY, JSON.stringify(snapshot.state));
}

export function persistLogs(logs: LogEntry[]) {
  const plainLogs: LogEntryV1[] = logs.map(({ id, createdAt, ...rest }) => rest);
  localStorage.setItem(LOG_KEY, JSON.stringify(plainLogs));
}

export function persistState(state: AppState) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function persistOptions(options: Options) {
  localStorage.setItem(OPT_KEY, JSON.stringify(options));
}

function safeParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function createLogEntry(data: LogEntryV1): LogEntry {
  return {
    ...data,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
}
