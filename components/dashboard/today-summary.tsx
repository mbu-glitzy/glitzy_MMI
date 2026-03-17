'use client'

import { StatsCard } from '@/components/common'
import { MessageSquare, CalendarCheck, Banknote } from 'lucide-react'

interface TodayData {
  leads: number
  bookings: number
  revenue: number
  leadsDiff: number
  bookingsDiff: number
  revenueDiff: number
}

interface TodaySummaryProps {
  data?: TodayData | null
  loading?: boolean
}

function diffText(diff: number, unit: string): string {
  if (diff === 0) return '전일과 동일'
  const sign = diff > 0 ? '+' : ''
  return `전일 대비 ${sign}${diff.toLocaleString()}${unit}`
}

function diffColor(diff: number): 'default' | 'positive' | 'negative' {
  if (diff > 0) return 'positive'
  if (diff < 0) return 'negative'
  return 'default'
}

export function TodaySummary({ data, loading }: TodaySummaryProps) {
  const cards = [
    {
      label: '오늘 문의',
      value: data ? `${data.leads}건` : '-',
      subtitle: data ? diffText(data.leadsDiff, '건') : undefined,
      subtitleColor: data ? diffColor(data.leadsDiff) : 'default' as const,
      icon: MessageSquare,
    },
    {
      label: '오늘 예약',
      value: data ? `${data.bookings}건` : '-',
      subtitle: data ? diffText(data.bookingsDiff, '건') : undefined,
      subtitleColor: data ? diffColor(data.bookingsDiff) : 'default' as const,
      icon: CalendarCheck,
    },
    {
      label: '오늘 매출',
      value: data ? `₩${data.revenue.toLocaleString()}` : '-',
      subtitle: data ? diffText(data.revenueDiff, '원') : undefined,
      subtitleColor: data ? diffColor(data.revenueDiff) : 'default' as const,
      icon: Banknote,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      {cards.map((card) => (
        <StatsCard
          key={card.label}
          label={card.label}
          value={card.value}
          loading={loading}
          icon={card.icon}
          subtitle={card.subtitle}
          subtitleColor={card.subtitleColor}
          size="lg"
        />
      ))}
    </div>
  )
}
