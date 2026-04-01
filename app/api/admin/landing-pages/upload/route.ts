import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'

const BUCKET = 'landing-pages'

// 파일명 안전하게 정제
function sanitizeFileName(raw: string): string {
  const ext = '.html'
  const nameOnly = raw.replace(/\.html?$/i, '').replace(/[^a-zA-Z0-9가-힣_-]/g, '_').replace(/_{2,}/g, '_')
  return (nameOnly || 'upload') + ext
}

export const POST = withSuperAdmin(async (req: Request) => {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const overwrite = formData.get('overwrite') as string | null

  if (!file) {
    return apiError('파일이 첨부되지 않았습니다.', 400)
  }

  if (!file.name.match(/\.html?$/i)) {
    return apiError('HTML 파일만 업로드할 수 있습니다. (.html)', 400)
  }

  if (file.size > 5 * 1024 * 1024) {
    return apiError('파일 크기는 5MB 이하여야 합니다.', 400)
  }

  const supabase = serverSupabase()
  let fileName = sanitizeFileName(file.name)
  const content = await file.arrayBuffer()

  // 덮어쓰기 모드: 기존 파일명 그대로 upsert
  if (overwrite) {
    const targetName = sanitizeFileName(overwrite)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(targetName, Buffer.from(content), {
        contentType: 'text/html',
        upsert: true,
      })
    if (error) {
      return apiError(`파일 업로드 실패: ${error.message}`, 500)
    }
    return apiSuccess({ fileName: targetName })
  }

  // 신규 업로드: 중복 파일명 처리
  const { data: existingFiles } = await supabase.storage.from(BUCKET).list()
  const existingNames = new Set(existingFiles?.map(f => f.name) || [])
  if (existingNames.has(fileName)) {
    const ext = '.html'
    const base = fileName.replace(ext, '')
    let counter = 1
    while (existingNames.has(`${base}_${counter}${ext}`)) counter++
    fileName = `${base}_${counter}${ext}`
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, Buffer.from(content), {
      contentType: 'text/html',
      upsert: false,
    })

  if (error) {
    return apiError(`파일 업로드 실패: ${error.message}`, 500)
  }

  return apiSuccess({ fileName })
})
