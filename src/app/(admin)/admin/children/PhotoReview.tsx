'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ImageOff, Layers, Loader2, PencilRuler, ScanFace, Sparkles, X,
} from 'lucide-react';
import ComposedImage from '@/components/media/ComposedImage';
import ComposerModal from '@/components/media/ComposerModal';
import { composeConfigForFrame, type ComposeConfig } from '@/components/media/composeConfig';
import { autoFrame, FRAMING_LABEL, framingStatus, scanFaces, type FaceScan, type FramingStatus } from '@/lib/faceFraming';
import type { LocationValue } from '@/components/Admin/LocationFilter';

type Img = {
  id: string | null;
  placeholder?: boolean;
  originalUrl?: string | null;
  processedUrl?: string | null;
  layoutUrl?: string | null;
  layoutKey?: string | null;
  Config?: any;
};
type Item = {
  id: string;
  publicId: number;
  name: string;
  birthDate?: string | null;
  age?: number | null;
  wantedGift?: string | null;
  cityId?: string | null;
  cityName?: string | null;
  city?: { id: string; name: string } | null;
  community?: { id: string; name: string } | null;
  images?: Img[];
};
type Frame = { id: string; key: string; url: string; active?: boolean; config?: unknown };
type ScanResult = { scan: FaceScan; status: FramingStatus } | { error: string };
type Filter = 'all' | 'cut' | 'tight' | 'noface' | 'ok' | 'pending';

const PAGE = 24;

const ageText = (c: Item) => {
  let age = c.age ?? null;
  if (c.birthDate) {
    const d = new Date(c.birthDate), now = new Date();
    if (!isNaN(d.getTime())) {
      age = now.getFullYear() - d.getFullYear();
      if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    }
  }
  return age == null ? '' : `${age} ${age === 1 ? 'ano' : 'anos'}`;
};
const sampleOf = (c: Item) => ({
  name: c.name,
  publicId: c.publicId,
  ageText: ageText(c),
  wantedGift: c.wantedGift ?? '',
  cityName: c.city?.name ?? c.cityName ?? '',
  communityName: c.community?.name ?? '',
});
const photoOf = (c: Item) => {
  const img = c.images?.[0];
  return img && img.id && !img.placeholder ? img.processedUrl || img.originalUrl || '' : '';
};

/** Mantém o zoom/posição de cada foto ao aplicar uma composição em lote */
const keepPhoto = (base: ComposeConfig, own: ComposeConfig): ComposeConfig => ({
  ...base,
  photoRect: { ...base.photoRect, scale: own.photoRect.scale, offsetX: own.photoRect.offsetX, offsetY: own.photoRect.offsetY },
});

async function runPool<T>(items: T[], size: number, fn: (it: T, i: number) => Promise<void>, onStep: (done: number) => void) {
  let next = 0, done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try { await fn(items[i], i); } finally { onStep(++done); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

/**
 * Conferência das fotos da campanha: a arte como o site mostra, com análise do rosto
 * (cabeça cortada / no limite / sem rosto), ajuste individual e em lote pelo filtro atual.
 */
export default function PhotoReview({
  campaignId, location, locationLabel, q,
}: {
  campaignId: string;
  location: LocationValue;
  locationLabel: string;
  q: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [frameByCity, setFrameByCity] = useState<Record<string, string>>({});
  const [scans, setScans] = useState<Record<string, ScanResult>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [job, setJob] = useState<{ label: string; done: number; total: number } | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchKeepPhoto, setBatchKeepPhoto] = useState(true);
  const [batchAuto, setBatchAuto] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const cancelRef = useRef(false);

  // todas as crianças com foto nesta campanha e neste filtro (para analisar e ajustar em lote)
  const load = useCallback(async () => {
    setLoading(true); setError(null); setScans({}); setPage(1);
    try {
      const all: Item[] = [];
      for (let skip = 0; ; skip += 100) {
        const qs = new URLSearchParams({ campaignId, photo: 'with', skip: String(skip), take: '100' });
        if (location.cityId) qs.set('cityId', location.cityId);
        if (location.communityId) qs.set('communityId', location.communityId);
        if (location.schoolId) qs.set('schoolId', location.schoolId);
        if (q.trim()) qs.set('q', q.trim());
        const r = await fetch(`/api/admin/children?${qs}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`Erro ${r.status} ao carregar as fotos`);
        const j = await r.json();
        all.push(...(j.items ?? []));
        if (!j.hasMore || !(j.items ?? []).length) break;
      }
      setItems(all.filter((c) => photoOf(c)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId, location.cityId, location.communityId, location.schoolId, q]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const [rf, rc] = await Promise.all([
        fetch(`/api/admin/campaigns/${campaignId}/layouts`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/admin/campaigns/${campaignId}/city-layouts`, { cache: 'no-store' }).catch(() => null),
      ]);
      setFrames(rf?.ok ? await rf.json() : []);
      const byCity: { cityId: string; frameId: string }[] = rc?.ok ? await rc.json() : [];
      setFrameByCity(Object.fromEntries(byCity.map((l) => [l.cityId, l.frameId])));
    })();
  }, [campaignId]);

  const frameFor = (c: Item) => {
    const cityId = c.city?.id ?? c.cityId ?? '';
    return frames.find((f) => f.id === frameByCity[cityId]) ?? frames.find((f) => f.active) ?? null;
  };
  const configOf = (c: Item): ComposeConfig => composeConfigForFrame(c.images?.[0]?.Config ?? frameFor(c)?.config);
  const layoutOf = (c: Item) => c.images?.[0]?.layoutUrl || frameFor(c)?.url || '';

  const statusOf = (c: Item): FramingStatus | 'pending' | 'error' => {
    const s = scans[c.id];
    if (!s) return 'pending';
    return 'error' in s ? 'error' : s.status;
  };

  const counts = useMemo(() => {
    const k = { cut: 0, tight: 0, noface: 0, ok: 0, pending: 0 };
    for (const c of items) {
      const s = statusOf(c);
      if (s === 'error' || s === 'noface') k.noface++;
      else k[s]++;
    }
    return k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, scans]);

  const shown = useMemo(() => items.filter((c) => {
    if (filter === 'all') return true;
    const s = statusOf(c);
    return filter === 'noface' ? s === 'noface' || s === 'error' : s === filter;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, scans, filter]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const pageItems = shown.slice((page - 1) * PAGE, page * PAGE);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  /* ---------- análise e gravação ---------- */

  async function scanOne(c: Item, cfg = configOf(c)) {
    try {
      const scan = await scanFaces(photoOf(c));
      const res = { scan, status: framingStatus(cfg, scan) };
      setScans((p) => ({ ...p, [c.id]: res }));
      return res;
    } catch (e) {
      setScans((p) => ({ ...p, [c.id]: { error: e instanceof Error ? e.message : 'falha' } }));
      return null;
    }
  }

  async function saveConfig(c: Item, config: ComposeConfig) {
    const img = c.images?.[0];
    if (!img?.id) throw new Error('sem imagem');
    const frame = frameFor(c);
    const r = await fetch(`/api/admin/child-images/${img.id}/compose`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, frameId: frame?.id }),
    });
    if (!r.ok) throw new Error(`Erro ${r.status}`);
    setItems((prev) => prev.map((x) => x.id === c.id
      ? { ...x, images: [{ ...img, Config: config, layoutUrl: frame?.url ?? img.layoutUrl, layoutKey: frame?.key ?? img.layoutKey }] }
      : x));
    // reavalia com a composição nova (estado atual, não o da hora em que o lote começou)
    setScans((p) => {
      const s = p[c.id];
      return s && !('error' in s) ? { ...p, [c.id]: { scan: s.scan, status: framingStatus(config, s.scan) } } : p;
    });
  }

  async function analyzeAll(onlyPending = true) {
    const list = items.filter((c) => !onlyPending || !scans[c.id]);
    if (!list.length) return;
    cancelRef.current = false;
    setJob({ label: 'Analisando rostos', done: 0, total: list.length });
    try {
      // o detector é um só: em sequência, mas baixando a próxima foto em paralelo
      await runPool(list, 2, async (c) => { if (!cancelRef.current) await scanOne(c); }, (d) => setJob((j) => j && { ...j, done: d }));
    } finally {
      setJob(null);
    }
  }

  async function autoFix(targets: Item[]) {
    if (!targets.length) return;
    if (!confirm(`Ajustar automaticamente ${targets.length} foto(s)${locationLabel ? ` de ${locationLabel}` : ''}? A foto é aproximada e posicionada para a cabeça ficar inteira.`)) return;
    cancelRef.current = false;
    let fixed = 0, noface = 0, failed = 0;
    setJob({ label: 'Ajustando pelo rosto', done: 0, total: targets.length });
    try {
      await runPool(targets, 2, async (c) => {
        if (cancelRef.current) return;
        const s = scans[c.id];
        const scan = s && !('error' in s) ? s.scan : (await scanOne(c))?.scan;
        const next = scan ? autoFrame(configOf(c), scan) : null;
        if (!next) { noface++; return; }
        try { await saveConfig(c, next); fixed++; } catch { failed++; }
      }, (d) => setJob((j) => j && { ...j, done: d }));
    } finally {
      setJob(null);
      setMessage(`${fixed} foto(s) ajustada(s)${noface ? ` · ${noface} sem rosto encontrado (ajuste manual)` : ''}${failed ? ` · ${failed} com erro ao salvar` : ''}.`);
    }
  }

  async function applyBatch(base: ComposeConfig) {
    const targets = items;
    cancelRef.current = false;
    let ok = 0, failed = 0;
    setBatchOpen(false);
    setJob({ label: 'Aplicando enquadramento', done: 0, total: targets.length });
    try {
      await runPool(targets, 3, async (c) => {
        if (cancelRef.current) return;
        let cfg = batchKeepPhoto ? keepPhoto(base, configOf(c)) : base;
        if (batchAuto) {
          const s = scans[c.id];
          const scan = s && !('error' in s) ? s.scan : (await scanOne(c, cfg))?.scan;
          cfg = (scan && autoFrame(cfg, scan)) || cfg;
        }
        try { await saveConfig(c, cfg); ok++; } catch { failed++; }
      }, (d) => setJob((j) => j && { ...j, done: d }));
    } finally {
      setJob(null);
      setMessage(`Enquadramento aplicado em ${ok} foto(s)${failed ? ` · ${failed} com erro` : ''}.`);
    }
  }

  /* ---------- tela ---------- */

  const problems = items.filter((c) => ['cut', 'tight'].includes(statusOf(c)));
  const scanned = items.length - counts.pending;
  const sample = items[0];

  const chip = (key: Filter, label: string, n: number, tone: string) => (
    <button
      key={key}
      onClick={() => { setFilter(key); setPage(1); }}
      className={`px-3 py-1.5 rounded-full text-sm border transition ${filter === key ? 'bg-gray-900 text-white border-gray-900' : `${tone} hover:shadow-sm`}`}
    >
      {label} <span className="font-semibold">{n}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* barra de ações */}
      <div className="bg-white/80 rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => analyzeAll(true)}
            disabled={!!job || loading || counts.pending === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40"
          >
            <ScanFace className="w-4 h-4" />
            {counts.pending === 0 && items.length ? 'Todas analisadas' : `Analisar rostos (${counts.pending})`}
          </button>
          <button
            onClick={() => autoFix(problems)}
            disabled={!!job || problems.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40"
            title="Só as fotos com a cabeça cortada ou no limite"
          >
            <Sparkles className="w-4 h-4" /> Corrigir automaticamente ({problems.length})
          </button>
          <button
            onClick={() => setBatchOpen(true)}
            disabled={!!job || !sample}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold disabled:opacity-40"
          >
            <Layers className="w-4 h-4" /> Editar em lote ({items.length})
          </button>
          <span className="text-xs text-gray-500 ml-auto">
            {loading ? 'Carregando…' : `${items.length} foto(s)${locationLabel ? ` · ${locationLabel}` : ' · todas as cidades'}`}
            {scanned > 0 && ` · ${scanned} analisada(s)`}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {chip('all', 'Todas', items.length, 'bg-white border-gray-200 text-gray-700')}
          {chip('cut', 'Cabeça cortada', counts.cut, 'bg-red-50 border-red-200 text-red-800')}
          {chip('tight', 'No limite', counts.tight, 'bg-amber-50 border-amber-200 text-amber-800')}
          {chip('noface', 'Sem rosto', counts.noface, 'bg-slate-50 border-slate-200 text-slate-700')}
          {chip('ok', 'OK', counts.ok, 'bg-emerald-50 border-emerald-200 text-emerald-800')}
          {counts.pending > 0 && chip('pending', 'Não analisadas', counts.pending, 'bg-white border-dashed border-gray-300 text-gray-500')}
        </div>

        {job && (
          <div className="flex items-center gap-3 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-gray-700">{job.label}: {job.done}/{job.total}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-md">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${(job.done / Math.max(1, job.total)) * 100}%` }} />
            </div>
            <button onClick={() => { cancelRef.current = true; }} className="text-xs text-gray-500 hover:text-gray-800">Parar</button>
          </div>
        )}
        {message && (
          <div className="flex items-start gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span className="flex-1">{message}</span>
            <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
          </div>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <p className="text-xs text-gray-500">
          A análise acha o rosto em cada foto (no seu navegador) e avisa quando a cabeça sai da área da foto do layout.
          A correção automática aproxima e reposiciona a foto; dá para refinar em “Ajustar”.
        </p>
      </div>

      {/* grade */}
      {loading ? (
        <div className="py-16 flex justify-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !shown.length ? (
        <div className="py-16 text-center text-gray-500 bg-white/70 rounded-2xl border border-gray-100">
          <ImageOff className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          {items.length ? 'Nenhuma foto neste grupo.' : 'Nenhuma criança com foto nesta campanha e neste filtro.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {pageItems.map((c) => {
            const st = statusOf(c);
            const tone =
              st === 'cut' ? 'ring-2 ring-red-500' : st === 'tight' ? 'ring-2 ring-amber-400' : st === 'noface' || st === 'error' ? 'ring-2 ring-slate-300' : '';
            return (
              <div key={c.id} className={`bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm ${tone}`}>
                <div className="relative aspect-[4/5] bg-gray-100">
                  <ComposedImage
                    photoUrl={photoOf(c)}
                    layoutUrl={layoutOf(c)}
                    config={configOf(c) as any}
                    sample={sampleOf(c)}
                    alt={c.name}
                    className="absolute inset-0"
                    imgClassName="w-full h-full"
                    quality={0.75}
                  />
                  {st !== 'pending' && (
                    <span
                      className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        st === 'ok' ? 'bg-emerald-600 text-white' : st === 'cut' ? 'bg-red-600 text-white' : st === 'tight' ? 'bg-amber-400 text-amber-950' : 'bg-slate-700 text-white'
                      }`}
                    >
                      {st === 'ok' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {st === 'error' ? 'Erro na análise' : FRAMING_LABEL[st]}
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <Link href={`/admin/children/${c.id}`} className="block text-xs font-semibold text-gray-900 truncate hover:underline" title={c.name}>
                    {c.publicId} · {c.name}
                  </Link>
                  <p className="text-[11px] text-gray-500 truncate">{c.community?.name ?? c.city?.name ?? c.cityName}</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setEditing(c)}
                      disabled={!!job}
                      className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-xs hover:bg-gray-50 disabled:opacity-40"
                    >
                      <PencilRuler className="w-3.5 h-3.5" /> Ajustar
                    </button>
                    <button
                      onClick={async () => {
                        setJob({ label: c.name, done: 0, total: 1 });
                        try {
                          const s = scans[c.id];
                          const scan = s && !('error' in s) ? s.scan : (await scanOne(c))?.scan;
                          const next = scan ? autoFrame(configOf(c), scan) : null;
                          if (next) await saveConfig(c, next);
                          else setMessage(`Não encontrei o rosto de ${c.name}: use “Ajustar”.`);
                        } catch { setMessage(`Falha ao salvar ${c.name}.`); }
                        finally { setJob(null); }
                      }}
                      disabled={!!job}
                      className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-xs hover:bg-gray-50 disabled:opacity-40"
                      title="Ajustar pelo rosto e salvar"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Auto
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg border bg-white disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-gray-700">Página {page} de {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="p-2 rounded-lg border bg-white disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}

      {/* individual */}
      {editing && (
        <ComposerModal
          title={`Enquadramento · ${editing.publicId} ${editing.name}`}
          subtitle={[editing.community?.name, editing.city?.name ?? editing.cityName].filter(Boolean).join(' · ')}
          photoUrl={photoOf(editing)}
          layoutUrl={layoutOf(editing)}
          initialConfig={configOf(editing)}
          resetConfig={composeConfigForFrame(frameFor(editing)?.config)}
          sample={sampleOf(editing)}
          onAutoFrame={async (cfg) => {
            const scan = (await scanOne(editing, cfg))?.scan;
            return scan ? autoFrame(cfg, scan) : null;
          }}
          onClose={() => setEditing(null)}
          onSave={async (cfg) => {
            try { await saveConfig(editing, cfg); setEditing(null); }
            catch { alert('Não foi possível salvar o enquadramento.'); }
          }}
        />
      )}

      {/* lote: todas as fotos do filtro atual */}
      {batchOpen && sample && (
        <ComposerModal
          title={`Enquadramento em lote · ${items.length} foto(s)`}
          subtitle={`${locationLabel || 'Todas as cidades'} — editando sobre a foto de ${sample.name}`}
          photoUrl={photoOf(sample)}
          layoutUrl={layoutOf(sample)}
          initialConfig={configOf(sample)}
          resetConfig={composeConfigForFrame(frameFor(sample)?.config)}
          sample={sampleOf(sample)}
          saveLabel={`Aplicar em ${items.length} foto(s)`}
          footer={
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={batchKeepPhoto} onChange={(e) => setBatchKeepPhoto(e.target.checked)} />
                Manter o zoom e a posição de cada foto <span className="text-xs text-gray-500">(aplica só área da foto e textos)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={batchAuto} onChange={(e) => setBatchAuto(e.target.checked)} />
                Depois, ajustar cada foto pelo rosto
              </label>
            </div>
          }
          onClose={() => setBatchOpen(false)}
          onSave={async (cfg) => {
            if (!confirm(`Aplicar este enquadramento em ${items.length} foto(s)${locationLabel ? ` de ${locationLabel}` : ''}?`)) return;
            await applyBatch(cfg);
          }}
        />
      )}
    </div>
  );
}
