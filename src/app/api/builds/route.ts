import { NextRequest, NextResponse } from 'next/server';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const directory = process.env.RELEASE_DATA_DIRECTORY || path.join(process.cwd(), '.release-data');
const file = path.join(directory, 'builds.json');
let queue = Promise.resolve();
async function read(): Promise<Record<string, string>> {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
}
export async function GET() {
  try { return NextResponse.json(await read(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'อ่านข้อมูลที่บันทึกไม่ได้' }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body.id !== 'string' || !body.id || body.id.length > 300 || typeof body.image !== 'string' || body.image.length > 500) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const operation = queue.then(async () => {
      const values = await read();
      values[body.id] = body.image.trim();
      await mkdir(directory, { recursive: true });
      const temp = path.join(directory, 'builds.tmp');
      await writeFile(temp, JSON.stringify(values), { mode: 0o600 });
      await rename(temp, file);
    });
    queue = operation.catch(() => {});
    await operation;
    return NextResponse.json({ saved: true });
  } catch { return NextResponse.json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 }); }
}
