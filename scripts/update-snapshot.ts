import { writeFile } from 'node:fs/promises';
import { readWorkbook } from '../src/lib/workbook';

// Optional maintenance fallback only. Runtime always tries a live read first.
const response = await fetch('https://docs.google.com/spreadsheets/d/19Vy1EFRNE0H1crAoH_HivCDScOHRhnCAfKGDZpoArfc/export?format=xlsx', { signal: AbortSignal.timeout(30000), cache: 'no-store' });
if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('อ่านต้นฉบับไม่สำเร็จ ไม่เปลี่ยน snapshot');
const bytes = await response.arrayBuffer();
if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกินขอบเขต');
const sheets = await readWorkbook(Buffer.from(bytes));
const capturedAt = new Date().toISOString();
await writeFile('src/data/sheet-snapshot.json', JSON.stringify({ capturedAt, sheets }));
console.log(`Saved real-source fallback: ${sheets.length} yearly tabs at ${capturedAt}`);
