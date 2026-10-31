import type { BuildData, BuildRecord } from './build-types';

type BuildRow = { record_id?: unknown; image?: unknown; comment?: unknown; updated_at?: unknown };

function toRecord(row: BuildRow): BuildRecord {
  if (typeof row.record_id !== 'string' || typeof row.image !== 'string' || typeof row.comment !== 'string' || typeof row.updated_at !== 'string') throw new Error('ข้อมูลจากฐานข้อมูลไม่ถูกต้อง');
  return { recordId: row.record_id, image: row.image, comment: row.comment, updatedAt: row.updated_at };
}

/** Supabase Data API adapter. Called only by the Next.js server route. */
export function createBuildStore(url: string, key: string, fetcher: typeof fetch = fetch) {
  const base = new URL('/rest/v1/fe_release_builds', url);
  const historyBase = new URL('/rest/v1/fe_release_build_history', url);
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  return {
    async read(): Promise<BuildData> {
      const latest: Record<string, BuildRecord> = Object.create(null);
      const history: Record<string, BuildRecord[]> = Object.create(null);
      const limit = 500;
      for (let offset = 0; ; offset += limit) {
        const endpoint = new URL(base);
        endpoint.search = new URLSearchParams({select:'record_id,image,comment,updated_at',order:'record_id.asc',limit:String(limit),offset:String(offset)}).toString();
        const response = await fetcher(endpoint.toString(), { headers, cache:'no-store', signal:AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('อ่านข้อมูล Image / Build จาก Supabase ไม่สำเร็จ');
        const rows: BuildRow[] = await response.json();
        if (!Array.isArray(rows)) throw new Error('ข้อมูลจากฐานข้อมูลไม่ถูกต้อง');
        for (const row of rows) { const record = toRecord(row); latest[record.recordId] = record; }
        if (rows.length < limit) break;
      }
      for (let offset = 0; ; offset += limit) {
        const endpoint = new URL(historyBase);
        endpoint.search = new URLSearchParams({select:'record_id,image,comment,updated_at',order:'updated_at.desc',limit:String(limit),offset:String(offset)}).toString();
        const response = await fetcher(endpoint.toString(), { headers, cache:'no-store', signal:AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('อ่านประวัติ Image / Build จาก Supabase ไม่สำเร็จ');
        const rows: BuildRow[] = await response.json();
        if (!Array.isArray(rows)) throw new Error('ข้อมูลจากฐานข้อมูลไม่ถูกต้อง');
        for (const row of rows) { const record = toRecord(row); (history[record.recordId] ||= []).push(record); }
        if (rows.length < limit) break;
      }
      return { latest, history };
    },
    async save(id: string, image: string, comment: string): Promise<BuildRecord> {
      if (typeof id !== 'string' || !id.trim() || id.length > 300 || id.includes('\0') || typeof image !== 'string' || !image.trim() || image.length > 500 || image.includes('\0') || typeof comment !== 'string' || comment.length > 1000 || comment.includes('\0')) throw new Error('ข้อมูล Image / Build ไม่ถูกต้อง');
      const endpoint = new URL(base);
      endpoint.searchParams.set('on_conflict','record_id');
      const response = await fetcher(endpoint.toString(), { method:'POST', headers:{...headers, Prefer:'resolution=merge-duplicates,return=representation'}, body:JSON.stringify({record_id:id.trim(),image:image.trim(),comment:comment.trim(),updated_at:new Date().toISOString()}), cache:'no-store', signal:AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('บันทึก Image / Build ลง Supabase ไม่สำเร็จ');
      const rows: BuildRow[] = await response.json();
      if (!Array.isArray(rows) || rows.length !== 1) throw new Error('ข้อมูลจากฐานข้อมูลไม่ถูกต้อง');
      return toRecord(rows[0]);
    },
  };
}
export function getBuildStore() {
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase');
  return createBuildStore(url,key);
}
