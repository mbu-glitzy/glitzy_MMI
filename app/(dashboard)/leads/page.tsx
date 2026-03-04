'use client'
import { useState, useEffect } from 'react'
import { Search, User, Phone, Calendar, TrendingUp, Users, Star } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'

const SOURCE_COLORS: Record<string, string> = {
  Meta:      'bg-blue-500/20 text-blue-400',
  Google:    'bg-red-500/20 text-red-400',
  TikTok:    'bg-pink-500/20 text-pink-400',
  YouTube:   'bg-red-500/20 text-red-400',
  Instagram: 'bg-purple-500/20 text-purple-400',
  Naver:     'bg-green-500/20 text-green-400',
  Unknown:   'bg-slate-500/20 text-slate-400',
}

const GRADE_CONFIG: Record<string, { color: string; icon: string }> = {
  VIP:  { color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', icon: '👑' },
  골드:  { color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',    icon: '✦' },
  실버:  { color: 'bg-slate-400/20 text-slate-300 border border-slate-400/30',    icon: '◈' },
  일반:  { color: 'bg-slate-700/20 text-slate-500 border border-slate-700/30',    icon: '' },
}

function getGrade(totalPayment: number, treatmentCount: number): keyof typeof GRADE_CONFIG {
  if (totalPayment >= 5_000_000 || treatmentCount >= 5) return 'VIP'
  if (totalPayment >= 2_000_000 || treatmentCount >= 3) return '골드'
  if (totalPayment >= 500_000   || treatmentCount >= 1) return '실버'
  return '일반'
}

function getCustomerType(customer: any): 'new' | 'revisit' {
  const total =
    (customer?.consultations?.length || 0) +
    (customer?.bookings?.length || 0) +
    (customer?.payments?.length || 0)
  return total >= 2 ? 'revisit' : 'new'
}

function CustomerDetail({ lead }: { lead: any }) {
  const c = lead.customer
  const payments: any[] = c?.payments || []
  const consultations: any[] = c?.consultations || []
  const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
  const grade = getGrade(totalPayment, payments.length)
  const gradeStyle = GRADE_CONFIG[grade]
  const customerType = getCustomerType(c)

  // Group payments by treatment name
  const treatmentMap: Record<string, { count: number; total: number }> = {}
  payments.forEach((p: any) => {
    const name = p.treatment_name || '기타'
    if (!treatmentMap[name]) treatmentMap[name] = { count: 0, total: 0 }
    treatmentMap[name].count++
    treatmentMap[name].total += Number(p.payment_amount)
  })

  return (
    <div className="glass-card p-6">
      {/* 고객 헤더 */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-lg shrink-0">
          {c?.name?.[0] || '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-white">{c?.name || '이름 없음'}</h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SOURCE_COLORS[c?.first_source] || SOURCE_COLORS.Unknown}`}>
              {c?.first_source || 'Unknown'}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeStyle.color}`}>
              {gradeStyle.icon && `${gradeStyle.icon} `}{grade}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${customerType === 'revisit' ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-600/20 text-slate-400'}`}>
              {customerType === 'revisit' ? '재방문' : '신규'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Phone size={11} />{c?.phone_number}</span>
            <span className="flex items-center gap-1"><Calendar size={11} />{new Date(lead.created_at).toLocaleDateString('ko')}</span>
          </div>
        </div>
        {totalPayment > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500 mb-0.5">누적 결제액</p>
            <p className="text-lg font-bold text-emerald-400">₩{totalPayment.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* 시술 이력 */}
      {Object.keys(treatmentMap).length > 0 && (
        <div className="mb-5 p-4 bg-white/[0.03] rounded-xl border border-white/5">
          <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <TrendingUp size={12} /> 시술 이력
          </p>
          <div className="space-y-2">
            {Object.entries(treatmentMap).map(([name, { count, total }]) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">{name}</span>
                  <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{count}회</span>
                </div>
                <span className="text-sm font-semibold text-emerald-400">₩{total.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <span className="text-xs text-slate-500">총 {payments.length}회 시술</span>
            <span className="text-sm font-bold text-emerald-400">₩{totalPayment.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 여정 타임라인 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-300">광고 인입</p>
            <p className="text-xs text-slate-500">{c?.first_source} → 랜딩페이지 DB 등록</p>
          </div>
          <span className="ml-auto text-xs text-slate-600">{new Date(lead.created_at).toLocaleDateString('ko')}</span>
        </div>

        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${lead.chatbot_sent ? 'bg-emerald-500' : 'bg-slate-600'}`} />
          <div>
            <p className="text-xs font-semibold text-slate-300">챗봇 발송</p>
            <p className="text-xs text-slate-500">
              {lead.chatbot_sent
                ? `✅ 발송 완료 (${new Date(lead.chatbot_sent_at).toLocaleTimeString('ko')})`
                : '⏳ 발송 대기 중'}
            </p>
          </div>
        </div>

        {consultations.map((consult: any) => (
          <div key={consult.id} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-300">상담</p>
              <p className="text-xs text-slate-500">{consult.status} — {consult.notes || '메모 없음'}</p>
            </div>
            {consult.consultation_date && (
              <span className="ml-auto text-xs text-slate-600">{new Date(consult.consultation_date).toLocaleDateString('ko')}</span>
            )}
          </div>
        ))}

        {payments.map((p: any) => (
          <div key={p.id} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-300">결제</p>
              <p className="text-xs text-slate-500">{p.treatment_name} — ₩{Number(p.payment_amount).toLocaleString()}</p>
            </div>
            <span className="ml-auto text-xs text-slate-600">{new Date(p.payment_date).toLocaleDateString('ko')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LeadsPage() {
  const { selectedClinicId } = useClinic()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [tab, setTab] = useState<'all' | 'new' | 'revisit'>('all')

  useEffect(() => {
    setLoading(true)
    const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
    fetch(`/api/leads${qs}`)
      .then(r => r.json())
      .then(d => setLeads(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedClinicId])

  const searched = leads.filter(l =>
    l.customer?.name?.includes(search) ||
    l.customer?.phone_number?.includes(search)
  )
  const newLeads     = searched.filter(l => getCustomerType(l.customer) === 'new')
  const revisitLeads = searched.filter(l => getCustomerType(l.customer) === 'revisit')
  const displayed    = tab === 'all' ? searched : tab === 'new' ? newLeads : revisitLeads

  const TABS = [
    { key: 'all',     label: '전체',     count: searched.length },
    { key: 'new',     label: '신규고객',  count: newLeads.length },
    { key: 'revisit', label: '재방문고객', count: revisitLeads.length },
  ]

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">고객(CDP) 관리</h1>
          <p className="text-sm text-slate-400 mt-1">광고 인입 → 챗봇 → 상담 → 결제 전체 여정을 추적합니다.</p>
        </div>
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <Search size={14} className="text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호 검색"
            className="bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none w-52"
          />
        </div>
      </div>

      {/* 신규 / 재방문 탭 */}
      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key as any); setSelected(null) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              tab === t.key
                ? 'bg-brand-600 text-white border-brand-600'
                : 'glass-card border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.key === 'new'     && <User  size={13} />}
            {t.key === 'revisit' && <Users size={13} />}
            {t.label}
            <span className={`text-xs px-1.5 py-0 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-white/5 text-slate-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* 고객 목록 — 모바일에서 선택 시 숨김 */}
        <div className={`md:col-span-2 space-y-2 ${selected ? 'hidden md:block' : ''}`}>
          {loading
            ? Array(8).fill(0).map((_, i) => <div key={i} className="glass-card h-16 animate-pulse" />)
            : displayed.map(lead => {
              const c = lead.customer
              const payments: any[] = c?.payments || []
              const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
              const grade = getGrade(totalPayment, payments.length)
              const gradeStyle = GRADE_CONFIG[grade]
              const isSelected = selected?.id === lead.id
              return (
                <button
                  key={lead.id}
                  onClick={() => setSelected(isSelected ? null : lead)}
                  className={`w-full glass-card px-4 py-3 flex items-center gap-3 text-left transition-all ${isSelected ? 'ring-1 ring-brand-500' : 'hover:bg-white/[0.03]'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0">
                    {c?.name?.[0] || <User size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-medium text-white truncate">{c?.name || '이름 없음'}</p>
                      {grade !== '일반' && (
                        <span className={`text-[10px] font-bold px-1.5 rounded-full shrink-0 ${gradeStyle.color}`}>
                          {grade}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c?.phone_number}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${SOURCE_COLORS[c?.first_source] || SOURCE_COLORS.Unknown}`}>
                    {c?.first_source || '-'}
                  </span>
                </button>
              )
            })
          }
          {!loading && displayed.length === 0 && (
            <div className="glass-card p-8 text-center text-slate-500 text-sm">
              {search
                ? `'${search}' 검색 결과 없음`
                : tab === 'revisit' ? '재방문 고객이 없습니다.'
                : tab === 'new'     ? '신규 고객이 없습니다.'
                : '인입된 고객이 없습니다.'}
            </div>
          )}
        </div>

        {/* 상세 패널 — 모바일에서 선택 시에만 표시 */}
        <div className={`md:col-span-3 ${!selected ? 'hidden md:block' : ''}`}>
          {selected ? (
            <div>
              <button
                onClick={() => setSelected(null)}
                className="md:hidden mb-3 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                ← 목록으로
              </button>
              <CustomerDetail lead={selected} />
            </div>
          ) : (
              <div className="glass-card p-12 text-center">
                <Star size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">좌측 목록에서 고객을 선택하면<br />전체 여정 및 시술 이력을 확인할 수 있습니다.</p>
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: '전체 고객', value: searched.length },
                    { label: '신규 고객', value: newLeads.length },
                    { label: '재방문 고객', value: revisitLeads.length },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/[0.03] rounded-xl p-3">
                      <p className="text-lg font-bold text-white">{loading ? '-' : value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
        </div>
      </div>
    </>
  )
}
