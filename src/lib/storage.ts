import { LogEntry, LogEntryV1, LocalState, Options } from '../types';

const LOG_KEY = 'rt.logs';
const LAST_KEY = 'rt.lastLevels';
const OPT_KEY = 'rt.options';

export const DEFAULT_OPTIONS: Options = {
  kmbInput: true,
  linearGain: true,
  schemaVer: 1,
};

const hasWindow = typeof window !== 'undefined';

export function loadLocalState(): LocalState {
  if (!hasWindow) {
    return {
      logs: [],
      lastLevels: {},
      options: { ...DEFAULT_OPTIONS },
    };
  }

  const logsRaw = safeParseArray<LogEntryV1>(localStorage.getItem(LOG_KEY)) ?? [];
  const lastLevels = safeParse<Record<string, number>>(localStorage.getItem(LAST_KEY)) ?? {};
  const optionsStored = safeParse<Options>(localStorage.getItem(OPT_KEY));
  const options = normalizeOptions(optionsStored);

  const now = Date.now();
  const logs: LogEntry[] = logsRaw.map((entry, index) =>
    hydrateEntry(entry, now - (logsRaw.length - index - 1) * 1000)
  );

  return {
    logs,
    lastLevels,
    options,
  };
}

export function persistLogs(logs: LogEntry[]) {
  if (!hasWindow) return;
  const payload = logs.map(stripMeta);
  localStorage.setItem(LOG_KEY, JSON.stringify(payload));
}

export function persistLastLevels(lastLevels: Record<string, number>) {
  if (!hasWindow) return;
  localStorage.setItem(LAST_KEY, JSON.stringify(lastLevels));
}

export function persistOptions(options: Options) {
  if (!hasWindow) return;
  localStorage.setItem(OPT_KEY, JSON.stringify({ ...options, schemaVer: 1 }));
}

export function createLogEntry(entry: LogEntryV1): LogEntry {
  const createdAt = Date.now();
  return {
    ...entry,
    id: randomId(),
    createdAt,
    ...computeMetrics(entry),
  };
}

export function hydrateEntry(entry: LogEntryV1, createdAt: number): LogEntry {
  return {
    ...entry,
    id: randomId(),
    createdAt,
    ...computeMetrics(entry),
  };
}

function computeMetrics(entry: LogEntryV1): Pick<LogEntry, 'roi' | 'perM'> {
  const roi = entry.cost > 0 ? entry.dHr / entry.cost : 0;
  const perM = roi * 1_000_000;
  return {
    roi,
    perM,
  };
}

function stripMeta(entry: LogEntry): LogEntryV1 {
  const { id: _id, createdAt: _createdAt, roi: _roi, perM: _perM, ...rest } = entry;
  return { ...rest };
}

function normalizeOptions(options: Options | undefined): Options {
  return {
    kmbInput: options?.kmbInput ?? DEFAULT_OPTIONS.kmbInput,
    linearGain: options?.linearGain ?? DEFAULT_OPTIONS.linearGain,
    schemaVer: 1,
  };
}

function safeParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('Failed to parse localStorage payload', err);
    return undefined;
  }
}

function safeParseArray<T>(raw: string | null): T[] | undefined {
  const parsed = safeParse<unknown>(raw);
  return Array.isArray(parsed) ? (parsed as T[]) : undefined;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
