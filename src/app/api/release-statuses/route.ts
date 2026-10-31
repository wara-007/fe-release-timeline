import { NextRequest, NextResponse } from 'next/server';
import { getReleaseStatusStore, isStatus, isTeamStatus } from '@/lib/release-status-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json(await getReleaseStatusStore().read(), { headers:{ 'Cache-Control':'no-store' } }); }
  catch { return NextResponse.json({ error:'อ่านสถานะ Release จาก Supabase ไม่สำเร็จ' }, { status:503 }); }
}

export async function POST(request: NextRequest) {
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get('origin') || '');
    const host = request.headers.get('host') || request.nextUrl.host;
    sameOrigin = origin.host === host.toLowerCase() && origin.protocol === request.nextUrl.protocol;
  } catch { /* Missing or malformed Origin is rejected. */ }
  if (!sameOrigin) return NextResponse.json({ error:'Invalid origin' }, { status:403 });
  try {
    const text = await request.text();
    if (text.length > 1024) return NextResponse.json({ error:'ข้อมูลใหญ่เกินขอบเขต' }, { status:413 });
    let body;
    try { body = JSON.parse(text); } catch { return NextResponse.json({ error:'JSON ไม่ถูกต้อง' }, { status:400 }); }
    if (!body || typeof body.releaseId !== 'string' || !body.releaseId.trim() || body.releaseId.length > 300 || body.releaseId.includes('\0') || !isStatus(body.releaseStatus) || !isTeamStatus(body.beStatus) || !isTeamStatus(body.feStatus) || !isTeamStatus(body.qaStatus)) return NextResponse.json({ error:'ข้อมูลไม่ถูกต้อง' }, { status:400 });
    await getReleaseStatusStore().save(body.releaseId, {releaseStatus:body.releaseStatus,beStatus:body.beStatus,feStatus:body.feStatus,qaStatus:body.qaStatus});
    return NextResponse.json({ saved:true });
  } catch { return NextResponse.json({ error:'บันทึกสถานะ Release ลง Supabase ไม่สำเร็จ กรุณาลองใหม่' }, { status:503 }); }
}
