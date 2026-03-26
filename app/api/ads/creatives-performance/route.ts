import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'
import { normalizeChannel } from '@/lib/channel'

const logger = createLogger('CreativesPerformance')

/**
 * 소재별 성과 분석 API
 * utm_content 기반으로 리드/결제/매출 + 광고 지표(spend/clicks/impressions) 통합
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess({ creatives: [] })
  }

  try {
    // 1) leads — utm_content가 있는 리드
    let leadsQuery = supabase
      .from('leads')
      .select('id, customer_id, utm_content, created_at')
      .not('utm_content', 'is', null)

    const filteredLeads = applyClinicFilter(leadsQuery, { clinicId, assignedClinicIds })
    if (!filteredLeads) return apiSuccess({ creatives: [] })
    leadsQuery = filteredLeads

    if (startDate) leadsQuery = leadsQuery.gte('created_at', startDate)
    if (endDate) leadsQuery = leadsQuery.lte('created_at', endDate)

    // 2) ad_creatives — 소재 메타데이터
    let creativesQuery = supabase
      .from('ad_creatives')
      .select('id, name, utm_content, platform, landing_page_id, file_name, file_type')

    const filteredCreatives = applyClinicFilter(creativesQuery, { clinicId, assignedClinicIds })
    if (filteredCreatives) creativesQuery = filteredCreatives

    // 3) payments — 리드 기준 귀속 (기간 필터 없음)
    let paymentsQuery = supabase
      .from('payments')
      .select('id, payment_amount, customer_id')

    const filteredPayments = applyClinicFilter(paymentsQuery, { clinicId, assignedClinicIds })
    if (filteredPayments) paymentsQuery = filteredPayments

    // 4) ad_stats — utm_content별 광고 지표
    let adStatsQuery = supabase
      .from('ad_stats')
      .select('utm_content, spend_amount, clicks, impressions')
      .not('utm_content', 'is', null)

    const filteredAdStats = applyClinicFilter(adStatsQuery, { clinicId, assignedClinicIds })
    if (filteredAdStats) adStatsQuery = filteredAdStats
    if (startDate) adStatsQuery = adStatsQuery.gte('stat_date', startDate)
    if (endDate) adStatsQuery = adStatsQuery.lte('stat_date', endDate)

    // 병렬 쿼리 실행
    const [leadsRes, creativesRes, paymentsRes, adStatsRes] = await Promise.all([
      leadsQuery,
      creativesQuery,
      paymentsQuery,
      adStatsQuery,
    ])

    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clinicId })
      return apiError('리드 데이터 조회 실패', 500)
    }
    if (creativesRes.error) {
      logger.warn('소재 메타데이터 조회 실패', { clinicId, error: creativesRes.error.message })
    }
    if (paymentsRes.error) {
      logger.warn('결제 데이터 조회 실패', { clinicId, error: paymentsRes.error.message })
    }
    if (adStatsRes.error) {
      logger.warn('ad_stats 조회 실패', { clinicId, error: adStatsRes.error.message })
    }

    const leads = leadsRes.data || []
    const creatives = creativesRes.data || []
    const payments = paymentsRes.data || []
    const adStatsData = adStatsRes.data || []

    // utm_content → 소재 메타데이터 매핑
    const creativeMap = new Map<string, { name: string; platform: string | null; file_name: string | null; file_type: string | null }>()
    for (const c of creatives) {
      creativeMap.set(c.utm_content.toLowerCase(), {
        name: c.name,
        platform: c.platform,
        file_name: c.file_name || null,
        file_type: c.file_type || null,
      })
    }

    // utm_content별 리드 집계
    const contentLeadMap = new Map<string, { leadIds: Set<number>; customerIds: Set<number> }>()
    for (const lead of leads) {
      const raw = lead.utm_content as string
      if (!raw) continue
      const content = raw.toLowerCase()
      if (!contentLeadMap.has(content)) {
        contentLeadMap.set(content, { leadIds: new Set(), customerIds: new Set() })
      }
      const entry = contentLeadMap.get(content)!
      entry.leadIds.add(lead.id)
      if (lead.customer_id) entry.customerIds.add(lead.customer_id)
    }

    // customer_id → utm_content 매핑 (첫 리드 기준)
    const customerUtmContentMap = new Map<number, string>()
    for (const lead of leads) {
      if (lead.customer_id && lead.utm_content) {
        if (!customerUtmContentMap.has(lead.customer_id)) {
          customerUtmContentMap.set(lead.customer_id, (lead.utm_content as string).toLowerCase())
        }
      }
    }

    // utm_content별 결제 집계
    const contentPaymentMap = new Map<string, { payingCustomers: Set<number>; revenue: number }>()
    for (const payment of payments) {
      const customerId = payment.customer_id
      if (!customerId) continue
      const utmContent = customerUtmContentMap.get(customerId)
      if (!utmContent) continue
      if (!contentPaymentMap.has(utmContent)) {
        contentPaymentMap.set(utmContent, { payingCustomers: new Set(), revenue: 0 })
      }
      const entry = contentPaymentMap.get(utmContent)!
      entry.payingCustomers.add(customerId)
      entry.revenue += Number(payment.payment_amount) || 0
    }

    // utm_content별 광고 지표 집계
    const adStatsMap = new Map<string, { spend: number; clicks: number; impressions: number }>()
    for (const row of adStatsData) {
      const key = (row.utm_content as string).toLowerCase()
      const existing = adStatsMap.get(key) || { spend: 0, clicks: 0, impressions: 0 }
      existing.spend += Number(row.spend_amount) || 0
      existing.clicks += row.clicks || 0
      existing.impressions += row.impressions || 0
      adStatsMap.set(key, existing)
    }

    // 최종 조립: leads + ad_stats 모든 utm_content 포함
    const allUtmContents = new Set([...contentLeadMap.keys(), ...adStatsMap.keys()])

    const allCreatives: {
      utm_content: string; name: string; platform: string | null
      spend: number; clicks: number; impressions: number
      cpc: number; ctr: number; cpl: number
      leads: number; customers: number; revenue: number; conversionRate: number
      registered: boolean; file_name: string | null; file_type: string | null
    }[] = []

    for (const utmContent of allUtmContents) {
      const creative = creativeMap.get(utmContent)
      const leadData = contentLeadMap.get(utmContent)
      const paymentData = contentPaymentMap.get(utmContent)
      const adMetrics = adStatsMap.get(utmContent)

      const leadCount = leadData?.leadIds.size || 0
      const customerCount = paymentData?.payingCustomers.size || 0
      const revenue = paymentData?.revenue || 0
      const conversionRate = leadCount > 0 ? Math.round((customerCount / leadCount) * 1000) / 10 : 0

      const spend = adMetrics?.spend || 0
      const clicks = adMetrics?.clicks || 0
      const impressions = adMetrics?.impressions || 0

      allCreatives.push({
        utm_content: utmContent,
        name: creative?.name || utmContent,
        platform: creative ? normalizeChannel(creative.platform) : null,
        spend,
        clicks,
        impressions,
        cpc: clicks > 0 ? Math.round(spend / clicks) : 0,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpl: leadCount > 0 ? Math.round(spend / leadCount) : 0,
        leads: leadCount,
        customers: customerCount,
        revenue,
        conversionRate,
        registered: !!creative,
        file_name: creative?.file_name || null,
        file_type: creative?.file_type || null,
      })
    }

    // 지출 높은순 정렬, 동률 시 리드수 높은순
    allCreatives.sort((a, b) => b.spend - a.spend || b.leads - a.leads)

    return apiSuccess({ creatives: allCreatives })
  } catch (error) {
    logger.error('소재별 성과 조회 실패', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
