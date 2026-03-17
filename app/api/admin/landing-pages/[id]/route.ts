import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess, AuthContext } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'
import fs from 'fs'
import path from 'path'

function getLpIdFromUrl(req: Request): number | null {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const idStr = pathParts[pathParts.length - 1]
  return parseId(idStr)
}

export const GET = withSuperAdmin(async (req: Request, { user }: AuthContext) => {
  const lpId = getLpIdFromUrl(req)
  if (lpId === null) {
    return apiError('유효하지 않은 ID입니다.', 400)
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('landing_pages')
    .select('*, clinic:clinics(id, name)')
    .eq('id', lpId)
    .single()

  if (error || !data) {
    return apiError('랜딩 페이지를 찾을 수 없습니다.', 404)
  }

  return apiSuccess(data)
})

export const PUT = withSuperAdmin(async (req: Request, { user }: AuthContext) => {
  const lpId = getLpIdFromUrl(req)
  if (lpId === null) {
    return apiError('유효하지 않은 ID입니다.', 400)
  }

  const body = await req.json()
  const { name, file_name, clinic_id, description, is_active, gtm_id } = body

  const supabase = serverSupabase()

  // 기존 데이터 확인
  const { data: existing } = await supabase
    .from('landing_pages')
    .select('id')
    .eq('id', lpId)
    .single()

  if (!existing) {
    return apiError('랜딩 페이지를 찾을 수 없습니다.', 404)
  }

  // 파일명 변경 시 파일 존재 여부 확인
  if (file_name) {
    const filePath = path.join(process.cwd(), 'public', 'landing', file_name)
    if (!fs.existsSync(filePath)) {
      return apiError(`파일을 찾을 수 없습니다: ${file_name}`, 400)
    }
  }

  // clinic_id 유효성 검증
  let validClinicId: number | null | undefined = undefined
  if (clinic_id !== undefined) {
    if (clinic_id === null || clinic_id === '') {
      validClinicId = null
    } else {
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
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (name !== undefined) updateData.name = sanitizeString(name, 100)
  if (file_name !== undefined) updateData.file_name = sanitizeString(file_name, 100)
  if (validClinicId !== undefined) updateData.clinic_id = validClinicId
  if (description !== undefined) updateData.description = description ? sanitizeString(description, 500) : null
  if (gtm_id !== undefined) updateData.gtm_id = gtm_id ? sanitizeString(gtm_id, 20) : null
  if (is_active !== undefined) updateData.is_active = is_active

  const { data, error } = await supabase
    .from('landing_pages')
    .update(updateData)
    .eq('id', lpId)
    .select('*, clinic:clinics(id, name)')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const DELETE = withSuperAdmin(async (req: Request, { user }: AuthContext) => {
  const lpId = getLpIdFromUrl(req)
  if (lpId === null) {
    return apiError('유효하지 않은 ID입니다.', 400)
  }

  const supabase = serverSupabase()

  const { error } = await supabase
    .from('landing_pages')
    .delete()
    .eq('id', lpId)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ deleted: true })
})
