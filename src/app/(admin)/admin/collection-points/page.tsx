'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Edit, Trash2, MapPin, Phone, UserCircle2, ChevronLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react'

/* ===================== Tipos ===================== */
type CollectionPoint = {
  id: string
  name: string
  slug: string
  description?: string | null
  address?: string | null
  district?: string | null
  cityName?: string | null
  state?: string | null
  zipCode?: string | null
  lat?: number | null
  lng?: number | null
  phone?: string | null
  responsibleUserId?: string | null
  openingJson?: any
  active: boolean
  createdAt?: string
  updatedAt?: string
}

type PageResp<T> = { items: T[]; total: number; page: number; pageSize: number; pages: number }

/* ===================== Helpers ===================== */
const pageSize = 20
const normalize = <T,>(raw: any, p: number): PageResp<T> => {
  const items: T[] = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw)
    ? raw
    : []
  const total = typeof raw?.total === 'number' ? raw.total : items.length
  const pages = typeof raw?.pages === 'number' ? raw.pages : Math.max(1, Math.ceil(total / pageSize))
  const currentPage = typeof raw?.page === 'number' ? raw.page : p
  return { items, total, page: currentPage, pageSize, pages }
}

function cls(...s: (string | false | null | undefined)[]) { return s.filter(Boolean).join(' ') }
function toNumOrNull(v?: string) {
  if (!v || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/* ===================== Página ===================== */
export default function AdminCollectionPointsPage() {
  const [data, setData] = useState<PageResp<CollectionPoint> | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [active, setActive] = useState<'all' | 'true' | 'false'>('all')

  const load = async () => {
    setLoading(true)
    try {
      const url = new URL('/api/admin/collection-points', window.location.origin)
      if (q) url.searchParams.set('q', q)
      if (active !== 'all') url.searchParams.set('active', active)
      url.searchParams.set('page', String(page))
      url.searchParams.set('pageSize', String(pageSize))
      const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include', headers: { accept: 'application/json' } })
      if (!res.ok) setData({ items: [], total: 0, page: 1, pageSize, pages: 1 })
      else setData(normalize<CollectionPoint>(await res.json(), page))
    } catch {
      setData({ items: [], total: 0, page: 1, pageSize, pages: 1 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [q, page, active])

  const rows = data?.items ?? []
  const stats = useMemo(() => {
    const total = data?.total ?? rows.length
    const actives = rows.filter(r => r.active).length
    const inactives = rows.length - actives
    return { total, actives, inactives }
  }, [data, rows])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pontos de Coleta</h1>
            <p className="text-gray-600 text-lg">Gerencie os locais onde os presentes podem ser entregues</p>
          </div>
          <CreatePointButton onCreated={load} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Total de Pontos" value={stats.total} icon={<MapPin className="w-6 h-6 text-blue-600" />} />
          <StatCard title="Ativos" value={stats.actives} icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />} />
          <StatCard title="Inativos" value={stats.inactives} icon={<X className="w-6 h-6 text-rose-600" />} />
        </div>

        {/* Filtros */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Buscar por nome, endereço, cidade, estado..."
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value) }}
              />
            </div>
            <div className="w-full lg:w-60">
              <label className="text-sm font-semibold text-gray-700">Status</label>
              <select
                className="mt-1 w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                value={active}
                onChange={(e) => { setPage(1); setActive(e.target.value as any) }}
              >
                <option value="all">Todos</option>
                <option value="true">Ativos</option>
                <option value="false">Inativos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <Th>#</Th>
                  <Th>Ponto</Th>
                  <Th>Cidade/UF</Th>
                  <Th>Endereço</Th>
                  <Th>Contato</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && <LoadingRow colSpan={6} label="Carregando pontos..." />}
                {!loading && rows.length === 0 && <EmptyRow colSpan={6} label="Nenhum ponto encontrado" />}
                {rows.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-blue-50/50 transition-colors">
                    <Td>{(data?.page! - 1) * pageSize + idx + 1}</Td>
                    <Td>
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className={cls('inline-flex h-2.5 w-2.5 rounded-full', p.active ? 'bg-emerald-500' : 'bg-gray-300')} />
                        {p.name}
                      </div>
                      <div className="text-xs text-gray-500">slug: {p.slug}</div>
                      {p.description && <div className="text-xs text-gray-500 line-clamp-1">{p.description}</div>}
                    </Td>
                    <Td>
                      <div className="font-medium text-gray-800">{p.cityName || '—'}</div>
                      <div className="text-xs text-gray-500">{p.state || ''}</div>
                    </Td>
                    <Td>
                      <div className="text-gray-700 flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />{p.address || '—'}</div>
                      {p.district && <div className="text-xs text-gray-500">Bairro: {p.district}</div>}
                      {p.zipCode && <div className="text-xs text-gray-500">CEP: {p.zipCode}</div>}
                    </Td>
                    <Td>
                      <div className="text-gray-700 flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" />{p.phone || '—'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2"><UserCircle2 className="w-4 h-4" />Resp.: {p.responsibleUserId || '—'}</div>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <EditPointButton point={p} onUpdated={load} />
                        <DeletePointButton point={p} onDeleted={load} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginação */}
        {data && data.pages > 1 && (
          <div className="mt-8">
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ===================== UI Miúdos ===================== */
function Th({ children, className = '' }: { children: any; className?: string }) {
  return <th className={cls('text-left px-6 py-4 text-sm font-semibold text-gray-900', className)}>{children}</th>
}
function Td({ children, className = '' }: { children: any; className?: string }) {
  return <td className={cls('px-6 py-4 text-sm align-top', className)}>{children}</td>
}
function LoadingRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">{label}</p>
        </div>
      </td>
    </tr>
  )
}
function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-gray-100 rounded-full">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">{label}</p>
          <p className="text-gray-400 text-sm">Tente ajustar filtros ou cadastre um novo ponto</p>
        </div>
      </td>
    </tr>
  )
}
function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="p-3 bg-blue-100 rounded-xl">{icon}</div>
      </div>
    </div>
  )
}
function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const prev = () => onChange(Math.max(1, page - 1))
  const next = () => onChange(Math.min(pages, page + 1))
  const label = useMemo(() => `Página ${page} de ${pages}`, [page, pages])
  return (
    <div className="flex items-center justify-center gap-4">
      <button className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg disabled:opacity-50 transition-all" onClick={prev} disabled={page <= 1}>
        <ChevronLeft className="w-4 h-4" /> Anterior
      </button>
      <div className="bg-white/70 px-4 py-2 rounded-xl border border-white/20 shadow-lg">
        <span className="text-gray-700 font-medium">{label}</span>
      </div>
      <button className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg disabled:opacity-50 transition-all" onClick={next} disabled={page >= pages}>
        Próxima <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

/* ===================== Dialogs: Pontos de Coleta ===================== */
function CreatePointButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all transform hover:scale-105"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-5 h-5" /> Novo Ponto
      </button>
      {open && (
        <PointDialog
          title="Novo Ponto"
          onClose={() => setOpen(false)}
          onSubmit={async (payload) => {
            const res = await fetch('/api/admin/collection-points', {
              method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
            })
            if (!res.ok) { alert(await res.text()); return }
            setOpen(false); onCreated()
          }}
        />
      )}
    </>
  )
}
function EditPointButton({ point, onUpdated }: { point: CollectionPoint; onUpdated: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200" onClick={() => setOpen(true)}>
        <Edit className="w-4 h-4" /> Editar
      </button>
      {open && (
        <PointDialog
          title="Editar Ponto"
          initial={point}
          onClose={() => setOpen(false)}
          onSubmit={async (payload) => {
            const res = await fetch(`/api/admin/collection-points/${point.id}`, {
              method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
            })
            if (!res.ok) { alert(await res.text()); return }
            setOpen(false); onUpdated()
          }}
        />
      )}
    </>
  )
}
function DeletePointButton({ point, onDeleted }: { point: CollectionPoint; onDeleted: () => void }) {
  const del = async () => {
    if (!confirm(`Excluir o ponto "${point.name}"?`)) return
    const res = await fetch(`/api/admin/collection-points/${point.id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) {
      // fallback: desativar
      const patch = await fetch(`/api/admin/collection-points/${point.id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active: false }) })
      if (!patch.ok) { alert(await patch.text()); return }
    }
    onDeleted()
  }
  return (
    <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200" onClick={del}>
      <Trash2 className="w-4 h-4" /> Excluir
    </button>
  )
}

function PointDialog({ title, initial, onClose, onSubmit }: {
  title: string
  initial?: Partial<CollectionPoint>
  onClose: () => void
  onSubmit: (payload: Partial<CollectionPoint>) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [district, setDistrict] = useState(initial?.district ?? '')
  const [cityName, setCityName] = useState(initial?.cityName ?? '')
  const [state, setState] = useState(initial?.state ?? '')
  const [zipCode, setZipCode] = useState(initial?.zipCode ?? '')
  const [lat, setLat] = useState(initial?.lat ?? ('' as any))
  const [lng, setLng] = useState(initial?.lng ?? ('' as any))
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [responsibleUserId, setResponsibleUserId] = useState(initial?.responsibleUserId ?? '')
  const [openingJson, setOpeningJson] = useState<any>(initial?.openingJson ?? '')
  const [active, setActive] = useState<boolean>(initial?.active ?? true)

  const submit = async () => {
    if (name.trim().length < 2) { alert('Nome deve ter pelo menos 2 caracteres'); return }
    if (slug.trim().length < 2) { alert('Slug deve ter pelo menos 2 caracteres'); return }

    const payload: Partial<CollectionPoint> = {
      name: name.trim(), slug: slug.trim(),
      description: description || null,
      address: address || null,
      district: district || null,
      cityName: cityName || null,
      state: state || null,
      zipCode: zipCode || null,
      lat: (lat === '' ? null : Number(lat)) as any,
      lng: (lng === '' ? null : Number(lng)) as any,
      phone: phone || null,
      responsibleUserId: responsibleUserId || null,
      openingJson: (typeof openingJson === 'string' ? (openingJson.trim() ? openingJson : null) : openingJson) as any,
      active,
    }
    await onSubmit(payload)
  }

  return (
    <Modal title={title} subtitle="Preencha os dados do ponto de coleta" onClose={onClose} onConfirm={submit} confirmText="Salvar Ponto">
      <div className="space-y-4">
        {/* Linha 1: Nome/Slug */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 sm:col-span-7">
            <Field label="Nome *">
              <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Igreja Central" />
            </Field>
          </div>
          <div className="col-span-12 sm:col-span-5">
            <Field label="Slug *">
              <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: igreja-central" />
            </Field>
          </div>
        </div>

        <Field label="Descrição">
          <textarea className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {/* Seção: Localização */}
        <details className="group rounded-2xl border border-gray-200 bg-white/70 open:bg-white/90 open:shadow-sm">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-700">Localização</span>
            <span className="text-xs text-gray-500 group-open:hidden">(mostrar)</span>
            <span className="text-xs text-gray-500 hidden group-open:inline">(ocultar)</span>
          </summary>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-8">
                <Field label="Endereço">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={address} onChange={(e) => setAddress(e.target.value)} />
                </Field>
              </div>
              <div className="col-span-12 sm:col-span-4">
                <Field label="Bairro">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={district} onChange={(e) => setDistrict(e.target.value)} />
                </Field>
              </div>
              <div className="col-span-12 sm:col-span-5">
                <Field label="Cidade">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={cityName} onChange={(e) => setCityName(e.target.value)} />
                </Field>
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Field label="UF">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" maxLength={2} placeholder="MG" value={state ?? ''} onChange={(e) => setState(e.target.value)} />
                </Field>
              </div>
              <div className="col-span-6 sm:col-span-4">
                <Field label="CEP">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={zipCode ?? ''} onChange={(e) => setZipCode(e.target.value)} />
                </Field>
              </div>
            </div>
          </div>
        </details>

        {/* Seção: Geolocalização (opcional) */}
        <details className="group rounded-2xl border border-gray-200 bg-white/70">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-700">Geolocalização (opcional)</summary>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-6 sm:col-span-3">
                <Field label="Latitude">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={lat as any} onChange={(e) => setLat(e.target.value)} />
                </Field>
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Field label="Longitude">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={lng as any} onChange={(e) => setLng(e.target.value)} />
                </Field>
              </div>
            </div>
          </div>
        </details>

        {/* Seção: Contato e Responsável */}
        <details className="group rounded-2xl border border-gray-200 bg-white/70" open>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-700">Contato e Responsável</summary>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-4">
                <Field label="Telefone">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} />
                </Field>
              </div>
              <div className="col-span-12 sm:col-span-8">
                <Field label="Responsável (User ID)">
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={responsibleUserId ?? ''} onChange={(e) => setResponsibleUserId(e.target.value)} placeholder="cuid do usuário (opcional)" />
                </Field>
              </div>
              <div className="col-span-12 sm:col-span-4">
                <Field label="Status">
                  <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={String(active)} onChange={(e) => setActive(e.target.value === 'true')}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </details>

        {/* Seção: Observações/horários (JSON) */}
        <details className="group rounded-2xl border border-gray-200 bg-white/70">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-700">Observações/Horários (JSON)</summary>
          <div className="px-4 pb-4">
            <textarea
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-xs"
              rows={5}
              value={typeof openingJson === 'string' ? openingJson : (openingJson ? JSON.stringify(openingJson, null, 2) : '')}
              onChange={(e) => {
                const val = e.target.value
                try { setOpeningJson(val ? JSON.parse(val) : '') } catch { setOpeningJson(val) }
              }}
              placeholder='Ex.: {"mon":"8h-17h","note":"Fechado aos domingos"}'
            />
          </div>
        </details>
      </div>
    </Modal>
  )
}


/* ===================== Modal + Field ===================== */
function Modal({ title, subtitle, onClose, onConfirm, confirmText, children }: {
  title: string; subtitle?: string; onClose: () => void; onConfirm: () => void; confirmText: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h[92vh] sm:max-h-[92vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 rounded-t-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{title}</h2>
              {subtitle && <p className="text-gray-600 mt-1 text-sm sm:text-base line-clamp-1">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl shrink-0">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 overflow-y-auto">
          {children}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3 sm:py-4 rounded-b-3xl">
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <button className="px-4 sm:px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-semibold" onClick={onClose}>Cancelar</button>
            <button className="px-4 sm:px-6 py-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 text-white rounded-xl font-semibold shadow-lg" onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  )
}
