import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncPressForClinic } from '@/lib/services/pressSync'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinic_id') ? Number(url.searchParams.get('clinic_id')) : null

  const inserted = await syncPressForClinic(clinicId)
  return NextResponse.json({ inserted })
}
