'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, ImageOff, ListChecks, Loader2, Type, X } from 'lucide-react';
import { estimatePages, exportSponsorshipsPdf, type ExportResult, type PdfItem } from '@/lib/pdf/exportSponsorshipsPdf';

const PER_PAGE = [1, 2, 4, 6, 9] as const;
const GRID: Record<number, [number, number]> = { 1: [1, 1], 2: [2, 1], 4: [2, 2], 6: [3, 2], 9: [3, 3] };
const TEXT_SIZES = [
  { label: 'Menor', value: 0.85 },
  { label: 'Normal', value: 1 },
  { label: 'Maior', value: 1.2 },
];
const PREFS_KEY = 'pdf-export-prefs';

type Prefs = { perPage: number; textScale: number; caption: boolean; summary: boolean; includeNoPhoto: boolean };

function loadPrefs(fallback: Prefs): Prefs {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return fallback; }
}

/**
 * Exportar cartões em PDF (admin e "Meus apadrinhamentos").
 * `loadItems` busca os dados na hora de gerar (com a imagem da campanha de cada apadrinhamento).
 */
export default function ExportPdfDialog({
  open, onClose, title, subtitle, count, loadItems, fileName, defaultSummary = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  count: number;
  loadItems: () => Promise<PdfItem[]>;
  fileName: string;
  defaultSummary?: boolean;
}) {
  const [prefs, setPrefs] = useState<Prefs>({ perPage: 4, textScale: 1, caption: true, summary: defaultSummary, includeNoPhoto: true });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; phase: 'load' | 'compose' | 'pdf' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(ExportResult & { skipped: number }) | null>(null);
  const cancelRef = useRef({ cancelled: false });

  // lembra as escolhas entre exportações (o resumo segue o padrão da tela)
  useEffect(() => {
    if (!open) return;
    setPrefs((p) => ({ ...loadPrefs(p), summary: defaultSummary }));
    setResult(null); setError(null); setProgress(null);
  }, [open, defaultSummary]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const set = (patch: Partial<Prefs>) => setPrefs((p) => {
    const next = { ...p, ...patch };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        perPage: next.perPage, textScale: next.textScale, caption: next.caption, includeNoPhoto: next.includeNoPhoto,
      }));
    } catch { /* sem storage */ }
    return next;
  });

  async function generate() {
    setBusy(true); setError(null); setResult(null);
    cancelRef.current = { cancelled: false };
    try {
      setProgress({ current: 0, total: count, phase: 'load' });
      const all = await loadItems();
      if (!all.length) throw new Error('Nenhum apadrinhamento para exportar.');
      // sem foto = sem foto nesta campanha (só o layout)
      const items = prefs.includeNoPhoto ? all : all.filter((i) => !!i.child.photoUrl);
      const skipped = all.length - items.length;
      if (!items.length) throw new Error(`Nenhuma das ${all.length} criança(s) tem foto nesta campanha. Ative "Incluir crianças sem foto" para exportar mesmo assim.`);
      const r = await exportSponsorshipsPdf(items, {
        ...prefs,
        title,
        fileName,
        signal: cancelRef.current,
        onProgress: (p) => setProgress(p),
      });
      if (!r.cancelled) setResult({ ...r, skipped });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const pages = estimatePages(count, prefs.perPage, prefs.summary);
  const pct = progress ? Math.round((progress.current / Math.max(1, progress.total)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!busy) onClose(); }} aria-hidden="true" />
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 shrink-0">
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><FileText className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">Exportar PDF — {title}</h3>
            <p className="text-sm text-gray-500 truncate">{subtitle ?? `${count} criança${count === 1 ? '' : 's'}`}</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto overscroll-contain">
          {/* cartões por página, com miniatura da grade */}
          <fieldset disabled={busy}>
            <legend className="text-sm font-semibold text-gray-800 mb-2">Cartões por página</legend>
            <div className="grid grid-cols-5 gap-2">
              {PER_PAGE.map((n) => {
                const [c, r] = GRID[n];
                const active = prefs.perPage === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set({ perPage: n })}
                    className={`rounded-xl border p-2 flex flex-col items-center gap-1.5 transition ${active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-gray-200 hover:bg-gray-50'}`}
                    aria-pressed={active}
                  >
                    {/* folha A4 em miniatura */}
                    <span className="w-8 h-11 rounded-sm bg-white border border-gray-300 p-0.5 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${c}, 1fr)`, gridTemplateRows: `repeat(${r}, 1fr)` }}>
                      {Array.from({ length: n }, (_, i) => <span key={i} className={`rounded-[1px] ${active ? 'bg-emerald-400' : 'bg-gray-300'}`} />)}
                    </span>
                    <span className={`text-xs font-semibold ${active ? 'text-emerald-700' : 'text-gray-600'}`}>{n}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* tamanho do texto */}
          <fieldset disabled={busy || !prefs.caption}>
            <legend className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5"><Type className="w-4 h-4" /> Tamanho do texto</legend>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-100">
              {TEXT_SIZES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set({ textScale: t.value })}
                  className={`py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${prefs.textScale === t.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Toggle
              checked={prefs.caption}
              onChange={(v) => set({ caption: v })}
              disabled={busy}
              label="Legenda em cada cartão"
              hint="Nome, ID, idade, local, presente e status abaixo da arte"
            />
            <Toggle
              checked={prefs.summary}
              onChange={(v) => setPrefs((p) => ({ ...p, summary: v }))}
              disabled={busy}
              icon={<ListChecks className="w-4 h-4" />}
              label="Página de resumo no início"
              hint="Lista de todas as crianças com presente e status (boa para as compras)"
            />
            <Toggle
              checked={prefs.includeNoPhoto}
              onChange={(v) => set({ includeNoPhoto: v })}
              disabled={busy}
              icon={<ImageOff className="w-4 h-4" />}
              label="Incluir crianças sem foto"
              hint={prefs.includeNoPhoto
                ? 'Saem no fim, só com o layout e o espaço da foto vazio'
                : 'Ficam de fora do PDF (cartões e resumo)'}
            />
          </div>

          <p className="text-xs text-gray-500">
            {prefs.includeNoPhoto ? 'Cerca de' : 'No máximo'} <strong>{pages}</strong> página{pages === 1 ? '' : 's'}
            {!prefs.includeNoPhoto && ' (sem contar as crianças sem foto)'}.
          </p>

          {progress && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="flex-1">
                  {progress.phase === 'load' ? 'Buscando os dados…' : progress.phase === 'compose' ? `Montando as artes… ${progress.current}/${progress.total}` : `Escrevendo o PDF… ${progress.current}/${progress.total}`}
                </span>
                {progress.phase !== 'load' && (
                  <button onClick={() => { cancelRef.current.cancelled = true; }} className="text-xs underline">Cancelar</button>
                )}
              </div>
              <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress.phase === 'load' ? 5 : pct}%` }} />
              </div>
            </div>
          )}

          {result && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                PDF baixado: {result.cards} cartão(ões) em {result.pages} página(s)
                {result.withoutPhoto ? ` · ${result.withoutPhoto} sem foto` : ''}
                {result.skipped ? ` · ${result.skipped} sem foto deixada(s) de fora` : ''}.
              </span>
            </div>
          )}
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end px-4 sm:px-5 py-3 border-t border-gray-100 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          <button
            onClick={generate}
            disabled={busy || count === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ? 'Gerando…' : result ? 'Baixar de novo' : 'Gerar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled, label, hint, icon }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; hint?: string; icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="w-full flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60"
      role="switch"
      aria-checked={checked}
    >
      {icon && <span className="text-gray-500">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-emerald-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
