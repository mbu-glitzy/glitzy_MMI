'use client'
import { useState, useEffect } from 'react'
import { Plus, Building2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export default function ClinicsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any

  const [clinics, setClinics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const fetchClinics = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/clinics')
      const data = await res.json()
      setClinics(Array.isArray(data) ? data : [])
    } catch {
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClinics() }, [])

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      toast.error('병원명과 슬러그를 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setForm({ name: '', slug: '' })
      setDialogOpen(false)
      toast.success('병원이 등록되었습니다.')
      fetchClinics()
    } catch (e: any) {
      toast.error(e.message || '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'superadmin') return null

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="text-brand-400" size={24} />
          <h1 className="text-2xl font-bold text-white">병원 관리</h1>
        </div>
        <p className="text-sm text-slate-400">병원 고객사 등록 및 관리</p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신규 병원 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">병원명 *</Label>
              <Input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예: 미래성형외과"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">슬러그 (영문소문자) *</Label>
              <Input
                type="text"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="예: mirae"
              />
              <p className="text-xs text-slate-500">URL에 사용됩니다. 영문 소문자, 숫자, 하이픈만 허용</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? '등록 중...' : '병원 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">병원 목록 ({clinics.length})</h2>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Plus size={14} /> 병원 등록
          </Button>
        </div>
        {loading ? (
          <p className="text-slate-500 text-sm py-4 text-center">로딩 중...</p>
        ) : clinics.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">등록된 병원이 없습니다.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/5 hover:bg-transparent">
                <TableHead className="text-xs text-slate-500 font-medium">ID</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">병원명</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">슬러그</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">등록일</TableHead>
                <TableHead className="text-xs text-slate-500 font-medium">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinics.map((c: any) => (
                <TableRow key={c.id} className="border-b border-white/5">
                  <TableCell className="text-slate-500 text-xs">#{c.id}</TableCell>
                  <TableCell className="text-white font-medium">{c.name}</TableCell>
                  <TableCell className="text-slate-400 font-mono text-xs">{c.slug}</TableCell>
                  <TableCell className="text-slate-400 text-xs">{new Date(c.created_at).toLocaleDateString('ko')}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? 'success' : 'secondary'}>
                      {c.is_active ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  )
}
