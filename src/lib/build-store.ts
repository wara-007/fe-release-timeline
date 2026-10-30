/** Supabase Data API adapter. Called only by the Next.js server route. */
export function createBuildStore(url: string, key: string, fetcher: typeof fetch = fetch) {
  const base = new URL('/rest/v1/fe_release_builds', url);
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  return {
    async read(): Promise<Record<string, string>> {
      const images: Record<string, string> = Object.create(null);
      const limit = 500;
      for (let offset = 0; ; offset += limit) {
        const endpoint = new URL(base);
        endpoint.search = new URLSearchParams({select:'record_id,image',order:'record_id.asc',limit:String(limit),offset:String(offset)}).toString();
        const response = await fetcher(endpoint.toString(), { headers, cache:'no-store', signal:AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('อ่านข้อมูล Image / Build จาก Supabase ไม่สำเร็จ');
        const rows: unknown = await response.json();
        if (!Array.isArray(rows)) throw new Error('ข้อมูลจากฐานข้อมูลไม่ถูกต้อง');
        for (const row of rows) {
          if (typeof row?.record_id !== 'string' || typeof row?.image !== 'string') throw new Error('ข้อมูลจากฐานข้อมูลไม่ถูกต้อง');
          images[row.record_id] = row.image;
        }
        if (rows.length < limit) break;
      }
      return images;
    },
    async save(id: string, image: string): Promise<void> {
      if (typeof id !== 'string' || !id.trim() || id.length > 300 || id.includes('\0') || typeof image !== 'string' || image.length > 500 || image.includes('\0')) throw new Error('ข้อมูล Image / Build ไม่ถูกต้อง');
      const endpoint = new URL(base);
      endpoint.searchParams.set('on_conflict','record_id');
      const response = await fetcher(endpoint.toString(), { method:'POST', headers:{...headers, Prefer:'resolution=merge-duplicates,return=minimal'}, body:JSON.stringify({record_id:id,image:image.trim(),updated_at:new Date().toISOString()}), cache:'no-store', signal:AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('บันทึก Image / Build ลง Supabase ไม่สำเร็จ');
    },
  };
}
export function getBuildStore() {
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase');
  return createBuildStore(url,key);
}
