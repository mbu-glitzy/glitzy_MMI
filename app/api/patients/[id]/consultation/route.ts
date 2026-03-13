import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import {
  getSessionUser,
  canAccessCustomer,
  isValidConsultationStatus,
  isValidDate,
  sanitizeString,
  parseId,
} from '@/lib/security'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = parseId(params.id)
  if (!customerId) {
    return NextResponse.json({ error: '유효한 고객 ID가 필요합니다.' }, { status: 400 })
  }

  // 권한 검증: 해당 고객의 clinic_id에 접근 가능한지 확인
  const accessCheck = await canAccessCustomer(customerId, user)
  if (!accessCheck.allowed) {
    return NextResponse.json({ error: accessCheck.error }, { status: 403 })
  }

  const { status, notes, consultationDate } = await req.json()

  // 상태값 검증
  if (status !== undefined && status !== null && status !== '') {
    if (!isValidConsultationStatus(status)) {
      return NextResponse.json({ error: '유효하지 않은 상담 상태입니다.' }, { status: 400 })
    }
  }

  // 날짜 검증
  if (consultationDate !== undefined && consultationDate !== null && consultationDate !== '') {
    if (!isValidDate(consultationDate)) {
      return NextResponse.json({ error: '유효하지 않은 날짜 형식입니다.' }, { status: 400 })
    }
  }

  const supabase = serverSupabase()

  const { data: existing } = await supabase
    .from('consultations')
    .select('id')
    .eq('customer_id', customerId)
    .maybeSingle()

  // notes 처리: undefined가 아니면 sanitize 적용
  const sanitizedNotes = notes !== undefined ? sanitizeString(notes, 1000) : undefined

  let result
  if (existing) {
    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (sanitizedNotes !== undefined) updateData.notes = sanitizedNotes
    if (consultationDate !== undefined) updateData.consultation_date = consultationDate || null

    result = await supabase
      .from('consultations')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    result = await supabase
      .from('consultations')
      .insert({
        customer_id: customerId,
        clinic_id: accessCheck.clinicId,
        status: status || null,
        notes: sanitizedNotes || null,
        consultation_date: consultationDate || null,
      })
      .select()
      .single()
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json(result.data)
}
