import { NextRequest, NextResponse } from 'next/server';
import { getTimeline } from '@/lib/source';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getTimeline(request.nextUrl.searchParams.get('refresh') === '1'), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'อ่านข้อมูล Timeline ไม่สำเร็จ กรุณาลองใหม่หรือตรวจสิทธิ์เข้าถึงชีต' }, { status: 503 });
  }
}
