'use client';

import { useState } from 'react';
import { Loader2, RotateCcw, X } from 'lucide-react';
import ComposedImage, { ComposeSample } from '@/components/media/ComposedImage';
import { ComposeConfig, PhotoRect, TextSpec } from '@/components/media/composeConfig';

const FITS: PhotoRect['fit'][] = ['cover', 'contain', 'fill', 'inside', 'outside'];
const GRAVITIES: PhotoRect['gravity'][] = ['center', 'north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

/**
 * Ajuste do enquadramento de UMA foto de UMA campanha: posição/tamanho da foto
 * e textos sobre o layout. Salva em ChildImage.Config (o que o apadrinhamento usa
 * para montar a arte) e já troca a imagem para o layout atual da campanha.
 */
export default function ComposeEditor({
  imageId,
  photoUrl,
  layoutUrl,
  frameId,
  initialConfig,
  layoutConfig,
  sample,
  title,
  onClose,
  onSaved,
}: {
  imageId: string;
  photoUrl: string;
  layoutUrl: string;
  frameId?: string | null;
  initialConfig: ComposeConfig;
  /** composição padrão do layout, para "voltar ao padrão do layout" */
  layoutConfig: ComposeConfig;
  sample: ComposeSample;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cfg, setCfg] = useState<ComposeConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const pr = cfg.photoRect;

  const setPhoto = (p: Partial<PhotoRect>) => setCfg((c) => ({ ...c, photoRect: { ...c.photoRect, ...p } }));
  const setText = (id: string, p: Partial<TextSpec>) =>
    setCfg((c) => ({ ...c, texts: c.texts.map((t) => (t.id === id ? { ...t, ...p } : t)) }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/child-images/${imageId}/compose`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: cfg, frameId: frameId ?? undefined }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      onSaved();
      onClose();
    } catch {
      alert('Falha ao salvar o enquadramento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">Ajustar enquadramento</h3>
            <p className="text-xs text-gray-500 truncate">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCfg(layoutConfig)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50"
              title="Descarta os ajustes desta foto e usa o enquadramento padrão do layout"
            >
              <RotateCcw className="w-4 h-4" /> Padrão do layout
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" title="Fechar"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] flex-1 min-h-0 overflow-auto">
          {/* prévia ao vivo, igual à do apadrinhamento */}
          <div className="p-4 bg-gray-50 flex items-start justify-center">
            <ComposedImage
              photoUrl={photoUrl}
              layoutUrl={layoutUrl}
              config={cfg as any}
              sample={sample}
              alt="Prévia do enquadramento"
              className="w-full max-w-sm"
              imgClassName="rounded-lg shadow"
            />
          </div>

          <div className="p-4 space-y-5 border-l text-sm">
            <fieldset className="space-y-2">
              <legend className="font-semibold text-gray-900">Foto</legend>
              <div className="grid grid-cols-2 gap-2">
                <Num label="X" value={pr.x} onChange={(v) => setPhoto({ x: v })} />
                <Num label="Y" value={pr.y} onChange={(v) => setPhoto({ y: v })} />
                <Num label="Largura" value={pr.width} onChange={(v) => setPhoto({ width: v })} />
                <Num label="Altura" value={pr.height} onChange={(v) => setPhoto({ height: v })} />
              </div>
              <Range label="Zoom" min={0.5} max={3} step={0.05} value={pr.scale ?? 1} onChange={(v) => setPhoto({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
              <Range label="Mover na horizontal" min={-600} max={600} step={5} value={pr.offsetX ?? 0} onChange={(v) => setPhoto({ offsetX: v })} />
              <Range label="Mover na vertical" min={-600} max={600} step={5} value={pr.offsetY ?? 0} onChange={(v) => setPhoto({ offsetY: v })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">
                  Ajuste
                  <select value={pr.fit} onChange={(e) => setPhoto({ fit: e.target.value as PhotoRect['fit'] })} className="mt-1 w-full border rounded-lg px-2 py-1.5 bg-white">
                    {FITS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Ancoragem
                  <select value={pr.gravity} onChange={(e) => setPhoto({ gravity: e.target.value as PhotoRect['gravity'] })} className="mt-1 w-full border rounded-lg px-2 py-1.5 bg-white">
                    {GRAVITIES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
              </div>
              <Num label="Cantos arredondados" value={pr.cornerRadius ?? 0} onChange={(v) => setPhoto({ cornerRadius: v })} />
            </fieldset>

            {cfg.texts.length > 0 && (
              <fieldset className="space-y-3">
                <legend className="font-semibold text-gray-900">Textos</legend>
                {cfg.texts.map((t) => (
                  <div key={t.id} className="rounded-lg border p-2 space-y-2">
                    <input
                      value={t.template}
                      onChange={(e) => setText(t.id, { template: e.target.value })}
                      className="w-full border rounded-lg px-2 py-1.5 font-mono text-xs"
                      title="Use {name}, {publicId}, {age}, {wantedGift}, {cityName}, {communityName}"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Num label="X" value={t.x} onChange={(v) => setText(t.id, { x: v })} />
                      <Num label="Y" value={t.y} onChange={(v) => setText(t.id, { y: v })} />
                      <Num label="Tamanho" value={t.font.size} onChange={(v) => setText(t.id, { font: { ...t.font, size: v } })} />
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-gray-500">
                  Variáveis: {'{name}'}, {'{publicId}'}, {'{age}'}, {'{wantedGift}'}, {'{cityName}'}, {'{communityName}'}
                </p>
              </fieldset>
            )}

            <fieldset className="space-y-2">
              <legend className="font-semibold text-gray-900">Tela</legend>
              <div className="grid grid-cols-2 gap-2">
                <Num label="Largura" value={cfg.canvas.width} onChange={(v) => setCfg((c) => ({ ...c, canvas: { ...c.canvas, width: v } }))} />
                <Num label="Altura" value={cfg.canvas.height} onChange={(v) => setCfg((c) => ({ ...c, canvas: { ...c.canvas, height: v } }))} />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={cfg.layout.onTop ?? true}
                  onChange={(e) => setCfg((c) => ({ ...c, layout: { ...c.layout, onTop: e.target.checked } }))}
                />
                Layout por cima da foto
              </label>
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-xs text-gray-600 block">
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 w-full border rounded-lg px-2 py-1.5"
      />
    </label>
  );
}

function Range({
  label, min, max, step, value, onChange, format,
}: {
  label: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <label className="text-xs text-gray-600 block">
      <span className="flex justify-between"><span>{label}</span><span className="text-gray-400">{format ? format(value) : value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </label>
  );
}
