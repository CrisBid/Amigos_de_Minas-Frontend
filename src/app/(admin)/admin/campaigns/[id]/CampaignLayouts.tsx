'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, LayoutTemplate, Loader2, PencilRuler, Search, Star, Trash2 } from 'lucide-react';
import { composeConfigForFrame } from '@/components/media/composeConfig';
import ComposerModal from '@/components/media/ComposerModal';
import { placeholderPhoto, SAMPLE_CHILD } from '@/components/media/LayoutComposer';

type Frame = { id: string; url: string; name?: string | null; active?: boolean; config?: unknown };
type City = { id: string; name: string; state?: string | null };
type CityLayout = { cityId: string; frameId: string };

async function extractError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    if (body?.message) return Array.isArray(body.message) ? body.message.join(' ') : String(body.message);
  } catch {
    // sem corpo JSON
  }
  return fallback;
}

const frameLabel = (f: Frame, i: number) => f.name?.trim() || `Layout ${i + 1}`;

/**
 * Layouts (molduras) da campanha e qual deles cada cidade usa. Ao montar a foto
 * de uma criança vale o layout da cidade dela; sem escolha, o padrão da campanha.
 */
export default function CampaignLayouts({ campaignId }: { campaignId: string }) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [byCity, setByCity] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingCity, setSavingCity] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState('');

  // enquadramento padrão do layout (vale para toda foto nova montada com ele)
  const [configuring, setConfiguring] = useState<Frame | null>(null);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [samplePhoto, setSamplePhoto] = useState('');
  useEffect(() => { setSamplePhoto(placeholderPhoto()); }, []);

  async function loadFrames() {
    const res = await fetch(`/api/admin/campaigns/${campaignId}/layouts`, { cache: 'no-store', credentials: 'include' });
    if (!res.ok) throw new Error(await extractError(res, 'Falha ao carregar layouts.'));
    const list: Frame[] = await res.json();
    setFrames(Array.isArray(list) ? list : []);
  }

  async function loadCityLayouts() {
    const res = await fetch(`/api/admin/campaigns/${campaignId}/city-layouts`, { cache: 'no-store', credentials: 'include' });
    if (!res.ok) throw new Error(await extractError(res, 'Falha ao carregar layouts por cidade.'));
    const list: CityLayout[] = await res.json();
    setByCity(Object.fromEntries(list.map((l) => [l.cityId, l.frameId])));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const citiesRes = await fetch('/api/admin/cities', { cache: 'no-store', credentials: 'include' });
        if (citiesRes.ok) {
          const data = await citiesRes.json();
          const list: City[] = Array.isArray(data) ? data : (data?.items ?? []);
          setCities(list.sort((a, b) => a.name.localeCompare(b.name)));
        }
        await Promise.all([loadFrames(), loadCityLayouts()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar layouts.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const defaultFrame = frames.find((f) => f.active) ?? null;
  const frameIndex = useMemo(() => new Map(frames.map((f, i) => [f.id, i])), [frames]);
  const nameOf = (id?: string | null) => {
    const i = id ? frameIndex.get(id) : undefined;
    return i === undefined ? '—' : frameLabel(frames[i], i);
  };

  async function upload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      if (uploadName.trim()) fd.append('name', uploadName.trim());
      // o enquadramento (posição da foto e textos) começa igual ao do layout padrão, sempre completo
      fd.append('config', JSON.stringify(composeConfigForFrame(defaultFrame?.config)));
      const res = await fetch(`/api/admin/campaigns/${campaignId}/layouts`, { method: 'POST', credentials: 'include', body: fd });
      if (!res.ok) throw new Error(await extractError(res, 'Falha ao enviar layout.'));
      const created: Frame = await res.json();
      // primeiro layout da campanha vira o padrão
      if (!defaultFrame && created?.id) {
        await fetch(`/api/admin/campaign-frames/${created.id}/set-active`, { method: 'POST', credentials: 'include' });
      }
      setUploadFile(null);
      setUploadName('');
      await loadFrames();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Falha ao enviar layout.');
    } finally {
      setUploading(false);
    }
  }

  async function makeDefault(frameId: string) {
    const res = await fetch(`/api/admin/campaign-frames/${frameId}/set-active`, { method: 'POST', credentials: 'include' });
    if (!res.ok) { alert(await extractError(res, 'Falha ao definir o layout padrão.')); return; }
    await loadFrames();
  }

  async function removeFrame(frame: Frame, index: number) {
    const usedBy = cities.filter((c) => byCity[c.id] === frame.id).map((c) => c.name);
    const msg = usedBy.length
      ? `Excluir "${frameLabel(frame, index)}"? ${usedBy.length} cidade(s) que usam este layout voltam para o padrão da campanha: ${usedBy.join(', ')}.`
      : `Excluir "${frameLabel(frame, index)}"?`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/admin/campaign-frames/${frame.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { alert(await extractError(res, 'Falha ao excluir layout.')); return; }
    await Promise.all([loadFrames(), loadCityLayouts()]);
  }

  async function setCityLayout(cityId: string, frameId: string) {
    setSavingCity(cityId);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/city-layouts/${cityId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ frameId: frameId || null }),
      });
      if (!res.ok) throw new Error(await extractError(res, 'Falha ao salvar o layout da cidade.'));
      setByCity((prev) => {
        const next = { ...prev };
        if (frameId) next[cityId] = frameId; else delete next[cityId];
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Falha ao salvar o layout da cidade.');
    } finally {
      setSavingCity(null);
    }
  }

  async function saveFrameConfig(frame: Frame, config: unknown) {
    const res = await fetch(`/api/admin/campaign-frames/${frame.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    if (!res.ok) { alert(await extractError(res, 'Falha ao salvar o enquadramento do layout.')); return; }

    if (applyToExisting) {
      const r2 = await fetch(`/api/admin/campaign-frames/${frame.id}/apply-to-images`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!r2.ok) alert(await extractError(r2, 'O layout foi salvo, mas não consegui aplicar às fotos já enviadas.'));
      else {
        const { updated } = await r2.json().catch(() => ({ updated: 0 }));
        alert(`Enquadramento salvo e aplicado a ${updated} foto(s) já enviada(s) com este layout.`);
      }
    }
    setConfiguring(null);
    setApplyToExisting(false);
    await loadFrames();
  }

  // cidades que usam o layout: escolhido para elas, ou sem escolha quando ele é o padrão
  const citiesUsing = (frame: Frame) =>
    cities.filter((c) => (byCity[c.id] ? byCity[c.id] === frame.id : !!frame.active)).map((c) => c.name);

  const q = cityQuery.trim().toLowerCase();
  const shownCities = cities.filter((c) => !q || c.name.toLowerCase().includes(q));

  return (
    <div className="border-t border-gray-100 px-6 py-6">
      <div className="flex items-center gap-2">
        <LayoutTemplate className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-bold text-gray-900">Layouts por cidade</h2>
      </div>
      <p className="text-sm text-gray-600 mt-1">
        Ao montar a foto de uma criança (cadastro guiado, migração ou troca de foto), o sistema usa o layout da cidade
        dela. Cidades sem escolha usam o layout padrão da campanha.
      </p>

      {error && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Carregando layouts…</div>
      ) : (
        <>
          {/* Biblioteca de layouts */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {frames.map((f, i) => (
              <div key={f.id} className={`rounded-xl border overflow-hidden bg-white ${f.active ? 'ring-2 ring-blue-500' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={frameLabel(f, i)} className="w-full aspect-[4/5] object-contain bg-gray-50" />
                <div className="p-2 text-xs">
                  <p className="font-semibold text-gray-900 truncate" title={frameLabel(f, i)}>{frameLabel(f, i)}</p>
                  <p className={`mt-0.5 ${f.config ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {f.config ? 'Enquadramento configurado' : 'Sem enquadramento'}
                  </p>
                  <button
                    onClick={() => setConfiguring(f)}
                    className="mt-1.5 w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border hover:bg-gray-50"
                  >
                    <PencilRuler className="w-3.5 h-3.5" /> Configurar enquadramento
                  </button>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    {f.active ? (
                      <span className="inline-flex items-center gap-1 text-blue-700"><Star className="w-3 h-3" /> Padrão</span>
                    ) : (
                      <button onClick={() => makeDefault(f.id)} className="text-blue-700 hover:underline">Tornar padrão</button>
                    )}
                    <button onClick={() => removeFrame(f, i)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Excluir layout">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Enviar novo */}
            <div className="rounded-xl border border-dashed p-3 flex flex-col gap-2 justify-center text-sm">
              <label className="cursor-pointer inline-flex items-center gap-2 text-blue-700 hover:underline">
                <ImagePlus className="w-4 h-4" />
                {uploadFile ? <span className="truncate">{uploadFile.name}</span> : 'Escolher arquivo'}
                <input
                  type="file"
                  accept="image/png,image/webp,image/jpeg"
                  className="hidden"
                  onChange={(e) => { setUploadFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
                />
              </label>
              <input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Nome (ex.: Bonito)"
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={upload}
                disabled={!uploadFile || uploading}
                className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Enviar layout
              </button>
              <p className="text-[11px] text-gray-500">
                O enquadramento (posição da foto e textos) começa igual ao do layout padrão e pode ser ajustado no cadastro guiado.
              </p>
            </div>
          </div>

          {/* Layout de cada cidade */}
          {frames.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">Layout de cada cidade</h3>
                {cities.length > 8 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      value={cityQuery}
                      onChange={(e) => setCityQuery(e.target.value)}
                      placeholder="Buscar cidade…"
                      className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
              <div className="rounded-xl border divide-y bg-white">
                {shownCities.map((c) => {
                  const chosen = byCity[c.id] ?? '';
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-sm text-gray-800">{c.name}{c.state ? `/${c.state}` : ''}</span>
                      <div className="flex items-center gap-2">
                        {savingCity === c.id && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                        {chosen && savingCity !== c.id && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        <select
                          value={chosen}
                          onChange={(e) => setCityLayout(c.id, e.target.value)}
                          disabled={savingCity === c.id}
                          className="p-1.5 border border-gray-300 rounded-lg bg-white text-sm max-w-[220px]"
                        >
                          <option value="">Padrão da campanha ({nameOf(defaultFrame?.id)})</option>
                          {frames.map((f, i) => (<option key={f.id} value={f.id}>{frameLabel(f, i)}</option>))}
                        </select>
                        {(() => {
                          const used = frames.find((f) => f.id === chosen) ?? defaultFrame;
                          return used ? (
                            <button
                              onClick={() => setConfiguring(used)}
                              className="p-1.5 rounded-lg border hover:bg-gray-50"
                              title={`Configurar o enquadramento do layout usado por ${c.name}`}
                            >
                              <PencilRuler className="w-4 h-4" />
                            </button>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  );
                })}
                {shownCities.length === 0 && <p className="px-3 py-3 text-sm text-gray-500">Nenhuma cidade encontrada.</p>}
              </div>
            </div>
          )}
        </>
      )}

      {configuring && (() => {
        const using = citiesUsing(configuring);
        return (
          <ComposerModal
            title={`Enquadramento padrão · ${frameLabel(configuring, frameIndex.get(configuring.id) ?? 0)}`}
            subtitle={using.length ? `Usado por: ${using.join(', ')}` : 'Nenhuma cidade usa este layout ainda'}
            photoUrl={samplePhoto}
            layoutUrl={configuring.url}
            initialConfig={composeConfigForFrame(configuring.config)}
            resetConfig={composeConfigForFrame(null)}
            resetLabel="Modelo padrão"
            sample={{ ...SAMPLE_CHILD, cityName: using[0] ?? SAMPLE_CHILD.cityName }}
            allowPhotoPick
            footer={
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={applyToExisting} onChange={(e) => setApplyToExisting(e.target.checked)} />
                Aplicar também às fotos já enviadas com este layout
                <span className="text-xs text-gray-500">(substitui ajustes individuais)</span>
              </label>
            }
            onClose={() => { setConfiguring(null); setApplyToExisting(false); }}
            onSave={(cfg) => saveFrameConfig(configuring, cfg)}
          />
        );
      })()}
    </div>
  );
}
