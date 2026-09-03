'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2, Users } from 'lucide-react';

type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'ARCHIVED';

type Campaign = {
  id: string;
  publicId?: number | null;
  name: string;
  slug: string;
  year?: number | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: CampaignStatus;
};

function toDateInput(s?: string | null) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function EditCampaignPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [status, setStatus] = useState<CampaignStatus>('DRAFT');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [publicId, setPublicId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/campaigns/${id}`, { cache: 'no-store', credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const c: Campaign = await res.json();
        if (cancelled) return;
        setName(c.name ?? '');
        setSlug(c.slug ?? '');
        setYear(c.year ?? '');
        setStatus(c.status ?? 'DRAFT');
        setStartDate(toDateInput(c.startDate));
        setEndDate(toDateInput(c.endDate));
        setDescription(c.description ?? '');
        setPublicId(c.publicId ?? null);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function extractError(res: Response, fallback: string) {
    try {
      const body = await res.json();
      if (body?.message) return Array.isArray(body.message) ? body.message.join(' ') : String(body.message);
    } catch {
      // sem corpo JSON
    }
    return fallback;
  }

  async function save() {
    if (!name.trim() || !slug.trim()) {
      alert('Nome e Slug são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        slug: slug.trim(),
        status,
      };
      if (year !== '') payload.year = Number(year);
      if (description.trim()) payload.description = description.trim();
      if (startDate) payload.startDate = new Date(startDate).toISOString();
      if (endDate) payload.endDate = new Date(endDate).toISOString();
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        alert(await extractError(res, 'Falha ao salvar alterações.'));
        return;
      }
      router.push('/admin/campaigns');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Excluir campanha "${name}"? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      alert(await extractError(res, 'Falha ao excluir.'));
      return;
    }
    router.push('/admin/campaigns');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Carregando campanha...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 font-semibold mb-4">Campanha não encontrada.</p>
          <a href="/admin/campaigns" className="text-blue-600 hover:underline">Voltar para a lista</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <a href="/admin/campaigns" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar para campanhas
        </a>

        <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/20 shadow-lg">
          <div className="border-b border-gray-100 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Editar Campanha</h1>
            <p className="text-gray-600 mt-1">{publicId ? `#${publicId} · ` : ''}{slug}</p>
          </div>

          <div className="px-6 py-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Nome da Campanha *</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Slug *</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Ano</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Status</label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 appearance-none cursor-pointer"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="ACTIVE">Ativa</option>
                  <option value="FINISHED">Finalizada</option>
                  <option value="ARCHIVED">Arquivada</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Data de Início</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Data de Fim</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Descrição</label>
              <textarea
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 min-h-[100px] resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Migração seletiva de crianças de outras campanhas */}
          <div className="border-t border-gray-100 px-6 py-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" />
                  <h2 className="text-lg font-bold text-gray-900">Crianças migradas de outras campanhas</h2>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Por padrão, cada campanha só mostra as crianças com foto publicada para ela. Use a tela de
                  migração para trazer crianças de uma campanha anterior — por cidade, comunidade ou selecionando
                  uma a uma.
                </p>
              </div>
              <a
                href={`/admin/campaigns/migrate-children?target=${id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold whitespace-nowrap transition-all duration-200"
              >
                Migrar crianças
              </a>
            </div>
          </div>

          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
            <button
              onClick={remove}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-xl border border-red-200 transition-colors duration-150"
            >
              <Trash2 className="w-4 h-4" />
              Excluir campanha
            </button>

            <div className="flex gap-3">
              <a
                href="/admin/campaigns"
                className="px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl font-semibold transition-all duration-200"
              >
                Cancelar
              </a>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
