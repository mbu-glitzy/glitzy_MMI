/**
 * 채널명 정규화 — 다양한 utm_source/platform 값을 통일된 채널명으로 변환
 */
export function normalizeChannel(source: string | null | undefined): string {
  if (!source) return 'Unknown'
  const normalized = source.toLowerCase().trim()
  const channelMap: Record<string, string> = {
    'meta': 'Meta', 'meta_ads': 'Meta', 'facebook': 'Meta', 'fb': 'Meta',
    'google': 'Google', 'google_ads': 'Google', 'gdn': 'Google',
    'youtube': 'YouTube', 'yt': 'YouTube',
    'tiktok': 'TikTok', 'tiktok_ads': 'TikTok',
    'naver': 'Naver', 'naver_ads': 'Naver',
    'kakao': 'Kakao', 'kakao_ads': 'Kakao',
    'dable': 'Dable', 'dable_ads': 'Dable',
    'instagram': 'Instagram', 'ig': 'Instagram',
    'phone': 'Phone',
    'direct': 'Direct',
    'organic': 'Organic',
  }
  return channelMap[normalized] || source
}
