import bcrypt from 'bcryptjs'
import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'

export const GET = withSuperAdmin(async () => {
  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, clinic_id, is_active, created_at, clinic:clinics(name)')
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const POST = withSuperAdmin(async (req: Request) => {
  const { username, password, role, clinic_id } = await req.json()

  // 필수값 검증
  if (!username || !password) {
    return apiError('아이디와 비밀번호를 입력해주세요.', 400)
  }

  // 아이디 형식 검증
  const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/
  if (!usernamePattern.test(username)) {
    return apiError('아이디는 영문, 숫자, 밑줄만 사용 가능합니다. (3-30자)', 400)
  }

  // 비밀번호 강도 검증
  if (password.length < 8) {
    return apiError('비밀번호는 최소 8자 이상이어야 합니다.', 400)
  }

  // 역할 검증
  const validRoles = ['superadmin', 'clinic_admin']
  if (!validRoles.includes(role)) {
    return apiError('유효하지 않은 역할입니다.', 400)
  }

  if (role === 'clinic_admin' && !clinic_id) {
    return apiError('병원을 선택해주세요.', 400)
  }

  const password_hash = await bcrypt.hash(password, 12) // 라운드 수 증가
  const supabase = serverSupabase()

  const { data, error } = await supabase
    .from('users')
    .insert({
      username: sanitizeString(username, 30),
      password_hash,
      role,
      clinic_id: role === 'superadmin' ? null : clinic_id,
    })
    .select('id, username, role, clinic_id, is_active, created_at')
    .single()

  if (error) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return apiError('이미 존재하는 아이디입니다.', 400)
    }
    return apiError(error.message, 500)
  }
  return apiSuccess(data)
})

export const PATCH = withSuperAdmin(async (req: Request) => {
  const { id, is_active } = await req.json()

  const userId = parseId(id)
  if (!userId) {
    return apiError('유효한 사용자 ID가 필요합니다.', 400)
  }

  if (typeof is_active !== 'boolean') {
    return apiError('is_active는 boolean 값이어야 합니다.', 400)
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('users')
    .update({ is_active })
    .eq('id', userId)
    .select('id, username, is_active')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
