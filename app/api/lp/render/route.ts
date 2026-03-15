import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lpId = searchParams.get('id')

  if (!lpId) {
    return new NextResponse('랜딩 페이지 ID가 필요합니다.', { status: 400 })
  }

  const supabase = serverSupabase()
  const { data: landingPage } = await supabase
    .from('landing_pages')
    .select('*, clinic:clinics(id, name)')
    .eq('id', lpId)
    .eq('is_active', true)
    .single()

  if (!landingPage) {
    return new NextResponse('랜딩 페이지를 찾을 수 없습니다.', { status: 404 })
  }

  // HTML 파일 읽기
  const htmlPath = path.join(process.cwd(), 'public', 'landing', landingPage.file_name)

  if (!fs.existsSync(htmlPath)) {
    return new NextResponse('HTML 파일을 찾을 수 없습니다.', { status: 404 })
  }

  let htmlContent = fs.readFileSync(htmlPath, 'utf-8')

  // 데이터 주입 (</head> 앞에 스크립트 삽입)
  const clinicName = landingPage.clinic?.name || ''
  const dataScript = `
<script>
  window.__LP_DATA__ = {
    clinicId: ${landingPage.clinic_id || 'null'},
    landingPageId: ${landingPage.id},
    clinicName: "${clinicName.replace(/"/g, '\\"')}"
  };
</script>`

  htmlContent = htmlContent.replace('</head>', `${dataScript}</head>`)

  return new NextResponse(htmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

export const dynamic = 'force-dynamic'
