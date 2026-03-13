import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import {
  getSessionUser,
  canAccessCustomer,
  isValidPaymentAmount,
  isValidDate,
  sanitizeString,
  parseId,
} from '@/lib/security'

export async function POST(req: Request, { params }: { params: { id: string } }) {
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

  const { treatmentName, paymentAmount, paymentDate } = await req.json()

  // 필수값 검증
  if (!treatmentName || typeof treatmentName !== 'string' || treatmentName.trim() === '') {
    return NextResponse.json({ error: '시술명은 필수입니다.' }, { status: 400 })
  }

  const amount = Number(paymentAmount)
  if (!paymentAmount || !isValidPaymentAmount(amount)) {
    return NextResponse.json({ error: '유효한 결제 금액이 필요합니다. (1원 ~ 1억원)' }, { status: 400 })
  }

  // 날짜 형식 검증
  let parsedDate: string | null = null
  if (paymentDate) {
    if (!isValidDate(paymentDate)) {
      return NextResponse.json({ error: '유효하지 않은 날짜 형식입니다.' }, { status: 400 })
    }
    parsedDate = new Date(paymentDate).toISOString()
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('payments')
    .insert({
      customer_id: customerId,
      clinic_id: accessCheck.clinicId,
      treatment_name: sanitizeString(treatmentName, 200),
      payment_amount: amount,
      payment_date: parsedDate || new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
