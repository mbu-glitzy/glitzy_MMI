import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)

  // startDate 파라미터 지원 (기본값: 8주 전)
  const defaultStart = new Date(Date.now() - 56 * 86400000).toISOString()
  const startDate = url.searchParams.get('startDate') || defaultStart

  // 광고 지출 + 리드 수 병렬 조회
  let adQuery = supabase
    .from('ad_campaign_stats')
    .select('stat_date, spend_amount, campaign_id')
    .gte('stat_date', startDate)
    .order('stat_date')

  let leadQuery = supabase
    .from('leads')
    .select('created_at')
    .gte('created_at', startDate)
    .order('created_at')

  const adFiltered = applyClinicFilter(adQuery, { clinicId, assignedClinicIds })
  const leadFiltered = applyClinicFilter(leadQuery, { clinicId, assignedClinicIds })

  if (adFiltered === null && leadFiltered === null) return apiSuccess([])
  if (adFiltered) adQuery = adFiltered
  if (leadFiltered) leadQuery = leadFiltered

  const [adRes, leadRes] = await Promise.all([
    adFiltered ? adQuery : Promise.resolve({ data: [] as any[], error: null }),
    leadFiltered ? leadQuery : Promise.resolve({ data: [] as any[], error: null }),
  ])

  if (adRes.error) return apiError(adRes.error.message, 500)
  if (leadRes.error) return apiError(leadRes.error.message, 500)

  // 주 시작일 계산 헬퍼 (KST 기준, 일요일 시작)
  const getWeekKey = (dateStr: string) => {
    // KST 기준 YYYY-MM-DD 추출 후 UTC로 취급하여 요일 계산
    const kstDate = new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    const [y, m, d] = kstDate.split('-').map(Number)
    const utcDate = new Date(Date.UTC(y, m - 1, d))
    const day = utcDate.getUTCDay()
    const weekStart = new Date(Date.UTC(y, m - 1, d - day))
    return weekStart.toISOString()
  }

  // 광고 데이터 주별 집계
  const weekMap = new Map<string, { week: string; spend: number; campaigns: Set<string>; leads: number }>()
  for (const row of adRes.data || []) {
    const key = getWeekKey(row.stat_date)
    if (!weekMap.has(key)) weekMap.set(key, { week: key, spend: 0, campaigns: new Set(), leads: 0 })
    const w = weekMap.get(key)!
    w.spend += Number(row.spend_amount)
    w.campaigns.add(row.campaign_id)
  }

  // 리드 데이터 주별 집계
  for (const row of leadRes.data || []) {
    const key = getWeekKey(row.created_at)
    if (!weekMap.has(key)) weekMap.set(key, { week: key, spend: 0, campaigns: new Set(), leads: 0 })
    weekMap.get(key)!.leads += 1
  }

  const result = [...weekMap.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({
      week: w.week,
      spend: w.spend,
      campaigns: w.campaigns.size,
      leads: w.leads,
    }))

  return apiSuccess(result)
})
