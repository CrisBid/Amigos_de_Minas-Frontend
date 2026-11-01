'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Baby, CheckCircle2, Loader2, MapPin, Save, Undo2 } from 'lucide-react';
import ChildCampaigns from './ChildCampaigns';

/* ===================== Tipos ===================== */
type City = { id: string; publicId?: number | null; name: string; state?: string | null };
type Community = { id: string; cityId: string; name: string };
type School = { id: string; cityId: string; communityId?: string | null; name: string };

type ChildFull = {
  id: string;
  publicId?: number | null;
  name: string;
  birthDate?: string | null;
  age?: number | null;
  motherName?: string | null;
  cityId?: string | null;
  cityName?: string | null;
  communityId?: string | null;
  schoolId?: string | null;
  schoolLegacy?: string | null;
  category?: string | null;
  wantedGift?: string | null;
  photoUrl?: string | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  city?: City | null;
  community?: Community | null;
  school?: School | null;
};

// campos que o formulário edita (e que vão no PATCH)
const EDITABLE = [
  'publicId', 'name', 'birthDate', 'age', 'motherName', 'cityId', 'communityId', 'schoolId',
  'schoolLegacy', 'category', 'wantedGift', 'description',
] as const;
type Editable = Pick<ChildFull, (typeof EDITABLE)[number]>;

/* ===================== Helpers ===================== */
function toInputDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
function fromInputDate(d: string) {
  return d ? new Date(d + 'T00:00:00.000Z').toISOString() : null;
}
function calcAgeFromBirth(dateIso?: string | null) {
  if (!dateIso) return null;
  const dob = new Date(dateIso);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age < 0 ? 0 : age;
}
const pickEditable = (c: ChildFull): Editable =>
  Object.fromEntries(EDITABLE.map((k) => [k, c[k] ?? null])) as Editable;
const listOf = <T,>(j: any): T[] => (Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : []);

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';

/* ===================== Página ===================== */
export default function EditChildPage() {
  const params = useParams();
  const id = (params?.id as string) || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [child, setChild] = useState<ChildFull | null>(null);
  const [saved, setSaved] = useState<Editable | null>(null); // último estado salvo, para saber se há alterações

  const [cities, setCities] = useState<City[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);

  /* ---- Carregar registro e listas ---- */
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const [resChild, resCities] = await Promise.all([
          fetch(`/api/admin/children/${id}`, { cache: 'no-store' }),
          fetch(`/api/admin/cities?limit=1000`, { cache: 'no-store' }),
        ]);
        if (!resChild.ok) throw new Error('Erro ao carregar a criança.');
        const data: ChildFull = await resChild.json();
        setChild(data);
        setSaved(pickEditable(data));
        if (resCities.ok) setCities(listOf<City>(await resCities.json()));
        if (data.cityId) await reloadLocation(data.cityId, data.communityId ?? undefined);
      } catch (e) {
        console.error(e);
        setMsg({ type: 'err', text: 'Não foi possível carregar os dados.' });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function reloadLocation(cityId?: string, communityId?: string) {
    setLoadingLoc(true);
    try {
      // a API pagina em 20 por padrão: pede todas; com comunidade, vêm as escolas que a atendem
      const qsSchools = new URLSearchParams({ pageSize: '1000' });
      if (cityId) qsSchools.set('cityId', cityId);
      if (communityId) qsSchools.set('communityId', communityId);
      const [rc, rs] = await Promise.all([
        cityId ? fetch(`/api/admin/communities?cityId=${cityId}&pageSize=1000`, { cache: 'no-store' }) : null,
        fetch(`/api/admin/schools?${qsSchools.toString()}`, { cache: 'no-store' }),
      ]);
      setCommunities(rc?.ok ? listOf<Community>(await rc.json()) : []);
      setSchools(rs.ok ? listOf<School>(await rs.json()) : []);
    } finally {
      setLoadingLoc(false);
    }
  }

  /* ---- Formulário ---- */
  const update = (patch: Partial<ChildFull>) => setChild((c) => (c ? { ...c, ...patch } : c));

  const handleBirthChange = (v: string) => {
    const iso = fromInputDate(v);
    update({ birthDate: iso, age: calcAgeFromBirth(iso) });
  };

  const handleCityChange = async (cityId: string) => {
    update({ cityId: cityId || null, communityId: null, schoolId: null });
    await reloadLocation(cityId || undefined);
  };

  const handleCommunityChange = async (communityId: string) => {
    update({ communityId: communityId || null, schoolId: null });
    await reloadLocation(child?.cityId ?? undefined, communityId || undefined);
  };

  const dirty = useMemo(
    () => !!child && !!saved && JSON.stringify(pickEditable(child)) !== JSON.stringify(saved),
    [child, saved],
  );

  const discard = () => {
    if (!saved) return;
    update(saved);
    reloadLocation(saved.cityId ?? undefined, saved.communityId ?? undefined);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!child) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload = pickEditable(child);
      const res = await fetch(`/api/admin/children/${child.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setSaved(payload);
      setMsg({ type: 'ok', text: 'Dados atualizados com sucesso!' });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'err', text: 'Falha ao salvar os dados.' });
    } finally {
      setSaving(false);
    }
  };

  /* ---- Derivados ---- */
  const cityName = cities.find((c) => c.id === child?.cityId)?.name ?? child?.city?.name ?? child?.cityName ?? '';
  const communityName = communities.find((c) => c.id === child?.communityId)?.name ?? child?.community?.name ?? '';
  const ageText = child?.age != null ? `${child.age} ${child.age === 1 ? 'ano' : 'anos'}` : '';

  /* ---- UI ---- */
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8 flex items-center gap-3 text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando dados da criança…
      </div>
    );
  }

  if (!child) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">Criança não encontrada.</p>
        <Link href="/admin/children" className="inline-flex items-center gap-2 mt-4 text-blue-700 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28">
      <Link href="/admin/children" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-4 h-4" /> Crianças
      </Link>

      {/* Cabeçalho */}
      <header className="bg-white rounded-2xl border shadow-sm p-5 mb-6 flex items-center gap-4">
        {child.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={child.photoUrl} alt={child.name} className="w-16 h-16 rounded-xl object-cover border shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-blue-50 grid place-content-center shrink-0"><Baby className="w-7 h-7 text-blue-500" /></div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{child.name || 'Sem nome'}</h1>
          <p className="text-sm text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">#{child.publicId ?? '—'}</span>
            {ageText && <span>{ageText}</span>}
            {(cityName || communityName) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {[communityName, cityName].filter(Boolean).join(' · ')}
              </span>
            )}
          </p>
        </div>
      </header>

      {msg && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
            msg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Dados da criança */}
          <section className="lg:col-span-3 bg-white rounded-2xl border p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Dados da criança</h2>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <label className="sm:col-span-4 text-sm text-gray-700">
                Nome
                <input type="text" value={child.name || ''} onChange={(e) => update({ name: e.target.value })} className={inputCls} />
              </label>
              <label className="sm:col-span-2 text-sm text-gray-700">
                ID principal
                <input
                  type="number"
                  value={child.publicId ?? ''}
                  onChange={(e) => update({ publicId: e.target.value === '' ? null : parseInt(e.target.value) })}
                  className={`${inputCls} font-mono`}
                />
              </label>
              <label className="sm:col-span-3 text-sm text-gray-700">
                Data de nascimento
                <input type="date" value={toInputDate(child.birthDate)} onChange={(e) => handleBirthChange(e.target.value)} className={inputCls} />
              </label>
              <label className="sm:col-span-3 text-sm text-gray-700">
                Idade (anos)
                <input
                  type="number"
                  value={child.age ?? ''}
                  disabled={!!child.birthDate}
                  onChange={(e) => update({ age: e.target.value === '' ? null : parseInt(e.target.value) || 0 })}
                  className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-500`}
                  title={child.birthDate ? 'Calculada pela data de nascimento' : undefined}
                />
              </label>
              <label className="sm:col-span-6 text-sm text-gray-700">
                Nome da mãe
                <input type="text" value={child.motherName ?? ''} onChange={(e) => update({ motherName: e.target.value || null })} className={inputCls} />
              </label>
              <label className="sm:col-span-2 text-sm text-gray-700">
                Categoria
                <input type="text" value={child.category ?? ''} onChange={(e) => update({ category: e.target.value || null })} className={inputCls} placeholder="Ex.: ROUPAS" />
              </label>
              <label className="sm:col-span-4 text-sm text-gray-700">
                Presente atual
                <input type="text" value={child.wantedGift ?? ''} onChange={(e) => update({ wantedGift: e.target.value || null })} className={inputCls} placeholder="Ex.: VESTIDO" />
                <span className="block text-[11px] text-gray-500 mt-1">O presente de cada campanha fica na seção Campanhas.</span>
              </label>
              <label className="sm:col-span-6 text-sm text-gray-700">
                Observações
                <textarea
                  value={child.description ?? ''}
                  onChange={(e) => update({ description: e.target.value || null })}
                  className={`${inputCls} min-h-[80px]`}
                  placeholder="Informações adicionais da criança…"
                />
              </label>
            </div>
          </section>

          {/* Localização */}
          <section className="lg:col-span-2 bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Localização</h2>
              {loadingLoc && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            <div className="space-y-4">
              <label className="block text-sm text-gray-700">
                Cidade
                <select value={child.cityId ?? ''} onChange={(e) => handleCityChange(e.target.value)} className={`${inputCls} bg-white`}>
                  <option value="">Selecione…</option>
                  {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}{c.state ? `/${c.state}` : ''}</option>))}
                </select>
                {!!child.cityName && !child.cityId && <span className="block mt-1 text-xs text-gray-500">Cidade antiga: {child.cityName}</span>}
              </label>
              <label className="block text-sm text-gray-700">
                Comunidade
                <select value={child.communityId ?? ''} onChange={(e) => handleCommunityChange(e.target.value)} disabled={!child.cityId} className={`${inputCls} bg-white disabled:bg-gray-50`}>
                  <option value="">Selecione…</option>
                  {communities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </label>
              <label className="block text-sm text-gray-700">
                Escola
                <select value={child.schoolId ?? ''} onChange={(e) => update({ schoolId: e.target.value || null })} disabled={!child.cityId} className={`${inputCls} bg-white disabled:bg-gray-50`}>
                  <option value="">Selecione…</option>
                  {schools.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </label>
              <label className="block text-sm text-gray-700">
                Escola (texto livre)
                <input
                  type="text"
                  value={child.schoolLegacy ?? ''}
                  onChange={(e) => update({ schoolLegacy: e.target.value || null })}
                  className={inputCls}
                  placeholder="Quando a escola não estiver cadastrada"
                />
              </label>
            </div>
          </section>
        </div>
      </form>

      {/* Campanhas: arte, layout, ID/presente e apadrinhamentos por campanha */}
      <section className="mt-6 bg-white rounded-2xl border p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">Campanhas</h2>
        <p className="text-sm text-gray-500 mb-4">
          Cada campanha tem sua foto, layout (da cidade ou padrão), ID, presente e apadrinhamentos. A arte é mostrada como no site de apadrinhamento.
        </p>
        <ChildCampaigns
          childId={child.id}
          currentGift={child.wantedGift}
          fallbackPublicId={child.publicId}
          baseSample={{ name: child.name, ageText, cityName, communityName }}
        />
      </section>

      {/* Detalhes técnicos */}
      <details className="mt-6 bg-white rounded-2xl border p-5 shadow-sm text-sm">
        <summary className="cursor-pointer font-semibold text-gray-900">Detalhes do registro</summary>
        <dl className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><dt className="text-gray-500">ID interno</dt><dd className="font-mono break-all">{child.id}</dd></div>
          <div><dt className="text-gray-500">Criado em</dt><dd>{child.createdAt ? new Date(child.createdAt).toLocaleString('pt-BR') : '—'}</dd></div>
          <div><dt className="text-gray-500">Atualizado em</dt><dd>{child.updatedAt ? new Date(child.updatedAt).toLocaleString('pt-BR') : '—'}</dd></div>
          <div><dt className="text-gray-500">Excluído em</dt><dd>{child.deletedAt ? new Date(child.deletedAt).toLocaleString('pt-BR') : '—'}</dd></div>
        </dl>
      </details>

      {/* Barra de salvar: só aparece com alterações nos dados */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-gray-700">Alterações não salvas nos dados da criança</span>
            <div className="flex gap-2">
              <button type="button" onClick={discard} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-gray-50">
                <Undo2 className="w-4 h-4" /> Descartar
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
