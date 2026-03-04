// SQL to create press_coverage table in Supabase:
// CREATE TABLE press_coverage (
//   id bigserial primary key,
//   clinic_id int references clinics(id),
//   title text not null,
//   source text,
//   url text,
//   published_at timestamptz,
//   collected_at timestamptz default now(),
//   unique(clinic_id, url)
// );

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serverSupabase } from '@/lib/supabase'
import { getClinicId } from '@/lib/session'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serverSupabase()
  const clinicId = await getClinicId(req.url)

  let query = supabase
    .from('press_coverage')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(200)

  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
