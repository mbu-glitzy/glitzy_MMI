import { serverSupabase } from '@/lib/supabase'

function parseGoogleNewsRSS(xml: string): Array<{ title: string; source: string; url: string; published_at: string }> {
  const items: any[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const raw = (tag: string) => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? ''
    const clean = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim()

    const title   = clean(raw('title'))
    const link    = clean(raw('link'))
    const pubDate = clean(raw('pubDate'))
    const source  = clean(raw('source'))

    // Google News redirect URL contains ?url=... param
    const urlMatch = link.match(/[?&]url=([^&]+)/)
    const finalUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : link

    if (title && finalUrl) {
      items.push({
        title,
        url: finalUrl,
        source: source || 'Unknown',
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      })
    }
  }
  return items
}

export async function syncPressForClinic(clinicId: number | null): Promise<number> {
  const supabase = serverSupabase()

  let clinicsQuery = supabase.from('clinics').select('id, name')
  if (clinicId) clinicsQuery = clinicsQuery.eq('id', clinicId)
  const { data: clinics } = await clinicsQuery
  if (!clinics?.length) return 0

  let totalInserted = 0

  for (const clinic of clinics) {
    try {
      const q = encodeURIComponent(clinic.name)
      const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MMI-Bot/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue

      const xml   = await res.text()
      const items = parseGoogleNewsRSS(xml)
      if (!items.length) continue

      const rows = items.map(item => ({
        clinic_id:    clinic.id,
        title:        item.title,
        source:       item.source,
        url:          item.url,
        published_at: item.published_at,
        collected_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('press_coverage')
        .upsert(rows, { onConflict: 'clinic_id,url', ignoreDuplicates: true })

      if (!error) totalInserted += rows.length
    } catch {
      // skip on error
    }
  }

  return totalInserted
}
