import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()

  let query = supabase
    .from('leads')
    .select(`
      *,
      customer:customers(
        *,
        consultations(*),
        payments(*),
        bookings(*)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
