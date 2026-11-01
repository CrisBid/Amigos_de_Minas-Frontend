'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ImagePlus, Loader2, Save, Upload, X } from 'lucide-react';
import CampaignFilter, { useAdminCampaign } from '@/components/Admin/CampaignFilter';
import ComposedImage from '@/components/media/ComposedImage';
import { composeConfigForFrame } from '@/components/media/composeConfig';

type Option = { id: string; name: string; state?: string | null; communityIds?: string[] };
type Frame = { id: string; url: string; name?: string | null; active?: boolean; config?: unknown };

const listOf = <T,>(j: any): T[] => (Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : []);
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';

function ageFromDate(iso: string) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return Math.max(0, a);
}

async function extractError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    if (body?.message) return Array.isArray(body.message) ? body.message.join(' ') : String(body.message);
  } catch {
    // sem corpo JSON
  }
  return fallback;
}

/**
 * Cadastro de UMA criança. Usa o mesmo envio do cadastro guiado (ID por campanha,
 * vínculo com a campanha, presente da campanha) e a foto é montada com o layout
 * da cidade na campanha (ou o padrão).
 */
export default function NewChildPage() {
  const router = useRouter();
  const { campaigns, campaignId, setCampaignId, ready } = useAdminCampaign();

  const [cities, setCities] = useState<Option[]>([]);
  const [communities, setCommunities] = useState<Option[]>([]);
  const [schools, setSchools] = useState<Option[]>([]);
  const [cityId, setCityId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [schoolId, setSchoolId] = useState('');

  const [publicId, setPublicId] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [ageText, setAgeText] = useState('');
  const [motherName, setMotherName] = useState('');
  const [category, setCategory] = useState('');
  const [wantedGift, setWantedGift] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  const [frame, setFrame] = useState<Frame | null>(null);
  const [idTakenBy, setIdTakenBy] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cidades
  useEffect(() => {
    (async () => {
      const r = await fetch('/api/admin/cities?limit=1000', { cache: 'no-store' }).catch(() => null);
      if (r?.ok) setCities(listOf<Option>(await r.json()).sort((a, b) => a.name.localeCompare(b.name)));
    })();
  }, []);

  // comunidades e escolas da cidade
  useEffect(() => {
    setCommunityId('');
    setSchoolId('');
    if (!cityId) { setCommunities([]); setSchools([]); return; }
    (async () => {
      const [rc, rs] = await Promise.all([
        fetch(`/api/admin/communities?cityId=${cityId}&pageSize=1000`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/admin/schools?cityId=${cityId}&pageSize=1000`, { cache: 'no-store' }).catch(() => null),
      ]);
      setCommunities(rc?.ok ? listOf<Option>(await rc.json()) : []);
      setSchools(rs?.ok ? listOf<Option>(await rs.json()) : []);
    })();
  }, [cityId]);

  // layout da cidade nesta campanha (senão o padrão) — usado na prévia e no envio da foto
  useEffect(() => {
    setFrame(null);
    if (!campaignId) return;
    (async () => {
      const [rf, rc] = await Promise.all([
        fetch(`/api/admin/campaigns/${campaignId}/layouts`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/admin/campaigns/${campaignId}/city-layouts`, { cache: 'no-store' }).catch(() => null),
      ]);
      const list: Frame[] = rf?.ok ? await rf.json() : [];
      const byCity: { cityId: string; frameId: string }[] = rc?.ok ? await rc.json() : [];
      const cityFrameId = byCity.find((l) => l.cityId === cityId)?.frameId;
      setFrame(list.find((f) => f.id === cityFrameId) ?? list.find((f) => f.active) ?? null);
    })();
  }, [campaignId, cityId]);

  // o ID não pode ser de outra criança (na campanha, ou no cadastro se não houver campanha)
  useEffect(() => {
    setIdTakenBy(null);
    if (!/^\d{1,9}$/.test(publicId.trim())) return;
    const n = parseInt(publicId, 10);
    const t = window.setTimeout(async () => {
      setCheckingId(true);
      try {
        const qs = new URLSearchParams({ q: String(n), take: '10' });
        if (campaignId) qs.set('campaignId', campaignId);
        const r = await fetch(`/api/admin/children?${qs.toString()}`, { cache: 'no-store' });
        const items: { name: string; publicId: number }[] = r.ok ? listOf(await r.json()) : [];
        setIdTakenBy(items.find((i) => i.publicId === n)?.name ?? null);
      } finally {
        setCheckingId(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [publicId, campaignId]);

  const age = birthDate ? ageFromDate(birthDate) : /^\d{1,2}$/.test(ageText) ? parseInt(ageText, 10) : null;
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ''), [photo]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const cityName = cities.find((c) => c.id === cityId)?.name ?? '';
  const communityName = communities.find((c) => c.id === communityId)?.name ?? '';
  const missing = [!cityId && 'cidade', !publicId.trim() && 'ID', name.trim().length < 2 && 'nome'].filter(Boolean) as string[];
  const canSave = ready && missing.length === 0 && !idTakenBy && !checkingId && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const pid = publicId.trim();
      const res = await fetch('/api/admin/children/bulk/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          children: [{
            publicId: pid,
            name: name.trim(),
            birthDate: birthDate || undefined,
            age: age ?? undefined,
            motherName: motherName.trim() || undefined,
            category: category.trim() || undefined,
            wantedGift: wantedGift.trim() || undefined,
            description: description.trim() || undefined,
          }],
          context: { cityId, communityId: communityId || null, schoolId: schoolId || null, campaignId: campaignId || null },
        }),
      });
      if (!res.ok) throw new Error(await extractError(res, 'Falha ao cadastrar a criança.'));
      const result: { ids?: Record<string, string> } = await res.json();
      const childId = result.ids?.[String(parseInt(pid, 10))];
      if (!childId) throw new Error('Cadastro feito, mas não recebi o identificador da criança.');

      if (photo && campaignId) {
        const fd = new FormData();
        fd.append('file', photo);
        fd.append('Config', JSON.stringify(composeConfigForFrame(frame?.config)));
        const qs = new URLSearchParams({ campaignId });
        if (frame?.id) qs.set('layoutId', frame.id);
        const up = await fetch(`/api/admin/children/${childId}/photo?${qs.toString()}`, { method: 'POST', body: fd });
        if (!up.ok) alert(`A criança foi cadastrada, mas a foto falhou: ${await extractError(up, 'erro no envio')}. Envie de novo pelo cadastro dela.`);
      }
      router.push(`/admin/children/${childId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao cadastrar a criança.');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Link href="/admin/children" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Crianças
        </Link>
        <Link href="/admin/children/bulk" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline">
          <Upload className="w-4 h-4" /> Várias crianças de uma vez? Use o cadastro guiado
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Nova criança</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="space-y-6">
          {/* Campanha e local */}
          <section className="bg-white rounded-2xl border p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Campanha e local</h2>
            <CampaignFilter campaigns={campaigns} value={campaignId} onChange={setCampaignId} className="w-full mb-4" />
            {!campaignId && (
              <p className="-mt-2 mb-4 text-xs text-amber-700">Sem campanha, a criança não aparece em nenhuma campanha e não é possível enviar foto.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="text-sm text-gray-700">
                Cidade *
                <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={`${inputCls} bg-white`}>
                  <option value="">Selecione…</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}{c.state ? `/${c.state}` : ''}</option>)}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Comunidade
                <select
                  value={communityId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCommunityId(next);
                    // escola que não atende a nova comunidade sai da seleção
                    const s = schools.find((x) => x.id === schoolId);
                    if (next && s?.communityIds?.length && !s.communityIds.includes(next)) setSchoolId('');
                  }}
                  disabled={!cityId} className={`${inputCls} bg-white disabled:bg-gray-50`}>
                  <option value="">Selecione…</option>
                  {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Escola
                <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} disabled={!cityId} className={`${inputCls} bg-white disabled:bg-gray-50`}>
                  <option value="">Selecione…</option>
                  {/* escolas que atendem a comunidade escolhida (ou sem comunidade definida) */}
                  {schools
                    .filter((s) => !communityId || !s.communityIds?.length || s.communityIds.includes(communityId))
                    .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
          </section>

          {/* Dados */}
          <section className="bg-white rounded-2xl border p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Dados da criança</h2>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <label className="sm:col-span-2 text-sm text-gray-700">
                {campaignId ? 'ID na campanha *' : 'ID *'}
                <input value={publicId} onChange={(e) => setPublicId(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${inputCls} font-mono ${idTakenBy ? 'border-red-400 bg-red-50' : ''}`} />
                {checkingId && <span className="block text-xs text-gray-400 mt-1">conferindo…</span>}
                {idTakenBy && <span className="block text-xs text-red-700 mt-1">Já usado por {idTakenBy}{campaignId ? ' nesta campanha' : ''}.</span>}
              </label>
              <label className="sm:col-span-4 text-sm text-gray-700">
                Nome *
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </label>
              <label className="sm:col-span-3 text-sm text-gray-700">
                Data de nascimento
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
              </label>
              <label className="sm:col-span-3 text-sm text-gray-700">
                Idade (anos)
                <input
                  value={birthDate ? String(age ?? '') : ageText}
                  onChange={(e) => setAgeText(e.target.value.replace(/\D/g, ''))}
                  disabled={!!birthDate}
                  inputMode="numeric"
                  className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-500`}
                  title={birthDate ? 'Calculada pela data de nascimento' : undefined}
                />
              </label>
              <label className="sm:col-span-6 text-sm text-gray-700">
                Nome da mãe
                <input value={motherName} onChange={(e) => setMotherName(e.target.value)} className={inputCls} />
              </label>
              <label className="sm:col-span-2 text-sm text-gray-700">
                Categoria
                <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="Ex.: ROUPAS" />
              </label>
              <label className="sm:col-span-4 text-sm text-gray-700">
                Presente
                <input value={wantedGift} onChange={(e) => setWantedGift(e.target.value)} className={inputCls} placeholder="Ex.: VESTIDO" />
              </label>
              <label className="sm:col-span-6 text-sm text-gray-700">
                Observações
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} min-h-[80px]`} />
              </label>
            </div>
          </section>
        </div>

        {/* Foto + prévia da arte */}
        <aside className="bg-white rounded-2xl border p-5 shadow-sm h-fit lg:sticky lg:top-6">
          <h2 className="font-semibold text-gray-900 mb-1">Foto</h2>
          <p className="text-xs text-gray-500 mb-3">
            {frame ? <>Montada com o layout <strong>{frame.name || 'sem nome'}</strong>.</> : campaignId ? 'A campanha não tem layout.' : 'Escolha uma campanha para enviar foto.'}
          </p>
          {photo && frame && photoUrl ? (
            <ComposedImage
              photoUrl={photoUrl}
              layoutUrl={frame.url}
              config={composeConfigForFrame(frame.config) as any}
              sample={{ name, publicId, ageText: age != null ? `${age} ${age === 1 ? 'ano' : 'anos'}` : '', wantedGift, cityName, communityName }}
              alt="Prévia da arte"
              className="w-full"
              imgClassName="rounded-xl shadow"
            />
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Foto" className="w-full rounded-xl shadow" />
          ) : (
            <div className="aspect-[4/5] rounded-xl border-2 border-dashed grid place-content-center text-sm text-gray-400">Sem foto</div>
          )}
          <div className="mt-3 flex gap-2">
            <label className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer bg-gray-900 text-white ${!campaignId ? 'opacity-50 pointer-events-none' : ''}`}>
              <ImagePlus className="w-4 h-4" /> {photo ? 'Trocar foto' : 'Escolher foto'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            </label>
            {photo && (
              <button onClick={() => setPhoto(null)} className="px-2.5 rounded-lg border text-gray-600 hover:bg-gray-50" title="Remover foto"><X className="w-4 h-4" /></button>
            )}
          </div>
        </aside>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {missing.length > 0 && <span className="text-sm text-gray-500">Falta: {missing.join(', ')}</span>}
        <Link href="/admin/children" className="px-4 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50">Cancelar</Link>
        <button
          onClick={save}
          disabled={!canSave}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : 'Cadastrar criança'}
        </button>
      </div>
    </div>
  );
}
