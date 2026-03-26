import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdsStats')

export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const daysParam = Number(url.searchParams.get('days') || 30)
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30
  const platform = url.searchParams.get('platform')

  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const since = getKstDateString(sinceDate)

  try {
    // 1) ad_campaign_stats 조회
    let query = supabase
      .from('ad_campaign_stats')
      .select('*')
      .gte('stat_date', since)
      .order('stat_date', { ascending: false })

    if (platform) query = query.eq('platform', platform)
    const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
    if (filtered === null) return apiSuccess({ stats: [], campaignLeadCounts: {} })
    query = filtered

    const { data, error } = await query
    if (error) {
      logger.error('ad_campaign_stats 조회 실패', error, { clinicId })
      return apiSuccess({ stats: [], campaignLeadCounts: {} })
    }

    // 2) ad_stats 경유: campaign_id별 리드 수 산출
    let adStatsQuery = supabase
      .from('ad_stats')
      .select('campaign_id, utm_content')
      .not('utm_content', 'is', null)
      .gte('stat_date', since)

    const filteredAdStats = applyClinicFilter(adStatsQuery, { clinicId, assignedClinicIds })
    if (filteredAdStats) adStatsQuery = filteredAdStats

    const { data: adStatsData } = await adStatsQuery

    // campaign_id → utm_content Set
    const campaignUtmMap = new Map<string, Set<string>>()
    for (const row of adStatsData || []) {
      if (!row.campaign_id || !row.utm_content) continue
      if (!campaignUtmMap.has(row.campaign_id)) {
        campaignUtmMap.set(row.campaign_id, new Set())
      }
      campaignUtmMap.get(row.campaign_id)!.add((row.utm_content as string).toLowerCase())
    }

    // 전체 utm_content 목록으로 leads 조회
    const allUtmContents = new Set<string>()
    for (const utmSet of campaignUtmMap.values()) {
      for (const u of utmSet) allUtmContents.add(u)
    }

    const campaignLeadCounts: Record<string, number> = {}

    if (allUtmContents.size > 0) {
      let leadsQuery = supabase
        .from('leads')
        .select('utm_content')
        .not('utm_content', 'is', null)
        .gte('created_at', since)

      const filteredLeads = applyClinicFilter(leadsQuery, { clinicId, assignedClinicIds })
      if (filteredLeads) leadsQuery = filteredLeads

      const { data: leadsData } = await leadsQuery

      // utm_content별 리드 수
      const utmLeadCounts = new Map<string, number>()
      for (const lead of leadsData || []) {
        if (!lead.utm_content) continue
        const key = (lead.utm_content as string).toLowerCase()
        utmLeadCounts.set(key, (utmLeadCounts.get(key) || 0) + 1)
      }

      // campaign_id별 리드 수 집계
      for (const [campaignId, utmSet] of campaignUtmMap) {
        let total = 0
        for (const utm of utmSet) {
          total += utmLeadCounts.get(utm) || 0
        }
        if (total > 0) campaignLeadCounts[campaignId] = total
      }
    }

    return apiSuccess({ stats: data, campaignLeadCounts })
  } catch (err) {
    logger.error('ads/stats 조회 실패', err, { clinicId })
    return apiSuccess({ stats: [], campaignLeadCounts: {} })
  }
})
