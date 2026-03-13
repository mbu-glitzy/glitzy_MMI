import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const days = Number(url.searchParams.get('days') || 30)
  const platform = url.searchParams.get('platform')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('ad_campaign_stats')
    .select('*')
    .gte('stat_date', since)
    .order('stat_date', { ascending: false })

  if (platform) query = query.eq('platform', platform)
  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
