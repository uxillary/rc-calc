export type HamsterId = string;

export type LogEntryV1 = {
  v: 1;
  ham: HamsterId;
  lvlFrom: number;
  lvlTo: number;
  cost: number;
  dHr: number;
  totBefore?: number;
  totAfter?: number;
  excluded?: boolean;
};

export type Options = {
  kmbInput: boolean;
  linearGain: boolean;
  schemaVer: 1;
};

export type LogEntry = LogEntryV1 & {
  id: string;
  createdAt: number;
  roi: number;
  perM: number;
};

export interface LocalState {
  logs: LogEntry[];
  lastLevels: Record<HamsterId, number>;
  options: Options;
}

export type OutlierInfo = {
  costZ?: number;
  gainZ?: number;
};

export type HamsterFit = {
  hamster: HamsterId;
  lastLevel: number | null;
  avgMultiplier: number | null;
  costBase: number | null;
  costRatio: number | null;
  gainAlpha: number | null;
  gainBeta: number | null;
  confidence: number;
  costFitR2: number | null;
  gainFitR2: number | null;
  levels: number[];
  costs: number[];
  gains: number[];
};
