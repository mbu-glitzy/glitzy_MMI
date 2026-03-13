import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext } from '@/lib/api-middleware'

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
})
