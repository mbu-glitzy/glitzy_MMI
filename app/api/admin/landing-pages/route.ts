import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'
import fs from 'fs'
import path from 'path'

// 사용 가능한 HTML 파일 목록 조회
function getAvailableHtmlFiles(): string[] {
  const landingDir = path.join(process.cwd(), 'public', 'landing')
  try {
    const files = fs.readdirSync(landingDir)
    return files.filter(f => f.endsWith('.html'))
  } catch {
    return []
  }
}

export const GET = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const includeFiles = url.searchParams.get('includeFiles') === 'true'

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('landing_pages')
    .select('*, clinic:clinics(id, name)')
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)

  if (includeFiles) {
    return apiSuccess({
      landingPages: data,
      availableFiles: getAvailableHtmlFiles(),
    })
  }

  return apiSuccess(data)
})

export const POST = withSuperAdmin(async (req: Request) => {
  const body = await req.json()
  const { name, file_name, clinic_id, description, is_active } = body

  if (!name || !file_name) {
    return apiError('이름과 파일명은 필수입니다.', 400)
  }

  // 파일 존재 여부 확인
  const filePath = path.join(process.cwd(), 'public', 'landing', file_name)
  if (!fs.existsSync(filePath)) {
    return apiError(`파일을 찾을 수 없습니다: ${file_name}`, 400)
  }

  const supabase = serverSupabase()

  // clinic_id 유효성 검증 (제공된 경우)
  let validClinicId: number | null = null
  if (clinic_id) {
    validClinicId = parseId(clinic_id)
    if (validClinicId === null) {
      return apiError('유효하지 않은 병원 ID입니다.', 400)
    }

    const { data: clinic } = await supabase
      .from('clinics')
      .select('id')
      .eq('id', validClinicId)
      .single()

    if (!clinic) {
      return apiError('존재하지 않는 병원입니다.', 400)
    }
  }

  const { data, error } = await supabase
    .from('landing_pages')
    .insert({
      name: sanitizeString(name, 100),
      file_name: sanitizeString(file_name, 100),
      clinic_id: validClinicId,
      description: description ? sanitizeString(description, 500) : null,
      is_active: is_active !== false,
    })
    .select('*, clinic:clinics(id, name)')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
