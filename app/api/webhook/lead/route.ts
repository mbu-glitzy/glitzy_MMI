import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { qstash } from '@/lib/qstash'
import {
  isValidPhoneNumber,
  isValidUrl,
  normalizePhoneNumber,
  sanitizeString,
  parseId,
} from '@/lib/security'

export async function POST(req: Request) {
  let body: {
    name?: string
    phoneNumber?: string
    campaignId?: string
    source?: string
    inflowUrl?: string
    clinic_id?: number | string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { name, phoneNumber, campaignId, source, inflowUrl, clinic_id } = body

  // 전화번호 필수 검증
  if (!phoneNumber) {
    return NextResponse.json({ error: '전화번호는 필수입니다.' }, { status: 400 })
  }

  // 전화번호 형식 검증
  if (!isValidPhoneNumber(phoneNumber)) {
    return NextResponse.json(
      { error: '유효한 전화번호 형식이 아닙니다. (예: 010-1234-5678 또는 01012345678)' },
      { status: 400 }
    )
  }

  // URL 검증 (제공된 경우)
  if (inflowUrl && !isValidUrl(inflowUrl)) {
    return NextResponse.json({ error: '유효하지 않은 URL 형식입니다.' }, { status: 400 })
  }

  // clinic_id 검증 (제공된 경우)
  let validClinicId: number | null = null
  if (clinic_id !== undefined && clinic_id !== null && clinic_id !== '') {
    validClinicId = parseId(clinic_id)
    if (validClinicId === null) {
      return NextResponse.json({ error: '유효하지 않은 clinic_id입니다.' }, { status: 400 })
    }
  }

  // 전화번호 정규화 (하이픈 추가)
  const normalizedPhone = normalizePhoneNumber(phoneNumber)

  // 입력값 sanitize (XSS 방지)
  const sanitizedName = name ? sanitizeString(name, 50) : undefined
  const sanitizedCampaignId = campaignId ? sanitizeString(campaignId, 100) : undefined
  const sanitizedSource = source ? sanitizeString(source, 50) : 'Unknown'

  const supabase = serverSupabase()

  try {
    // 1. 고객 조회 (전화번호 기준)
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .maybeSingle()

    let customer = existingCustomer
    if (!customer) {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          phone_number: normalizedPhone,
          name: sanitizedName,
          first_source: sanitizedSource,
          first_campaign_id: sanitizedCampaignId,
          clinic_id: validClinicId,
        })
        .select()
        .single()
      if (error) throw error
      customer = newCustomer
    }

    // 2. 리드 기록 생성
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        customer_id: customer.id,
        clinic_id: customer.clinic_id || validClinicId,
        campaign_id: sanitizedCampaignId,
        inflow_url: inflowUrl ? sanitizeString(inflowUrl, 500) : null,
        chatbot_sent: false,
      })
      .select()
      .single()
    if (leadError) throw leadError

    // 3. QStash로 5분 후 챗봇 발송 스케줄
    if (process.env.QSTASH_TOKEN) {
      await qstash.publishJSON({
        url: `${process.env.NEXTAUTH_URL}/api/qstash/chatbot`,
        body: { leadId: lead.id, phoneNumber: normalizedPhone, name: sanitizedName },
        delay: 300,
      })
    }

    return NextResponse.json({
      success: true,
      message: '리드가 등록되고 5분 내 챗봇 발송 스케줄이 설정되었습니다.',
      leadId: lead.id,
      customerId: customer.id,
    })
  } catch (err: unknown) {
    console.error('[Webhook Error]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
