'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { TrendingDown, Lightbulb } from 'lucide-react'
import { FUNNEL_GRADIENT } from '@/lib/chart-colors'

function fmtShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).replace(/\.$/, '')
}

interface AdStatsRecord {
  impressions: number
  clicks: number
  spend: number
}

interface FunnelStage {
  stage: string
  count: number
}

interface FunnelData {
  stages: FunnelStage[]
}

interface FunnelResponse {
  type: string
  funnel: FunnelData
}

interface Props {
  startDate: string
  endDate: string
}

/** 2-Zone 퍼널 바 렌더 */
function FunnelBar({
  label,
  count,
  maxCount,
  opacityStep,
}: {
  label: string
  count: number
  maxCount: number
  opacityStep: number
}) {
  const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-foreground/80 font-medium">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="h-8 bg-muted/40 dark:bg-white/[0.04] rounded-lg overflow-hidden">
        <div
          className="h-full rounded-lg transition-all duration-500"
          style={{
            width: `${Math.max(widthPct, count > 0 ? 2 : 0)}%`,
            background: FUNNEL_GRADIENT,
            opacity: 1 - opacityStep * 0.15,
          }}
        />
      </div>
    </div>
  )
}

/** 전환 지표 미니카드 */
function MetricCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex-1 rounded-lg bg-muted/40 dark:bg-white/[0.04] p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${warn ? 'text-rose-500 dark:text-rose-400' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}

export default function AdsFunnel({ startDate, endDate }: Props) {
  const { selectedClinicId } = useClinic()

  const [adsLoading, setAdsLoading] = useState(true)
  const [funnelLoading, setFunnelLoading] = useState(true)
  const [impressions, setImpressions] = useState(0)
  const [clicks, setClicks] = useState(0)
  const [leadCount, setLeadCount] = useState(0)
  const [hasData, setHasData] = useState(false)

  const loading = adsLoading || funnelLoading

  const fetchAdsStats = useCallback(async () => {
    setAdsLoading(true)
    try {
      const days = String(Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1))
      const qs = new URLSearchParams({ days })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/ads/stats?${qs}`)
      if (!res.ok) return

      const json = await res.json()
      const records: AdStatsRecord[] = Array.isArray(json) ? json : (Array.isArray(json?.stats) ? json.stats : [])

      setImpressions(records.reduce((sum, r) => sum + (r.impressions || 0), 0))
      setClicks(records.reduce((sum, r) => sum + (r.clicks || 0), 0))
    } catch {
      // silently fail
    } finally {
      setAdsLoading(false)
    }
  }, [startDate, endDate, selectedClinicId])

  const fetchFunnelData = useCallback(async () => {
    setFunnelLoading(true)
    try {
      const qs = new URLSearchParams({ groupBy: 'total', startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/dashboard/funnel?${qs}`)
      if (!res.ok) return

      const json: FunnelResponse = await res.json()
      const stages = json?.funnel?.stages ?? []
      setLeadCount(stages.find(s => s.stage === 'Lead')?.count ?? 0)
    } catch {
      // silently fail
    } finally {
      setFunnelLoading(false)
    }
  }, [startDate, endDate, selectedClinicId])

  useEffect(() => {
    fetchAdsStats()
    fetchFunnelData()
  }, [fetchAdsStats, fetchFunnelData])

  useEffect(() => {
    if (!loading) {
      setHasData(impressions > 0 || clicks > 0 || leadCount > 0)
    }
  }, [loading, impressions, clicks, leadCount])

  // 전환 지표 계산
  const metrics = useMemo(() => {
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const clickToLead = clicks > 0 ? (leadCount / clicks) * 100 : 0
    const overallRate = impressions > 0 ? (leadCount / impressions) * 100 : 0
    return { ctr, clickToLead, overallRate }
  }, [impressions, clicks, leadCount])

  const adReachMax = useMemo(() => Math.max(impressions, clicks, 1), [impressions, clicks])

  // 최대 이탈 구간
  const worstDropoff = useMemo(() => {
    const stages = [
      { from: '노출', to: '클릭', rate: impressions > 0 ? 100 - (clicks / impressions) * 100 : 0 },
      { from: '클릭', to: '리드', rate: clicks > 0 ? 100 - (leadCount / clicks) * 100 : 0 },
    ]
    return stages.reduce((worst, s) => (s.rate > worst.rate ? s : worst), stages[0])
  }, [impressions, clicks, leadCount])

  return (
    <Card variant="glass" className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-5 gap-4">
        <h2 className="font-semibold text-foreground shrink-0">광고 퍼널 분석</h2>
        <span className="text-xs text-muted-foreground">{fmtShort(startDate)} ~ {fmtShort(endDate)}</span>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-8 rounded-lg" style={{ width: `${90 - i * 20}%` }} />
            </div>
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={TrendingDown}
          title="퍼널 데이터가 없습니다"
          description="광고 통계 및 리드 데이터가 유입되면 퍼널 분석을 확인할 수 있습니다."
        />
      ) : (
        <div className="space-y-4">
          {/* Zone 1: 광고 도달 */}
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">광고 도달</p>
            <div className="space-y-2">
              <FunnelBar label="노출" count={impressions} maxCount={adReachMax} opacityStep={0} />
              <div className="flex justify-start pl-1">
                <span className="text-[10px] text-muted-foreground/50">▼ CTR {metrics.ctr.toFixed(1)}%</span>
              </div>
              <FunnelBar label="클릭" count={clicks} maxCount={adReachMax} opacityStep={1} />
            </div>
          </div>

          {/* Zone 구분선 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-border/50 dark:border-white/[0.06]" />
            <span className="text-[10px] text-muted-foreground/60">클릭→리드 {metrics.clickToLead.toFixed(1)}%</span>
            <div className="flex-1 border-t border-border/50 dark:border-white/[0.06]" />
          </div>

          {/* Zone 2: 리드 전환 */}
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">리드 전환</p>
            <FunnelBar label="리드" count={leadCount} maxCount={leadCount} opacityStep={0} />
          </div>

          {/* 전환 지표 미니카드 */}
          <div className="flex gap-2 pt-1">
            <MetricCard label="CTR" value={`${metrics.ctr.toFixed(2)}%`} warn={metrics.ctr < 1} />
            <MetricCard label="클릭→리드" value={`${metrics.clickToLead.toFixed(1)}%`} warn={metrics.clickToLead < 1} />
            <MetricCard label="노출→리드" value={`${metrics.overallRate.toFixed(3)}%`} />
          </div>

          {/* 인사이트 */}
          {worstDropoff.rate > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <span>
                <span className="font-medium">{worstDropoff.from}→{worstDropoff.to}</span> 구간 이탈률이{' '}
                <span className="font-semibold">{worstDropoff.rate.toFixed(1)}%</span>로 가장 높습니다
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
