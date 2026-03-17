'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { Users, ArrowRight, Filter } from 'lucide-react'
import Link from 'next/link'

const FUNNEL_SHADES = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff']

interface FunnelStage {
  stage: string
  label: string
  count: number
  rate: number
  dropoff: number
}

interface FunnelData {
  funnel?: {
    stages: FunnelStage[]
    totalConversionRate: number
  }
}

interface FunnelSectionProps {
  data: FunnelData | null
  loading?: boolean
}

export function FunnelSection({ data, loading }: FunnelSectionProps) {
  const stages = data?.funnel?.stages
  const totalRate = data?.funnel?.totalConversionRate

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-white">전환 퍼널</h2>
        </div>
        <span className="text-xs text-slate-500">리드 → 결제 전환율</span>
      </div>

      {loading ? (
        <Skeleton className="h-[100px] rounded-lg" />
      ) : stages && stages.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {stages.map((stage, i) => (
              <div key={stage.stage} className="flex items-center gap-2 min-w-0">
                <div className="text-center min-w-[80px]">
                  <div
                    className="mx-auto rounded-lg flex items-center justify-center font-bold text-white mb-2"
                    style={{
                      width: Math.max(48, 72 - i * 5),
                      height: Math.max(48, 72 - i * 5),
                      background: FUNNEL_SHADES[i % FUNNEL_SHADES.length],
                    }}
                  >
                    {stage.count}
                  </div>
                  <p className="text-xs font-medium text-slate-300">{stage.label}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">{stage.rate}%</p>
                </div>
                {i < stages.length - 1 && (
                  <div className="flex flex-col items-center text-slate-600 shrink-0">
                    <ArrowRight size={14} />
                    <span className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                      {stage.dropoff > 0 ? `-${stage.dropoff}%` : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-white/5">
            {totalRate !== undefined && totalRate > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500">전체 전환율 (리드 → 결제)</span>
                <span className="text-lg font-bold text-emerald-400 tabular-nums">{totalRate}%</span>
              </div>
            )}
            <Link
              href="/leads"
              className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              전체 고객 여정 보기
              <ArrowRight size={12} />
            </Link>
          </div>
        </>
      ) : (
        <EmptyState
          icon={Filter}
          title="퍼널 데이터 부족"
          description="리드가 유입되면 전환 퍼널이 자동 생성됩니다."
        />
      )}
    </Card>
  )
}
