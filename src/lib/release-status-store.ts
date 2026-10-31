import type { Status } from './types';

const STATUS_VALUES: Status[] = ['unknown', 'planned', 'merging', 'testing', 'done', 'deployed'];
export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && STATUS_VALUES.includes(value as Status);
}

type StatusRow = { release_id?: unknown; status?: unknown };

/** Supabase Data API adapter. Called only by the Next.js server route. */
export function createReleaseStatusStore(url: string, key: string, fetcher: typeof fetch = fetch) {
  const base = new URL('/rest/v1/fe_release_statuses', url);
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  return {
    async read(): Promise<Record<string, Status>> {
      const statuses: Record<string, Status> = Object.create(null);
      const endpoint = new URL(base);
      endpoint.search = new URLSearchParams({ select:'release_id,status', order:'release_id.asc' }).toString();
      const response = await fetcher(endpoint.toString(), { headers, cache:'no-store', signal:AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('อ่านสถานะ Release จาก Supabase ไม่สำเร็จ');
      const rows: StatusRow[] = await response.json();
      if (!Array.isArray(rows)) throw new Error('ข้อมูลสถานะ Release ไม่ถูกต้อง');
      for (const row of rows) {
        if (typeof row.release_id !== 'string' || !isStatus(row.status)) throw new Error('ข้อมูลสถานะ Release ไม่ถูกต้อง');
        statuses[row.release_id] = row.status;
      }
      return statuses;
    },
    async save(releaseId: string, status: Status): Promise<void> {
      if (!releaseId.trim() || releaseId.length > 300 || releaseId.includes('\0') || !isStatus(status)) throw new Error('ข้อมูลสถานะ Release ไม่ถูกต้อง');
      const endpoint = new URL(base);
      endpoint.searchParams.set('on_conflict', 'release_id');
      const response = await fetcher(endpoint.toString(), {
        method:'POST',
        headers:{...headers, Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify({ release_id:releaseId.trim(), status, updated_at:new Date().toISOString() }),
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
