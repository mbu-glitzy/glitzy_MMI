import { notFound } from 'next/navigation'
import { serverSupabase } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'

interface Props {
  searchParams: Promise<{ id?: string }>
}

export default async function LandingPage({ searchParams }: Props) {
  const params = await searchParams
  const lpId = params.id

  if (!lpId) {
    notFound()
  }

  const supabase = serverSupabase()
  const { data: landingPage } = await supabase
    .from('landing_pages')
    .select('*, clinic:clinics(id, name)')
    .eq('id', lpId)
    .eq('is_active', true)
    .single()

  if (!landingPage) {
    notFound()
  }

  // HTML 파일 읽기
  const htmlPath = path.join(process.cwd(), 'public', 'landing', landingPage.file_name)

  if (!fs.existsSync(htmlPath)) {
    notFound()
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

  // body 내용만 추출
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[0] : htmlContent

  // head 내용 추출
  const headMatch = htmlContent.match(/<head[^>]*>([\s\S]*)<\/head>/i)
  const headContent = headMatch ? headMatch[1] : ''

  return (
    <html lang="ko">
      <head dangerouslySetInnerHTML={{ __html: headContent }} />
      <body
        dangerouslySetInnerHTML={{
          __html: bodyContent.replace(/<\/?body[^>]*>/gi, '')
        }}
      />
    </html>
  )
}

export const dynamic = 'force-dynamic'
