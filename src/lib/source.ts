import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildReleases, parseSheets } from './timeline';
import { readWorkbook } from './workbook';
import type { GridSheet, TimelineData } from './types';

const ID = process.env.GOOGLE_SPREADSHEET_ID || '19Vy1EFRNE0H1crAoH_HivCDScOHRhnCAfKGDZpoArfc';
const URL = `https://docs.google.com/spreadsheets/d/${ID}/edit`;
let cache: TimelineData | undefined;
let inFlight: Promise<TimelineData> | undefined;
let attemptedAt = 0;

async function accessToken(): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) return null;
  const now = Math.floor(Date.now() / 1000);
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const payload = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(payload).sign(key.replace(/\\n/g, '\n'), 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${payload}.${signature}` }), signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error('service account อ่านชีตไม่ได้ กรุณาตรวจสิทธิ์ read-only');
  const data = await response.json();
  if (!data.access_token) throw new Error('ไม่ได้รับสิทธิ์อ่านชีต');
  return data.access_token;
}
async function fetchLive(): Promise<TimelineData> {
  if (!/^[\w-]+$/.test(ID)) throw new Error('Spreadsheet ID ไม่ถูกต้อง');
  const token = await accessToken();
  const url = token ? `https://www.googleapis.com/drive/v3/files/${ID}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet` : `https://docs.google.com/spreadsheets/d/${ID}/export?format=xlsx`;
  const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(25000), cache: 'no-store' });
  if (!response.ok) throw new Error(`อ่าน Google Sheet ไม่สำเร็จ (${response.status})`);
  const type = response.headers.get('content-type') || '';
  if (type.includes('text/html')) throw new Error('Google Sheet ต้องการสิทธิ์เข้าถึง');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกินขอบเขต 25 MB');
  const sheets = await readWorkbook(Buffer.from(bytes));
  const features = parseSheets(sheets);
  if (!features.length) throw new Error('รูปแบบข้อมูลเปลี่ยน ไม่พบรายการงาน FE');
  const now = new Date().toISOString();
  return { features, releases: buildReleases(features), source: { mode: 'live', fetchedAt: now, checkedAt: now, url: URL } };
}
export async function getTimeline(force = false): Promise<TimelineData> {
  if (cache && Date.now() - Date.parse(cache.source.fetchedAt) < (force ? 10000 : 60000) && cache.source.mode === 'live') return cache;
  if (inFlight) return inFlight;
  // A failure is retried on the next refresh, but not on every concurrent request.
  if (cache && Date.now() - attemptedAt < 10000) return cache;
  attemptedAt = Date.now();
  inFlight = (async () => {
    try { cache = await fetchLive(); }
    catch {
      const checkedAt = new Date().toISOString();
      if (cache) cache = { ...cache, source: { ...cache.source, mode: 'cached', checkedAt, warning: 'อ่านชีตครั้งล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลที่อ่านสำเร็จครั้งก่อน' } };
      else {
        const snapshot = JSON.parse(await readFile(process.env.TIMELINE_SNAPSHOT_PATH || path.join(process.cwd(), 'src/data/sheet-snapshot.json'), 'utf8')) as { capturedAt: string; sheets: GridSheet[] };
        if (ID !== '19Vy1EFRNE0H1crAoH_HivCDScOHRhnCAfKGDZpoArfc') throw new Error('อ่านชีตที่ตั้งค่าไว้ไม่ได้ และไม่มีข้อมูลสำรองของชีตนี้');
        const features = parseSheets(snapshot.sheets);
        cache = { features, releases: buildReleases(features), source: { mode: 'snapshot', fetchedAt: snapshot.capturedAt, checkedAt, url: URL, warning: 'ยังเชื่อมชีตสดไม่ได้ กำลังแสดงสำเนาข้อมูลจริงตามเวลาที่ระบุ' } };
      }
    }
    return cache!;
  })().finally(() => { inFlight = undefined; });
  return inFlight;
}
