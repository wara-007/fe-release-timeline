import type { Status } from './types';

const STATUS_VALUES: Status[] = ['unknown', 'planned', 'merging', 'testing', 'done', 'deployed'];
export type TeamStatus = 'unknown' | 'not_started' | 'in_progress' | 'done' | 'testing' | 'passed' | 'failed' | 'blocked';
export type ReleaseStatusRecord = { releaseStatus:Status; beStatus:TeamStatus; feStatus:TeamStatus; qaStatus:TeamStatus };
const TEAM_STATUS_VALUES:TeamStatus[]=['unknown','not_started','in_progress','done','testing','passed','failed','blocked'];
export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && STATUS_VALUES.includes(value as Status);
}
export function isTeamStatus(value:unknown):value is TeamStatus{return typeof value==='string'&&TEAM_STATUS_VALUES.includes(value as TeamStatus);}

type StatusRow = { release_id?: unknown; status?: unknown; be_status?:unknown; fe_status?:unknown; qa_status?:unknown };

/** Supabase Data API adapter. Called only by the Next.js server route. */
export function createReleaseStatusStore(url: string, key: string, fetcher: typeof fetch = fetch) {
  const base = new URL('/rest/v1/fe_release_statuses', url);
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  return {
    async read(): Promise<Record<string, ReleaseStatusRecord>> {
      const statuses: Record<string, ReleaseStatusRecord> = Object.create(null);
      const endpoint = new URL(base);
      endpoint.search = new URLSearchParams({ select:'release_id,status,be_status,fe_status,qa_status', order:'release_id.asc' }).toString();
      const response = await fetcher(endpoint.toString(), { headers, cache:'no-store', signal:AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('อ่านสถานะ Release จาก Supabase ไม่สำเร็จ');
      const rows: StatusRow[] = await response.json();
      if (!Array.isArray(rows)) throw new Error('ข้อมูลสถานะ Release ไม่ถูกต้อง');
      for (const row of rows) {
        if (typeof row.release_id !== 'string' || !isStatus(row.status) || !isTeamStatus(row.be_status) || !isTeamStatus(row.fe_status) || !isTeamStatus(row.qa_status)) throw new Error('ข้อมูลสถานะ Release ไม่ถูกต้อง');
        statuses[row.release_id] = {releaseStatus:row.status,beStatus:row.be_status,feStatus:row.fe_status,qaStatus:row.qa_status};
      }
      return statuses;
    },
    async save(releaseId: string, value:ReleaseStatusRecord): Promise<void> {
      if (!releaseId.trim() || releaseId.length > 300 || releaseId.includes('\0') || !isStatus(value.releaseStatus) || !isTeamStatus(value.beStatus) || !isTeamStatus(value.feStatus) || !isTeamStatus(value.qaStatus)) throw new Error('ข้อมูลสถานะ Release ไม่ถูกต้อง');
      const endpoint = new URL(base);
      endpoint.searchParams.set('on_conflict', 'release_id');
      const response = await fetcher(endpoint.toString(), {
        method:'POST',
        headers:{...headers, Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify({ release_id:releaseId.trim(), status:value.releaseStatus, be_status:value.beStatus, fe_status:value.feStatus, qa_status:value.qaStatus, updated_at:new Date().toISOString() }),
        cache:'no-store',
        signal:AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('บันทึกสถานะ Release ลง Supabase ไม่สำเร็จ');
    },
  };
}

export function getReleaseStatusStore() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase');
  return createReleaseStatusStore(url, key);
}
