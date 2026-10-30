export type Platform = 'web' | 'app' | 'shared' | 'unknown';
export type Status = 'unknown' | 'planned' | 'merging' | 'testing' | 'done' | 'deployed';
export type StageKind = 'dev' | 'qa' | 'integration' | 'cut' | 'preprod' | 'production' | 'release';
export interface GridCell { col: number; text?: string; color?: string; note?: string }
export interface GridRow { row: number; label: string; note?: string; cells: GridCell[]; start?: string; end?: string; metadata?: string }
export interface GridSheet { title: string; sheetId: number; year: number; calendar: Record<number, string>; rows: GridRow[] }
export interface Stage { kind: StageKind; label: string; start: string; end: string; note: string; tentative: boolean }
export interface Feature {
  id: string; title: string; year: number; sheetId: number; sheetTitle: string; sourceRow: number;
  platform: Platform; platformInferred: boolean; version: string; stages: Stage[];
  status: Status; image: string; releaseId: string; stream: string; owner: string; notes: string[];
}
export interface Release {
  id: string; name: string; date: string | null; features: Feature[]; images: string[];
  status: Status; stream: string; explicit: boolean; platform: Platform;
}
export interface TimelineData {
  features: Feature[]; releases: Release[];
  source: { mode: 'live' | 'snapshot' | 'cached'; fetchedAt: string; checkedAt: string; url: string; warning?: string };
}
