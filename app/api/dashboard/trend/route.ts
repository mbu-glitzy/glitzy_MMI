import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)

  // startDate 파라미터 지원 (기본값: 8주 전 = 56일)
  const defaultStart = new Date(Date.now() - 56 * 86400000).toISOString()
  const startDate = url.searchParams.get('startDate') || defaultStart

  // 광고 지출 + 리드 수 병렬 조회
  let adQuery = supabase
    .from('ad_campaign_stats')
    .select('stat_date, spend_amount')
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
    adFiltered ? adQuery : Promise.resolve({ data: [] as { stat_date: string; spend_amount: number }[], error: null }),
    leadFiltered ? leadQuery : Promise.resolve({ data: [] as { created_at: string }[], error: null }),
  ])

  if (adRes.error) return apiError(adRes.error.message, 500)
  if (leadRes.error) return apiError(leadRes.error.message, 500)

  // KST 기준 YYYY-MM-DD 추출
  const toKstDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  }

  // 일별 집계
  const dayMap = new Map<string, { date: string; spend: number; leads: number }>()

  for (const row of adRes.data || []) {
    const key = row.stat_date.split('T')[0] // stat_date는 이미 YYYY-MM-DD 형식
    if (!dayMap.has(key)) dayMap.set(key, { date: key, spend: 0, leads: 0 })
    dayMap.get(key)!.spend += Number(row.spend_amount)
  }

  for (const row of leadRes.data || []) {
    const key = toKstDate(row.created_at)
    if (!dayMap.has(key)) dayMap.set(key, { date: key, spend: 0, leads: 0 })
    dayMap.get(key)!.leads += 1
  }

  const result = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))

  return apiSuccess(result)
})
