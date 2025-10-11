'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Save,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  PencilRuler,
} from 'lucide-react';

// ajuste o alias conforme seu projeto:
import ComposedImage, { ComposeConfig } from '@/components/media/ComposedImage';
import { pickComposeInputsFromImages } from '@/components/media/pickComposeInputs';

/* ===================== Tipos ===================== */
type City = { id: string; publicId?: number | null; name: string; state?: string | null };
type Community = {
  id: string;
  publicId?: number | null;
  cityId: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  deletedAt?: string | null;
};
type School = {
  id: string;
  publicId?: number | null;
  cityId: string;
  communityId?: string | null;
  name: string;
  slug?: string | null;
  address?: string | null;
};

type ImageItem = {
  id: string;
  childId: string;
  campaignId: string;
  originalKey?: string | null;
  originalUrl?: string | null;
  processedKey?: string | null;
  processedUrl?: string | null;
  framedKey?: string | null;
  framedUrl?: string | null;
  layoutKey?: string | null;
  layoutUrl?: string | null;
  Config?: ComposeConfig | any;
  width?: number | null;
  height?: number | null;
  status?: string | null;
  notes?: string | null;
  version?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

type Sponsorship = {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED';
  campaignId: string;
  createdAt?: string;
  updatedAt?: string;
};

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
  photoKey?: string | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  city?: City | null;
  community?: Community | null;
  school?: School | null;
  sponsorships?: Sponsorship[];
  images?: ImageItem[];
};

type ComposeSample = {
  name?: string;
  publicId?: string | number;
  ageText?: string;
  wantedGift?: string;
  cityName?: string;
  communityName?: string;
};

/* ===================== Helpers ===================== */
function toInputDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}
function fromInputDate(d: string) {
  if (!d) return null;
  return new Date(d + 'T00:00:00.000Z').toISOString();
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
const DEFAULT_CFG: ComposeConfig = {
  version: 2,
  canvas: { width: 1080, height: 1920, background: null },
  layout: { resizeToCanvas: true, opacity: 1, onTop: true },
  photoRect: {
    x: 110, y: 410, width: 850, height: 1400,
    fit: 'cover', gravity: 'center', cornerRadius: 0,
    scale: 1, offsetX: 0, offsetY: 0,
  },
  texts: [],
};

/* ===================== Página ===================== */
export default function EditChildPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || '';
  const api = process.env.NEXT_PUBLIC_NEST_API_URL;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [child, setChild] = useState<ChildFull | null>(null);

  // Combos
  const [cities, setCities] = useState<City[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);

  // Mídia / composição
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [composeQuality, setComposeQuality] = useState<number>(0.9);

  // Editor
  const [showEditor, setShowEditor] = useState(false);

  /* ---- Carregar registro e listas ---- */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [resChild, resCities] = await Promise.all([
          fetch(`${api}/children/${id}`, { cache: 'no-store' }),
          fetch(`${api}/cities?limit=1000`, { cache: 'no-store' }),
        ]);
        if (!resChild.ok) throw new Error('Erro ao carregar a criança.');
        const data: ChildFull = await resChild.json();
        setChild(data);

        if (resCities.ok) {
          const cJson = await resCities.json();
          setCities(Array.isArray(cJson?.items) ? cJson.items : cJson ?? []);
        }

        if (data.cityId) {
          await reloadCommunities(data.cityId);
          await reloadSchools(data.cityId, data.communityId ?? undefined);
        }
      } catch (e) {
        console.error(e);
        setMsg({ type: 'err', text: 'Não foi possível carregar os dados.' });
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (child?.images?.length && !selectedImageId) {
      setSelectedImageId(child.images[0].id);
    }
  }, [child, selectedImageId]);

  const reloadCommunities = async (cityId: string) => {
    setLoadingLoc(true);
    try {
      const r = await fetch(`${api}/communities?cityId=${cityId}&limit=1000`, { cache: 'no-store' });
      const j = r.ok ? await r.json() : [];
      setCommunities(Array.isArray(j?.items) ? j.items : j ?? []);
    } finally {
      setLoadingLoc(false);
    }
  };

  const reloadSchools = async (cityId?: string, communityId?: string) => {
    setLoadingLoc(true);
    try {
      const qs = new URLSearchParams();
      if (cityId) qs.set('cityId', cityId);
      if (communityId) qs.set('communityId', communityId);
      qs.set('limit', '1000');
      const r = await fetch(`${api}/schools?${qs.toString()}`, { cache: 'no-store' });
      const j = r.ok ? await r.json() : [];
      setSchools(Array.isArray(j?.items) ? j.items : j ?? []);
    } finally {
      setLoadingLoc(false);
    }
  };

  /* ---- Helpers de formulário ---- */
  const setField = <K extends keyof ChildFull>(key: K, value: ChildFull[K]) => {
    if (!child) return;
    setChild({ ...child, [key]: value });
  };

  const handleBirthChange = (v: string) => {
    const iso = fromInputDate(v);
    const newAge = calcAgeFromBirth(iso);
    setChild((c) => (c ? { ...c, birthDate: iso, age: newAge } : c));
  };

  const handleAgeChange = (v: string) => {
    const n = v === '' ? null : parseInt(v) || 0;
    setChild((c) => {
      if (!c) return c;
      if (c.birthDate) return { ...c, age: calcAgeFromBirth(c.birthDate) };
      return { ...c, age: n };
    });
  };

  const handleCityChange = async (cityId: string) => {
    setField('cityId', cityId || null);
    setField('communityId', null);
    setField('schoolId', null);
    await reloadCommunities(cityId);
    await reloadSchools(cityId, undefined);
  };

  const handleCommunityChange = async (communityId: string) => {
    setField('communityId', communityId || null);
    await reloadSchools(child?.cityId ?? undefined, communityId || undefined);
    setField('schoolId', null);
  };

  /* ---- Salvar ---- */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!child) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: Partial<ChildFull> = {
        publicId: child.publicId ?? null,
        name: child.name,
        birthDate: child.birthDate ?? null,
        age: child.age ?? null,
        motherName: child.motherName ?? null,
        cityId: child.cityId ?? null,
        communityId: child.communityId ?? null,
        schoolId: child.schoolId ?? null,
        schoolLegacy: child.schoolLegacy ?? null,
        category: child.category ?? null,
        wantedGift: child.wantedGift ?? null,
        photoUrl: child.photoUrl ?? null,
        description: child.description ?? null,
      };

      const res = await fetch(`${api}/children/${child.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setMsg({ type: 'ok', text: 'Dados atualizados com sucesso!' });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'err', text: 'Falha ao salvar os dados.' });
    } finally {
      setSaving(false);
    }
  };

  /* ---- Derivados para ComposedImage ---- */
  const selectedImage = useMemo(() => {
    if (!child?.images) return null;
    return child.images.find((i) => i.id === selectedImageId) ?? child.images[0] ?? null;
  }, [child, selectedImageId]);

  const ageText = useMemo(() => {
    const a = child?.age ?? null;
    if (a === null || a === undefined) return '';
    return `${a} ${a === 1 ? 'ano' : 'anos'}`;
  }, [child?.age]);

  const sample: ComposeSample = useMemo(
    () => ({
      name: child?.name ?? '',
      publicId: child?.publicId ?? '',
      ageText,
      wantedGift: child?.wantedGift ?? '',
      cityName: child?.city?.name ?? child?.cityName ?? '',
      communityName: child?.community?.name ?? '',
    }),
    [child, ageText]
  );

  /* ---- UI ---- */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando dados da criança…
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <p className="text-gray-600">Criança não encontrada.</p>
        <Link href="/admin/children" className="inline-flex items-center gap-2 mt-4 text-blue-700 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin/children" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Editar Criança #{child.publicId ?? '—'}</h1>
      </div>

      {/* Alertas */}
      {msg && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
            msg.type === 'ok'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Seção: Dados Gerais */}
        <section className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Dados Gerais</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700">ID público</label>
              <input
                type="number"
                value={child.publicId ?? ''}
                onChange={(e) => setField('publicId', e.target.value === '' ? null : parseInt(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 mt-1"
                placeholder="ex.: 898"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700">Nome</label>
              <input
                type="text"
                value={child.name || ''}
                onChange={(e) => setField('name', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mt-1"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">Data de Nascimento</label>
              <input
                type="date"
                value={toInputDate(child.birthDate)}
                onChange={(e) => handleBirthChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mt-1"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700">Idade (anos)</label>
              <input
                type="number"
                value={child.age ?? ''}
                onChange={(e) => handleAgeChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mt-1"
                placeholder="Se DN preenchida, calculamos automático"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700">Nome da mãe</label>
              <input
                type="text"
                value={child.motherName ?? ''}
                onChange={(e) => setField('motherName', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 mt-1"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">Categoria</label>
              <input
                type="text"
                value={child.category ?? ''}
                onChange={(e) => setField('category', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 mt-1"
                placeholder="Ex.: ROUPAS"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700">Presente desejado</label>
              <input
                type="text"
                value={child.wantedGift ?? ''}
                onChange={(e) => setField('wantedGift', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 mt-1"
                placeholder="Ex.: VESTIDO"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm text-gray-700">Descrição / Observações</label>
              <textarea
                value={child.description ?? ''}
                onChange={(e) => setField('description', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 mt-1 min-h-[90px]"
                placeholder="Informações adicionais da criança…"
              />
            </div>
          </div>
        </section>

        {/* Seção: Localização */}
        <section className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Localização</h2>
            {loadingLoc && (
              <span className="text-xs text-gray-500 inline-flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Atualizando listas…
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700">Cidade</label>
              <select
                value={child.cityId ?? ''}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mt-1 bg-white"
              >
                <option value="">Selecione…</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.state ? `/${c.state}` : ''}
                  </option>
                ))}
              </select>
              {!!child.cityName && !child.cityId && (
                <p className="mt-1 text-xs text-gray-500">Cidade legada: {child.cityName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-700">Comunidade</label>
              <select
                value={child.communityId ?? ''}
                onChange={(e) => handleCommunityChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mt-1 bg-white"
                disabled={!child.cityId}
              >
                <option value="">Selecione…</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-700">Escola</label>
              <select
                value={child.schoolId ?? ''}
                onChange={(e) => setField('schoolId', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 mt-1 bg-white"
                disabled={!child.cityId}
              >
                <option value="">Selecione…</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="mt-2">
                <label className="block text-xs text-gray-500">Escola (legado / texto livre)</label>
                <input
                  type="text"
                  value={child.schoolLegacy ?? ''}
                  onChange={(e) => setField('schoolLegacy', e.target.value || null)}
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  placeholder="Preencha quando não houver escola cadastrada"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Seção: Mídia com ComposedImage + Editor */}
        <section className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Mídia (Composição)</h2>
            {selectedImage && (
              <span className="text-xs text-gray-500">
                Imagem selecionada: <code className="font-mono">{selectedImage.id}</code>
              </span>
            )}
          </div>

          {/* Controles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-700">Imagem vinculada</label>
              <select
                value={selectedImageId ?? ''}
                onChange={(e) => setSelectedImageId(e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 mt-1 bg-white"
              >
                {(child.images ?? []).map((img) => {
                  const label =
                    (img.framedUrl && 'framed') ||
                    (img.processedUrl && 'processed') ||
                    (img.originalUrl && 'original') || '—';
                  return (
                    <option key={img.id} value={img.id}>
                      {img.id.slice(0, 10)}… · {label}
                    </option>
                  );
                })}
              </select>
              {(child.images ?? []).length === 0 && (
                <p className="mt-1 text-xs text-gray-500">Nenhuma imagem vinculada a este registro.</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-700">Qualidade da composição</label>
              <input
                type="range"
                min={0.6}
                max={1}
                step={0.05}
                value={composeQuality}
                onChange={(e) => setComposeQuality(parseFloat(e.target.value))}
                className="w-full mt-3"
              />
              <div className="text-xs text-gray-500 mt-1">JPEG {Math.round(composeQuality * 100)}%</div>
            </div>

            <div>
              <label className="block text-sm text-gray-700">URL da foto principal (photoUrl)</label>
              <input
                type="text"
                value={child.photoUrl ?? ''}
                onChange={(e) => setField('photoUrl', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 mt-1"
                placeholder="https://… (persistido no registro)"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {selectedImage?.framedUrl && (
                  <button
                    type="button"
                    onClick={() => setField('photoUrl', selectedImage.framedUrl!)}
                    className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
                  >
                    Usar framedUrl
                  </button>
                )}
                {selectedImage?.processedUrl && (
                  <button
                    type="button"
                    onClick={() => setField('photoUrl', selectedImage.processedUrl!)}
                    className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
                  >
                    Usar processedUrl
                  </button>
                )}
                {selectedImage?.originalUrl && (
                  <button
                    type="button"
                    onClick={() => setField('photoUrl', selectedImage.originalUrl!)}
                    className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
                  >
                    Usar originalUrl
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preview + thumbs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview composto */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-gray-50 border-b px-3 py-2 text-sm text-gray-600 flex items-center justify-between">
                <span>Pré-visualização (frontend)</span>
                <button
                  type="button"
                  disabled={!selectedImage}
                  onClick={() => setShowEditor(true)}
                  className="inline-flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <PencilRuler className="w-4 h-4" /> Editar composição
                </button>
              </div>
              <div className="p-3">
                {selectedImage ? (
                  <ComposedImage
                    photoUrl={selectedImage.processedUrl || selectedImage.originalUrl || ''}
                    layoutUrl={selectedImage.layoutUrl || ''}
                    config={(selectedImage.Config as ComposeConfig) ?? DEFAULT_CFG}
                    sample={{
                      name: sample.name,
                      publicId: sample.publicId,
                      ageText: sample.ageText,
                      wantedGift: sample.wantedGift,
                      cityName: sample.cityName,
                      communityName: sample.communityName,
                    }}
                    fallbackUrl={selectedImage.framedUrl || child.photoUrl || null}
                    alt={`Pré-visualização ${child.name}`}
                    className="w-full max-w-md mx-auto aspect-[9/16]"
                    imgClassName="rounded-lg shadow"
                    quality={composeQuality}
                  />
                ) : (
                  <div className="h-80 grid place-content-center text-gray-400">Nenhuma imagem selecionada</div>
                )}
              </div>
            </div>

            {/* Thumbs / ações rápidas */}
            <div className="bg-gray-50 border rounded-xl">
              <div className="px-3 py-2 border-b text-sm text-gray-600">Arquivos vinculados</div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(child.images ?? []).map((img) => {
                  const best = img.framedUrl || img.processedUrl || img.originalUrl || '';
                  const tag =
                    (img.framedUrl && 'framed') ||
                    (img.processedUrl && 'processed') ||
                    (img.originalUrl && 'original') || '';
                  return (
                    <button
                      type="button"
                      key={img.id}
                      onClick={() => setSelectedImageId(img.id)}
                      className={`border rounded-lg overflow-hidden text-left hover:ring-2 hover:ring-blue-400 ${
                        selectedImageId === img.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      title={img.id}
                    >
                      {best ? (
                        <img src={best} alt={img.id} className="w-full h-36 object-cover" />
                      ) : (
                        <div className="h-36 grid place-content-center text-gray-400">—</div>
                      )}
                      <div className="p-2 text-xs flex items-center justify-between">
                        <span className="text-gray-600">{tag}</span>
                        {best && (
                          <a href={best} target="_blank" className="text-blue-700 hover:underline">
                            abrir <ExternalLink className="inline-block w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </button>
                  );
                })}
                {(child.images ?? []).length === 0 && (
                  <div className="text-sm text-gray-500">Nenhuma imagem vinculada.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Seção: Patrocínios */}
        <section className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Patrocínios</h2>
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">ID</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Campanha</th>
                  <th className="text-left px-3 py-2">Criado em</th>
                  <th className="text-left px-3 py-2">Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                {(child.sponsorships ?? []).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2">{s.id}</td>
                    <td className="px-3 py-2">{s.status}</td>
                    <td className="px-3 py-2">{s.campaignId}</td>
                    <td className="px-3 py-2">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2">{s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {(child.sponsorships ?? []).length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-gray-500" colSpan={5}>Sem patrocínios vinculados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Seção: Metadados */}
        <section className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Metadados</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-gray-500">ID</span>
              <span className="font-mono">{child.id}</span>
            </div>
            <div>
              <span className="block text-gray-500">Criado em</span>
              <span>{child.createdAt ? new Date(child.createdAt).toLocaleString() : '—'}</span>
            </div>
            <div>
              <span className="block text-gray-500">Atualizado em</span>
              <span>{child.updatedAt ? new Date(child.updatedAt).toLocaleString() : '—'}</span>
            </div>
            <div>
              <span className="block text-gray-500">Excluído em</span>
              <span>{child.deletedAt ? new Date(child.deletedAt).toLocaleString() : '—'}</span>
            </div>
          </div>
        </section>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/children')}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>

      {/* MODAL: Editor de Foto/Composição */}
      {showEditor && selectedImage && (
        <EditorComposicaoModal
          image={selectedImage}
          sample={sample}
          onClose={() => setShowEditor(false)}
          onSaved={(updatedCfg) => {
            // atualiza no estado local
            setChild((c) => {
              if (!c) return c;
              const imgs = (c.images ?? []).map((im) =>
                im.id === selectedImage.id ? { ...im, Config: updatedCfg } : im
              );
              return { ...c, images: imgs };
            });
          }}
          apiBase={api!}
        />
      )}
    </div>
  );
}

/* ============================================================
   MODAL: Editor de Composição (foco em photoRect / scale / offsets)
============================================================ */
function EditorComposicaoModal({
  image,
  sample,
  onClose,
  onSaved,
  apiBase,
}: {
  image: ImageItem;
  sample: ComposeSample;
  onClose: () => void;
  onSaved: (cfg: ComposeConfig) => void;
  apiBase: string;
}) {
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<ComposeConfig>(() => {
    const cfg = (image?.Config as ComposeConfig) ?? DEFAULT_CFG;
    const inLayout = cfg.layout ?? {};
    return {
      version: cfg.version ?? 2,
      canvas: cfg.canvas ?? DEFAULT_CFG.canvas,
      layout: {
        ...inLayout,
        onTop: inLayout.onTop ?? true,
        opacity: inLayout.opacity ?? 1,
        resizeToCanvas: inLayout.resizeToCanvas ?? true,
      },
      photoRect: { ...DEFAULT_CFG.photoRect, ...(cfg.photoRect ?? {}) },
      texts: Array.isArray(cfg.texts) ? cfg.texts : [],
    };
  });



  const pr = local.photoRect;
  const layoutUrl = image.layoutUrl || '';
  const fotoPreviewUrl = image.processedUrl || image.originalUrl || '';
  const [scale, setScale] = useState(1);
  const hostRef = useRef<HTMLDivElement>(null);

  // auto-scale do viewport
  useEffect(() => {
    const recompute = () => {
      const el = hostRef.current;
      if (!el) return;
      const pad = 16;
      const availW = el.clientWidth - pad;
      const availH = el.clientHeight - pad;
      const s = Math.min(availW / local.canvas.width, availH / local.canvas.height, 1);
      setScale(isFinite(s) && s > 0 ? s : 1);
    };
    recompute();
    let ro: ResizeObserver | null = null;

    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => recompute());
      if (hostRef.current) ro.observe(hostRef.current);
    }

    window.addEventListener('resize', recompute);
    return () => {
      if (ro && hostRef.current) ro.unobserve(hostRef.current);
      window.removeEventListener('resize', recompute);
    };
  }, [local.canvas.width, local.canvas.height]);

  const setPhoto = (p: Partial<ComposeConfig['photoRect']>) =>
    setLocal((prev) => ({ ...prev, photoRect: { ...prev.photoRect, ...p } }));

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const base = { x: pr.x, y: pr.y };
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      setPhoto({
        x: Math.max(0, Math.min(local.canvas.width - pr.width, base.x + dx)),
        y: Math.max(0, Math.min(local.canvas.height - pr.height, base.y + dy)),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const base = { w: pr.width, h: pr.height };
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      setPhoto({
        width: Math.max(60, Math.min(local.canvas.width - pr.x, base.w + dx)),
        height: Math.max(60, Math.min(local.canvas.height - pr.y, base.h + dy)),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // atualiza o Config no backend
      const res = await fetch(`${apiBase}/images/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Config: local }), // campo respeitando seu payload
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      onSaved(local);
      onClose();
    } catch (e) {
      alert('Falha ao salvar configuração da imagem.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-white w-full max-w-6xl h-[90vh] lg:h-[86vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 border-b flex items-center justify-between shrink-0 bg-white">
          <h3 className="font-semibold text-lg">Editor de Composição</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border">Fechar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 flex-1 min-h-0"> 
          {/* Canvas/guia */}
            <div className="lg:col-span-2 p-4">
              <div
                ref={hostRef}
                className="relative mx-auto border rounded-xl bg-gray-100"
                style={{ maxHeight: '75vh', overflow: 'auto', padding: 8 }}
              >
              <div
                className="relative mx-auto overflow-hidden rounded-xl shadow"
                style={{ width: local.canvas.width * scale, height: local.canvas.height * scale }}
              >
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: local.canvas.width,
                    height: local.canvas.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    backgroundImage: `url(${layoutUrl})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: local.layout?.resizeToCanvas ? '100% 100%' : 'contain',
                    opacity: local.layout?.opacity ?? 1,
                  }}
                >
                  {/* área de foto (arrastar/redimensionar) */}
                  <div
                    className="absolute border-2 border-blue-500/80 bg-blue-300/10 cursor-move"
                    style={{ left: pr.x, top: pr.y, width: pr.width, height: pr.height }}
                    onMouseDown={startDrag}
                    title="Área da foto"
                  >
                    <div
                      className="absolute w-3 h-3 bg-blue-600 right-[-6px] bottom-[-6px] cursor-se-resize"
                      onMouseDown={startResize}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Prévia renderizada com seu ComposedImage (lado a lado) */}
            <div className="mt-4 border rounded-xl overflow-hidden">
              <div className="bg-gray-50 border-b px-3 py-2 text-sm text-gray-600">Prévia</div>
              <div className="p-3">
                <ComposedImage
                  photoUrl={fotoPreviewUrl}
                  layoutUrl={layoutUrl}
                  config={local}
                  sample={{
                    name: sample.name,
                    publicId: sample.publicId,
                    ageText: sample.ageText,
                    wantedGift: sample.wantedGift,
                    cityName: sample.cityName,
                    communityName: sample.communityName,
                  }}
                  fallbackUrl={image.framedUrl || null}
                  alt="Preview composição"
                  className="w-full max-w-md mx-auto aspect-[9/16]"
                  imgClassName="rounded-lg shadow"
                  quality={0.9}
                />
              </div>
            </div>
          </div>

          {/* Painel de propriedades */}
          <div className="p-4 border-l bg-gray-50 space-y-6 max-h-[80vh] overflow-auto">
            <div className="space-y-2">
              <div className="font-semibold">Canvas / Layout</div>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput
                  label="Largura"
                  value={local.canvas.width}
                  onChange={(v) => setLocal((c) => ({ ...c, canvas: { ...c.canvas, width: v } }))}
                />
                <NumberInput
                  label="Altura"
                  value={local.canvas.height}
                  onChange={(v) => setLocal((c) => ({ ...c, canvas: { ...c.canvas, height: v } }))}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!local.layout?.resizeToCanvas}
                  onChange={(e) => setLocal((c) => ({ ...c, layout: { ...c.layout, resizeToCanvas: e.target.checked } }))}
                />
                Redimensionar layout para o canvas
              </label>
              <label className="text-sm block">
                Opacidade do layout
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={local.layout?.opacity ?? 1}
                  onChange={(e) => setLocal((c) => ({ ...c, layout: { ...c.layout, opacity: parseFloat(e.target.value) } }))}
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="font-semibold">Foto (photoRect)</div>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="X" value={pr.x} onChange={(v) => setPhoto({ x: v })} />
                <NumberInput label="Y" value={pr.y} onChange={(v) => setPhoto({ y: v })} />
                <NumberInput label="Largura" value={pr.width} onChange={(v) => setPhoto({ width: v })} />
                <NumberInput label="Altura" value={pr.height} onChange={(v) => setPhoto({ height: v })} />
                <NumberInput label="Scale" step={0.05} value={pr.scale ?? 1} onChange={(v) => setPhoto({ scale: v })} />
                <NumberInput label="Cantos" value={pr.cornerRadius ?? 0} onChange={(v) => setPhoto({ cornerRadius: v })} />
                <NumberInput label="offX" value={pr.offsetX ?? 0} onChange={(v) => setPhoto({ offsetX: v })} />
                <NumberInput label="offY" value={pr.offsetY ?? 0} onChange={(v) => setPhoto({ offsetY: v })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  Fit
                  <select
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={pr.fit}
                    onChange={(e) => setPhoto({ fit: e.target.value as ComposeConfig['photoRect']['fit'] })}
                  >
                    {['cover', 'contain', 'fill', 'inside', 'outside'].map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Gravity
                  <select
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={pr.gravity}
                    onChange={(e) => setPhoto({ gravity: e.target.value as any })}
                  >
                    {['north','northeast','east','southeast','south','southwest','west','northwest','center'].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="pt-2 border-t">
              <button
                onClick={() => setLocal((c) => ({ ...c }))}
                className="px-3 py-1.5 rounded-lg border"
              >
                Aplicar no preview
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== UI helpers ===================== */
function NumberInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="text-sm text-gray-600 block">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full border rounded px-2 py-1"
      />
    </label>
  );
}