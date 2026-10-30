import { NextRequest, NextResponse } from 'next/server';
import { getBuildStore } from '@/lib/build-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json(await getBuildStore().read(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'อ่านข้อมูล Image / Build จาก Supabase ไม่สำเร็จ' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get('origin') || '');
    // Next.js can normalize the URL to localhost while preserving the real Host.
    const host = request.headers.get('host') || request.nextUrl.host;
    sameOrigin = origin.host === host.toLowerCase() && origin.protocol === request.nextUrl.protocol;
  } catch { /* Missing or malformed Origin is rejected. */ }
  if (!sameOrigin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 4096) return NextResponse.json({ error:'ข้อมูลใหญ่เกินขอบเขต' }, { status:413 });
    let body;
    try { body = JSON.parse(text); } catch { return NextResponse.json({error:'JSON ไม่ถูกต้อง'}, {status:400}); }
    if (!body || typeof body.id !== 'string' || !body.id.trim() || body.id.length > 300 || body.id.includes('\0') || typeof body.image !== 'string' || body.image.length > 500 || body.image.includes('\0')) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    await getBuildStore().save(body.id,body.image);
    return NextResponse.json({ saved: true });
  } catch { return NextResponse.json({ error: 'บันทึกลง Supabase ไม่สำเร็จ กรุณาลองใหม่' }, { status: 503 }); }
}
