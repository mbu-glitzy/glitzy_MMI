'use client'
import { useState, useEffect } from 'react'
import { Plus, UserCog, ToggleLeft, ToggleRight } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any

  const [users, setUsers] = useState<any[]>([])
  const [clinics, setClinics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'clinic_admin', clinic_id: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [uRes, cRes] = await Promise.all([
        fetch('/api/admin/users').then(r => r.json()),
        fetch('/api/admin/clinics').then(r => r.json()),
      ])
      setUsers(Array.isArray(uRes) ? uRes : [])
      setClinics(Array.isArray(cRes) ? cRes : [])
    } catch {
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!form.username || !form.password) {
      toast.error('아이디와 비밀번호를 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, clinic_id: form.clinic_id ? Number(form.clinic_id) : null }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setForm({ username: '', password: '', role: 'clinic_admin', clinic_id: '' })
      setDialogOpen(false)
      toast.success('계정이 생성되었습니다.')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || '생성 실패')
    } finally {
      setSaving(false)
    }
  }

  const toggleUser = async (id: number, is_active: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !is_active }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success(is_active ? '계정이 비활성화되었습니다.' : '계정이 활성화되었습니다.')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || '상태 변경 실패')
    }
  }

  if (user?.role !== 'superadmin') return null

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <UserCog className="text-brand-400" size={24} />
          <h1 className="text-2xl font-bold text-white">계정 관리</h1>
        </div>
        <p className="text-sm text-slate-400">사용자 계정 생성 및 권한 관리</p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신규 계정 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">아이디 *</Label>
                <Input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="로그인 아이디"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">비밀번호 *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="초기 비밀번호"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">역할 *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinic_staff">병원 담당자</SelectItem>
                  <SelectItem value="clinic_admin">병원 관리자</SelectItem>
                  <SelectItem value="superadmin">슈퍼어드민</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.role === 'clinic_admin' || form.role === 'clinic_staff') && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">담당 병원 *</Label>
                <Select value={form.clinic_id} onValueChange={v => setForm(f => ({ ...f, clinic_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinics.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? '생성 중...' : '계정 생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">계정 목록 ({users.length})</h2>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Plus size={14} /> 계정 생성
          </Button>
        </div>
        {loading ? (
          <p className="text-slate-500 text-sm py-4 text-center">로딩 중...</p>
        ) : users.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">등록된 계정이 없습니다.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/5 hover:bg-transparent">
                {['아이디', '역할', '담당 병원', '생성일', '상태', '활성화'].map(h => (
                  <TableHead key={h} className="text-xs text-slate-500 font-medium">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
              <TableRow key={u.id} className="border-b border-white/5">
                <TableCell className="text-white font-medium">{u.username}</TableCell>
                <TableCell>
                  <Badge
                    variant={u.role === 'superadmin' ? 'default' : 'info'}
                    className={u.role === 'superadmin' ? 'bg-purple-500/20 text-purple-400 border-0' : u.role === 'clinic_staff' ? 'bg-slate-500/20 text-slate-400 border-0' : ''}
                  >
                    {u.role === 'superadmin' ? '슈퍼어드민' : u.role === 'clinic_admin' ? '병원 관리자' : '병원 담당자'}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-400 text-xs">{u.clinic?.name || '-'}</TableCell>
                <TableCell className="text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString('ko')}</TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? 'success' : 'secondary'}>
                    {u.is_active ? '활성' : '비활성'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => toggleUser(u.id, u.is_active)}
                    className="text-slate-400 hover:text-white transition-colors"
                    aria-label={u.is_active ? '계정 비활성화' : '계정 활성화'}
                  >
                    {u.is_active ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
                  </button>
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
