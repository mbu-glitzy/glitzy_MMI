import { NextResponse } from 'next/server'
import { syncPressForClinic } from '@/lib/services/pressSync'

export const maxDuration = 60

// Vercel Cron이 매일 오전 9시 KST (0:00 UTC)에 호출
export async function GET(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const inserted = await syncPressForClinic(null) // null = 전체 병원
  console.log(`[CronJob] 언론보도 자동 수집 완료 — ${inserted}건`)
  return NextResponse.json({ success: true, inserted })
}
