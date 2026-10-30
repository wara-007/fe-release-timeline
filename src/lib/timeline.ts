import type { Feature, GridSheet, Platform, Release, Stage, StageKind, Status } from './types';

export const SOURCE_URL = 'https://docs.google.com/spreadsheets/d/19Vy1EFRNE0H1crAoH_HivCDScOHRhnCAfKGDZpoArfc/edit';
export const STATUS_LABEL: Record<Status, string> = {
  unknown: 'ยังไม่ระบุสถานะ', planned: 'Planned', merging: 'Merging', testing: 'Testing', done: 'Done', deployed: 'Deployed',
};
export const PLATFORM_LABEL: Record<Platform, string> = { web: 'Web', app: 'App', shared: 'App + Web', unknown: 'ยังไม่ระบุ' };
export const STAGE_LABEL: Record<StageKind, string> = {
  dev: 'FE Development', qa: 'QA', integration: 'Integration', cut: 'Cut code', preprod: 'Pre-production', production: 'Production', release: 'App release',
};
export function bangkokToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function addDays(date: string, days: number): string {
  return new Date(new Date(date + 'T00:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
export function formatDate(date?: string | null, year = false): string {
  if (!date) return 'ยังไม่ระบุวัน';
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' as const } : {}), timeZone: 'Asia/Bangkok' }).format(new Date(date + 'T00:00:00Z'));
}
function kindFor(label: string): StageKind | null {
  const l = label.trim().toLowerCase();
  if (/^dev\s*(fe|fn)\b|^fn$/.test(l)) return 'dev';
  if (/^qa\b|^uat\b/.test(l)) return 'qa';
  if (/^(integrat|commerce.*integrat)/.test(l)) return 'integration';
  if (/^cut\s*code/.test(l)) return 'cut';
  if (/app release|prod release app/.test(l)) return 'release';
  if (/deploy.*preprod|preprod.*rl/.test(l)) return 'preprod';
  if (/deploy.*prod|prod.*deploy|prod\s*rl|^deploy$|^on cloud prod\s*$|^deploy production$/.test(l)) return 'production';
  return null;
}
function auxiliary(label: string): boolean {
  if (/^Dev(?:BE|FE|FN)\b/i.test(label)) return true;
  return /^(?:[ฺ]?BA\b|SA\b|PO\b|Dev\b|QA\b|On[ -]+(?:prem|cloud)\b|Earth\s+On\b|Groom\b|APIGW?\b|TTO\b|Pre[- ]?(?:CAB|cap)\b|Major\b|CAB\b|Internal\b|Inter nal\b|HOTO\b|xFunc\b|INTX\b|Wait\b|Release Date\b|Improve and deployment|Epic$|Task$)/i.test(label) || kindFor(label) !== null;
}
function metadata(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split(/[\n;]+/)) {
    const match = line.trim().match(/^(status|สถานะ|image|build|release|release id|stream|owner|platform)\s*[:=]\s*(.+)$/i);
    if (match) result[match[1].toLowerCase().replace('release id', 'release').replace('สถานะ', 'status')] = match[2].trim();
  }
  return result;
}
function statusOf(value = ''): Status {
  const key = value.toLowerCase().trim();
  return (['planned', 'merging', 'testing', 'done', 'deployed'] as Status[]).includes(key as Status) ? key as Status : key === 'released' ? 'deployed' : 'unknown';
}
function platformOf(title: string, explicit = ''): Platform {
  const text = explicit || title;
  const web = /\bweb\b/i.test(text);
  const app = /\bapp\b|flutter|trueapp|dtac/i.test(text);
  return web && app ? 'shared' : web ? 'web' : app ? 'app' : 'unknown';
}
function stagesFromRow(sheet: GridSheet, row: GridSheet['rows'][number], kind: StageKind): Stage[] {
  const dated = row.cells.filter(c => sheet.calendar[c.col] && (c.text || c.color)).sort((a, b) => a.col - b.col);
  if (row.start) return [{ kind, label: row.label, start: row.start, end: row.end || row.start, note: dated.map(c => c.text).filter(Boolean).join(' · '), tentative: false }];
  const groups: typeof dated[] = [];
  for (const cell of dated) {
    const group = groups.at(-1);
    const prev = group?.at(-1);
    // Keep distinct annotations (e.g. Web/App or tentative/final release) separate.
    const bridge = prev && cell.col - prev.col <= 4 && (!cell.text || !group?.some(c => c.text)) && cell.color === prev.color;
    if (group && bridge) group.push(cell); else groups.push([cell]);
  }
  return groups.map(group => {
    const note = group.map(c => [c.text, c.note].filter(Boolean).join(' ')).filter(Boolean).join(' · ');
    return { kind, label: row.label, start: sheet.calendar[group[0].col], end: sheet.calendar[group.at(-1)!.col], note, tentative: /tent[ae]tive|tentative|รอยืนยัน/i.test(note) };
  });
}
export function parseSheets(sheets: GridSheet[]): Feature[] {
  const features: Feature[] = [];
  for (const sheet of sheets) {
    let current: Feature | undefined;
    let version = '';
    let explicit: Record<string, string> = {};
    let hasFeRow = false;
    const finalize = () => {
      if (!current) return;
      current.status = statusOf(explicit.status);
      current.image = explicit.image || explicit.build || '';
      current.releaseId = explicit.release || '';
      current.stream = explicit.stream || '';
      current.owner = explicit.owner || '';
      current.platform = platformOf(current.title, explicit.platform);
      if (!explicit.platform && current.stages.some(s => s.kind === 'release')) {
        current.platform = current.platform === 'web' || current.platform === 'shared' ? 'shared' : 'app';
      }
      current.platformInferred = !explicit.platform;
      // Only retain features with FE work, a platform signal, or an explicit release record.
      if (hasFeRow || current.stages.some(s => s.kind === 'dev') || current.platform !== 'unknown' || current.releaseId || /FE|FN|single loyalty|IR Insurance|TOL|OneD/i.test(current.title)) features.push(current);
      current = undefined;
      explicit = {};
      hasFeRow = false;
    };
    for (const row of sheet.rows) {
      const label = row.label.trim();
      if (!label) continue;
      if (/^release version\s*:/i.test(label) || /^\d+\.\d+\.\d+/.test(label)) {
        finalize();
        version = label.replace(/^release version\s*:\s*/i, '').replace(/\s*(?:Dev.*|==>.*)$/, '').trim();
        continue;
      }
      const kind = kindFor(label);
      if (kind && current) {
        if (kind === 'dev') hasFeRow = true;
        current.stages.push(...stagesFromRow(sheet, row, kind));
        const tagged = metadata([row.note, ...row.cells.map(c => c.note)].filter(Boolean).join('\n'));
        explicit = { ...explicit, ...tagged };
        continue;
      }
      if (/^(status|สถานะ|image|build|release id|stream|owner|platform)\s*:?(\s*)$/i.test(label) && current) {
        const key = label.replace(/[:\s]+$/, '').toLowerCase();
        explicit = { ...explicit, ...metadata(`${key}: ${row.cells.filter(c => c.col >= 2 && c.col <= 4).map(c => c.text).filter(Boolean).join(' ')}`) };
        continue;
      }
      if (auxiliary(label)) continue;
      finalize();
      explicit = metadata([row.note, row.metadata, ...row.cells.filter(c => c.col <= 4).map(c => c.note || c.text)].filter(Boolean).join('\n'));
      current = {
        id: `${sheet.sheetId}-${row.row}`, title: label, year: sheet.year, sheetId: sheet.sheetId,
        sheetTitle: sheet.title, sourceRow: row.row, platform: 'unknown', platformInferred: true,
        version, stages: [], status: 'unknown', image: '', releaseId: '', stream: '', owner: '',
        notes: /(?:-->|==>)\s*Done|\bDONE\b/i.test(label) ? ['ชีตระบุ Done ในชื่องาน แต่ยังไม่ยืนยันสถานะรอบ release'] : [],
      };
      version = '';
      // Some single-row tasks mark deployment in their own calendar row.
      for (const cell of row.cells.filter(c => c.text && /deploy|release/i.test(c.text))) {
        const date = sheet.calendar[cell.col];
        if (date) current.stages.push({ kind: 'production', label: 'Production', start: date, end: date, note: cell.text!, tentative: false });
      }
    }
    finalize();
  }
  return features;
}
export function featureDate(feature: Feature): string | null {
  const release = feature.stages.filter(s => s.kind === 'release' && !s.tentative).map(s => s.start).sort().at(-1);
  const prod = feature.stages.filter(s => s.kind === 'production' && !s.tentative).map(s => s.start).sort().at(-1);
  return release || prod || null;
}
function rollupStatus(features: Feature[]): Status {
  if (features.every(f => f.status === 'deployed')) return 'deployed';
  if (features.every(f => ['done', 'deployed'].includes(f.status))) return 'done';
  if (features.some(f => f.status === 'unknown')) return 'unknown';
  if (features.some(f => f.status === 'testing')) return 'testing';
  if (features.some(f => f.status === 'merging')) return 'merging';
  return 'planned';
}
export function buildReleases(features: Feature[]): Release[] {
  const groups = new Map<string, Feature[]>();
  for (const feature of features) {
    const date = featureDate(feature);
    const key = feature.releaseId ? `${feature.year}:explicit:${feature.stream}:${feature.releaseId}` : date && feature.version ? `${feature.year}:${feature.version}:${date}:${feature.platform}` : `unassigned:${feature.id}`;
    groups.set(key, [...(groups.get(key) || []), feature]);
  }
  return [...groups].map(([id, items]): Release => {
    const dates = [...new Set(items.map(featureDate).filter((d): d is string => !!d))].sort();
    const platforms = new Set(items.map(f => f.platform));
    return {
      id, name: items[0].releaseId || items[0].version || (dates.length ? `Release ${formatDate(dates.at(-1))}` : 'ยังไม่จัดรอบ release'),
      date: dates.at(-1) || null, features: items, images: [...new Set(items.map(f => f.image).filter(Boolean))],
      status: rollupStatus(items), stream: items.every(f => f.stream === items[0].stream) ? items[0].stream : '',
      explicit: !!items[0].releaseId, platform: platforms.size === 1 ? items[0].platform : platforms.has('shared') || (platforms.has('web') && platforms.has('app')) ? 'shared' : 'unknown',
    };
  }).sort((a, b) => (a.date || `${a.features[0].year}-12-31`).localeCompare(b.date || `${b.features[0].year}-12-31`) || a.features[0].sourceRow - b.features[0].sourceRow);
}
export function canStartMerge(release: Release, all: Release[]): { allowed: boolean | null; reason: string } {
  if (!release.explicit || !release.stream) return { allowed: null, reason: 'ยังไม่ระบุรอบ release และ stream ในชีต' };
  const chain = all.filter(r => r.explicit && r.stream === release.stream && r.features[0].year === release.features[0].year).sort((a, b) => a.features[0].sourceRow - b.features[0].sourceRow);
  const index = chain.findIndex(r => r.id === release.id);
  if (index <= 0) return { allowed: null, reason: 'ยังไม่มีข้อมูลรอบก่อนหน้าให้ตรวจสอบ' };
  const previous = chain[index - 1];
  if (previous.status === 'done' || previous.status === 'deployed') return { allowed: true, reason: `${previous.name} ${STATUS_LABEL[previous.status]} แล้ว · เริ่ม merge รอบนี้ได้` };
  return { allowed: false, reason: `รอ ${previous.name} เป็น Done ก่อน` };
}
export function selectFeatures(features: Feature[], filters: { view: 'current' | 'history' | 'all'; today: string; platform?: string; query?: string; year?: number }): Feature[] {
  return features.filter(feature => {
    const history = feature.status === 'deployed';
    if (filters.view === 'history' && !history) return false;
    if (filters.view === 'current' && history) return false;
    if (filters.year && feature.year !== filters.year) return false;
    if (filters.platform && filters.platform !== 'all' && feature.platform !== filters.platform && feature.platform !== 'shared') return false;
    const query = filters.query?.toLowerCase().trim();
    return !query || [feature.title, feature.version, feature.releaseId, feature.owner, feature.image].join(' ').toLowerCase().includes(query);
  }).sort((a, b) => {
    const phase = (f: Feature) => {
      const starts = f.stages.map(s => s.start);
      const ends = f.stages.map(s => s.end);
      if (!starts.length) return 3;
      if (Math.min(...starts.map(Date.parse)) <= Date.parse(filters.today) && Math.max(...ends.map(Date.parse)) >= Date.parse(filters.today)) return 0;
      return ends.some(d => d >= filters.today) ? 1 : 2;
    };
    return phase(a) - phase(b) || (featureDate(a) || `${a.year}-12-31`).localeCompare(featureDate(b) || `${b.year}-12-31`) || a.sourceRow - b.sourceRow;
  });
}
export function sourceLink(feature: Feature): string {
  return `${SOURCE_URL}?gid=${feature.sheetId}#gid=${feature.sheetId}&range=A${feature.sourceRow}`;
}
