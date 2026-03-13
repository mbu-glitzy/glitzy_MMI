import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { getClinicId } from '@/lib/session'
import {
  getSessionUser,
  canModifyBooking,
  isValidBookingStatus,
  isValidDate,
  parseId,
  sanitizeString,
} from '@/lib/security'

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serverSupabase()
  const clinicId = await getClinicId(req.url)

  let query = supabase
    .from('bookings')
    .select('*, customer:customers(id, name, phone_number, first_source, consultations(*), payments(*))')
    .order('booking_datetime', { ascending: false })

  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// 예약 정보 수정 (상태, 일시, 메모)
export async function PUT(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, status, notes, booking_datetime } = body

  // ID 파싱 (문자열/숫자 모두 허용)
  const bookingId = parseId(id)
  if (!bookingId) {
    return NextResponse.json({ error: '유효한 예약 ID가 필요합니다.' }, { status: 400 })
  }

  // 상태값 검증
  if (status !== undefined && !isValidBookingStatus(status)) {
    return NextResponse.json({ error: '유효하지 않은 예약 상태입니다.' }, { status: 400 })
  }

  // 날짜 검증
  if (booking_datetime !== undefined && booking_datetime !== null && booking_datetime !== '') {
    if (!isValidDate(booking_datetime)) {
      return NextResponse.json({ error: '유효하지 않은 날짜 형식입니다.' }, { status: 400 })
    }
  }

  // 권한 검증: 해당 booking의 clinic_id에 접근 가능한지 확인
  const accessCheck = await canModifyBooking(bookingId, user)
  if (!accessCheck.allowed) {
    return NextResponse.json({ error: accessCheck.error }, { status: 403 })
  }

  const supabase = serverSupabase()
  const update: Record<string, unknown> = {}
  if (status !== undefined) update.status = status
  if (notes !== undefined) update.notes = sanitizeString(notes, 1000)
  if (booking_datetime !== undefined) update.booking_datetime = booking_datetime || null

  const { data, error } = await supabase
    .from('bookings')
    .update(update)
    .eq('id', bookingId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// 예약 상태만 빠르게 변경
export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, status } = body

  // ID 파싱 (문자열/숫자 모두 허용)
  const bookingId = parseId(id)
  if (!bookingId) {
    return NextResponse.json({ error: '유효한 예약 ID가 필요합니다.' }, { status: 400 })
  }

  if (!status || !isValidBookingStatus(status)) {
    return NextResponse.json({ error: '유효하지 않은 예약 상태입니다.' }, { status: 400 })
  }

  // 권한 검증
  const accessCheck = await canModifyBooking(bookingId, user)
  if (!accessCheck.allowed) {
    return NextResponse.json({ error: accessCheck.error }, { status: 403 })
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
