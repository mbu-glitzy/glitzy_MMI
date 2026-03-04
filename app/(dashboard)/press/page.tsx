'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Newspaper, ExternalLink, Play } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'

function groupByDate(articles: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {}
  for (const a of articles) {
    const date = a.published_at
      ? new Date(a.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      : '날짜 미상'
    if (!map[date]) map[date] = []
    map[date].push(a)
  }
  return map
}

export default function PressPage() {
  const { selectedClinicId } = useClinic()
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const data = await fetch(`/api/press${qs}`).then(r => r.json())
      setArticles(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [selectedClinicId])

  useEffect(() => { fetchArticles() }, [fetchArticles])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/press/sync${qs}`, { method: 'POST' })
      const data = await res.json()
      setSyncMsg({ ok: true, text: `수집 완료 — ${data.inserted || 0}건 업데이트` })
      await fetchArticles()
    } catch {
      setSyncMsg({ ok: false, text: '수집 실패' })
    } finally {
      setSyncing(false)
    }
  }

  const grouped = groupByDate(articles)
  const dates = Object.keys(grouped)

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">언론보도</h1>
          <p className="text-sm text-slate-400 mt-1">Google 뉴스에서 병원 관련 보도를 수집합니다. 매일 오전 9시 자동 갱신.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchArticles} disabled={loading} className="glass-card p-2.5 hover:bg-white/10 transition-all">
            <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all"
          >
            <Play size={14} /> {syncing ? '수집 중...' : '지금 수집'}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm ${syncMsg.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {syncMsg.ok ? '✅' : '❌'} {syncMsg.text}
        </div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: '총 보도 수',   value: articles.length },
          { label: '언론사 수',    value: new Set(articles.map(a => a.source)).size },
          { label: '최근 7일',     value: articles.filter(a => {
            if (!a.published_at) return false
            return (Date.now() - new Date(a.published_at).getTime()) < 7 * 24 * 3600 * 1000
          }).length },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{loading ? '-' : value}</p>
          </div>
        ))}
      </div>

      {/* 기사 목록 */}
      {loading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="glass-card p-4 space-y-3">
              <div className="h-4 bg-white/5 rounded animate-pulse w-32" />
              {Array(3).fill(0).map((__, j) => <div key={j} className="h-10 bg-white/5 rounded-xl animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : dates.length === 0 ? (
        <div className="glass-card py-16 text-center">
          <Newspaper size={36} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-2">수집된 언론보도가 없습니다.</p>
          <p className="text-xs text-slate-600">'지금 수집' 버튼을 눌러 Google 뉴스를 검색하세요.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map(date => (
            <div key={date} className="glass-card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Newspaper size={13} className="text-brand-400" />
                <span className="text-sm font-semibold text-white">{date}</span>
                <span className="text-xs text-slate-500 ml-auto">{grouped[date].length}건</span>
              </div>
              <div className="divide-y divide-white/5">
                {grouped[date].map(article => (
                  <div key={article.id} className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                    <div className="w-24 shrink-0">
                      <span className="text-xs font-medium text-slate-400 truncate block">{article.source}</span>
                    </div>
                    <p className="flex-1 text-sm text-slate-200 min-w-0 truncate">{article.title}</p>
                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-brand-400 shrink-0"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
