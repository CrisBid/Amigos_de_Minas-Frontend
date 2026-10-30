'use client';

import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Crosshair, Image as ImageIcon, Move, Plus, Trash2, Type } from 'lucide-react';
import ComposedImage, { ComposeSample } from './ComposedImage';
import { ComposeConfig, PhotoRect, TextSpec } from './composeConfig';

/* Editor visual da composição (foto + layout + textos), usado na criança, no
   layout da campanha e na migração. Controlado: recebe `value` e devolve `onChange`.
   As coordenadas são as do canvas final (as mesmas que o apadrinhamento usa). */

const TEXT_PRESETS: { label: string; text: Partial<TextSpec> }[] = [
  { label: 'Nome', text: { template: '{name}', font: { family: 'Inter, sans-serif', size: 54, weight: 800 }, uppercase: true } },
  { label: 'ID', text: { template: 'ID {publicId}' } },
  { label: 'Idade', text: { template: '{age}' } },
  { label: 'Presente', text: { template: '{wantedGift}', font: { family: 'Inter, sans-serif', size: 34, weight: 600 } } },
  { label: 'Cidade', text: { template: '{cityName}' } },
  { label: 'Comunidade', text: { template: '{communityName}' } },
  { label: 'ID • Idade • Cidade', text: { template: 'ID {publicId} • {age} • {cityName}' } },
  { label: 'Texto livre', text: { template: 'Texto' } },
];

const VARIABLES: [string, string][] = [
  ['{name}', 'Nome'], ['{publicId}', 'ID'], ['{age}', 'Idade'],
  ['{wantedGift}', 'Presente'], ['{cityName}', 'Cidade'], ['{communityName}', 'Comunidade'],
];

const FITS: { value: PhotoRect['fit']; label: string }[] = [
  { value: 'cover', label: 'Preencher a área' },
  { value: 'contain', label: 'Caber inteira' },
];

type Tab = 'photo' | 'texts' | 'canvas';
type DragKind = 'area' | 'photo' | 'resize' | 'text';
type Drag = { kind: DragKind; id?: string; startX: number; startY: number; factor: number; base: any };

const round = (n: number) => Math.round(n);

export default function LayoutComposer({
  photoUrl,
  layoutUrl,
  value,
  onChange,
  sample,
}: {
  photoUrl: string;
  layoutUrl: string;
  value: ComposeConfig;
  onChange: (cfg: ComposeConfig) => void;
  sample: ComposeSample;
}) {
  const [tab, setTab] = useState<Tab>('photo');
  const [dragPhoto, setDragPhoto] = useState(true); // arrastar dentro da área move a foto (senão, a área)
  const [selectedText, setSelectedText] = useState<string | null>(value.texts[0]?.id ?? null);
  const boxRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const latest = useRef(value);
  latest.current = value;

  const W = value.canvas.width || 1080;
  const H = value.canvas.height || 1350;
  const pr = value.photoRect;

  // a arte final é recomposta com um pequeno atraso; as marcações seguem o mouse na hora
  const [previewCfg, setPreviewCfg] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setPreviewCfg(value), drag.current ? 250 : 80);
    return () => window.clearTimeout(t);
  }, [value]);

  const setPhoto = (p: Partial<PhotoRect>) => onChange({ ...latest.current, photoRect: { ...latest.current.photoRect, ...p } });
  const setText = (id: string, p: Partial<TextSpec>) =>
    onChange({ ...latest.current, texts: latest.current.texts.map((t) => (t.id === id ? { ...t, ...p } : t)) });

  // zoom com a roda do mouse sobre a área da foto (listener não-passivo para não rolar a página)
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = latest.current.photoRect.scale ?? 1;
      const next = Math.min(4, Math.max(0.3, cur * (e.deltaY < 0 ? 1.05 : 1 / 1.05)));
      onChange({ ...latest.current, photoRect: { ...latest.current.photoRect, scale: Math.round(next * 100) / 100 } });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onChange]);

  function startDrag(e: React.PointerEvent, kind: DragKind, id?: string) {
    e.preventDefault();
    e.stopPropagation();
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const base = kind === 'text' ? { ...value.texts.find((t) => t.id === id) } : { ...value.photoRect };
    drag.current = { kind, id, startX: e.clientX, startY: e.clientY, factor: W / rect.width, base };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (kind === 'text' && id) { setSelectedText(id); setTab('texts'); }
  }

  function onDragMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) * d.factor;
    const dy = (e.clientY - d.startY) * d.factor;
    const b = d.base;
    if (d.kind === 'area') setPhoto({ x: round(b.x + dx), y: round(b.y + dy) });
    if (d.kind === 'photo') setPhoto({ offsetX: round((b.offsetX ?? 0) + dx), offsetY: round((b.offsetY ?? 0) + dy) });
    if (d.kind === 'resize') setPhoto({ width: Math.max(40, round(b.width + dx)), height: Math.max(40, round(b.height + dy)) });
    if (d.kind === 'text' && d.id) setText(d.id, { x: round(b.x + dx), y: round(b.y + dy) });
  }

  function endDrag() {
    drag.current = null;
    setPreviewCfg(latest.current);
  }

  function addText(preset: Partial<TextSpec>) {
    const id = `t${Date.now().toString(36)}`;
    const text: TextSpec = {
      id,
      template: 'Texto',
      x: round(W * 0.07),
      y: round(H * 0.85),
      maxWidth: round(W * 0.86),
      align: 'center',
      font: { family: 'Inter, sans-serif', size: 40, weight: 700 },
      fill: '#111827',
      lineHeight: 1.1,
      ...preset,
    };
    onChange({ ...value, texts: [...value.texts, text] });
    setSelectedText(id);
    setTab('texts');
  }

  function removeText(id: string) {
    const texts = value.texts.filter((t) => t.id !== id);
    onChange({ ...value, texts });
    if (selectedText === id) setSelectedText(texts[0]?.id ?? null);
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const sel = value.texts.find((t) => t.id === selectedText) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-0 min-h-0">
      {/* ===== Prévia interativa ===== */}
      <div className="p-4 bg-gray-100 flex flex-col items-center gap-3 min-w-0">
        <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm text-xs">
          <button
            onClick={() => setDragPhoto(true)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md ${dragPhoto ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            title="Arrastar dentro da área move a foto (o enquadramento)"
          >
            <ImageIcon className="w-3.5 h-3.5" /> Mover foto
          </button>
          <button
            onClick={() => setDragPhoto(false)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md ${!dragPhoto ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            title="Arrastar dentro da área move a própria área da foto no layout"
          >
            <Move className="w-3.5 h-3.5" /> Mover área
          </button>
        </div>

        <div
          ref={boxRef}
          className="relative w-full max-w-md select-none touch-none shadow-lg rounded-lg overflow-hidden bg-white"
          style={{ aspectRatio: `${W} / ${H}` }}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <ComposedImage
            photoUrl={photoUrl}
            layoutUrl={layoutUrl}
            config={previewCfg as any}
            sample={sample}
            alt="Prévia da composição"
            className="absolute inset-0"
          />

          {/* área da foto */}
          <div
            ref={areaRef}
            className={`absolute border-2 border-dashed border-blue-500/80 bg-blue-500/5 ${dragPhoto ? 'cursor-grab' : 'cursor-move'}`}
            style={{ left: pct(pr.x, W), top: pct(pr.y, H), width: pct(pr.width, W), height: pct(pr.height, H) }}
            onPointerDown={(e) => startDrag(e, dragPhoto ? 'photo' : 'area')}
            title="Arraste para mover · role o mouse para zoom"
          >
            <span className="absolute -top-5 left-0 text-[10px] font-medium text-blue-700 bg-white/90 px-1 rounded">Foto</span>
            <div
              className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-sm cursor-se-resize"
              onPointerDown={(e) => startDrag(e, 'resize')}
              title="Redimensionar a área"
            />
          </div>

          {/* textos */}
          {value.texts.map((t) => (
            <div
              key={t.id}
              className={`absolute cursor-move rounded-sm ${t.id === selectedText ? 'outline outline-2 outline-fuchsia-500 bg-fuchsia-500/10' : 'outline outline-1 outline-dashed outline-gray-500/60 hover:outline-fuchsia-400'}`}
              style={{
                left: pct(t.x, W),
                top: pct(t.y, H),
                width: pct(t.maxWidth, W),
                height: pct((t.font?.size ?? 40) * (t.lineHeight ?? 1.1), H),
              }}
              onPointerDown={(e) => startDrag(e, 'text', t.id)}
              title={t.template}
            />
          ))}
        </div>
        <p className="text-[11px] text-gray-500 text-center">
          Arraste a foto e os textos na prévia. Role o mouse sobre a foto para dar zoom. O quadrado azul redimensiona a área.
        </p>
      </div>

      {/* ===== Painel ===== */}
      <div className="border-l bg-white flex flex-col min-h-0">
        <div className="flex border-b text-sm">
          {([
            ['photo', 'Foto', ImageIcon],
            ['texts', `Textos (${value.texts.length})`, Type],
            ['canvas', 'Tela', Crosshair],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 border-b-2 ${tab === key ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4 overflow-auto text-sm">
          {tab === 'photo' && (
            <>
              <Range label="Zoom" min={0.3} max={4} step={0.01} value={pr.scale ?? 1} onChange={(v) => setPhoto({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
              <Range label="Posição horizontal" min={-round(W / 2)} max={round(W / 2)} step={1} value={pr.offsetX ?? 0} onChange={(v) => setPhoto({ offsetX: v })} />
              <Range label="Posição vertical" min={-round(H / 2)} max={round(H / 2)} step={1} value={pr.offsetY ?? 0} onChange={(v) => setPhoto({ offsetY: v })} />
              <div className="flex gap-2">
                <button onClick={() => setPhoto({ offsetX: 0, offsetY: 0 })} className="flex-1 px-2 py-1.5 rounded-lg border hover:bg-gray-50">Centralizar</button>
                <button onClick={() => setPhoto({ scale: 1, offsetX: 0, offsetY: 0 })} className="flex-1 px-2 py-1.5 rounded-lg border hover:bg-gray-50">Zoom 100%</button>
              </div>
              <label className="block text-xs text-gray-600">
                Encaixe
                <select value={pr.fit === 'contain' || pr.fit === 'inside' ? 'contain' : 'cover'} onChange={(e) => setPhoto({ fit: e.target.value as PhotoRect['fit'] })} className="mt-1 w-full border rounded-lg px-2 py-1.5 bg-white">
                  {FITS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </label>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Área da foto no layout</p>
                <div className="grid grid-cols-2 gap-2">
                  <Num label="X" value={pr.x} onChange={(v) => setPhoto({ x: v })} />
                  <Num label="Y" value={pr.y} onChange={(v) => setPhoto({ y: v })} />
                  <Num label="Largura" value={pr.width} onChange={(v) => setPhoto({ width: v })} />
                  <Num label="Altura" value={pr.height} onChange={(v) => setPhoto({ height: v })} />
                </div>
              </div>
              <Num label="Cantos arredondados" value={pr.cornerRadius ?? 0} onChange={(v) => setPhoto({ cornerRadius: v })} />
            </>
          )}

          {tab === 'texts' && (
            <>
              <ul className="space-y-1">
                {value.texts.map((t) => (
                  <li key={t.id}>
                    <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${t.id === selectedText ? 'border-fuchsia-400 bg-fuchsia-50' : 'hover:bg-gray-50'}`}>
                      <button onClick={() => setSelectedText(t.id)} className="flex-1 min-w-0 text-left truncate font-mono text-xs">{t.template || '(vazio)'}</button>
                      <button onClick={() => removeText(t.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Remover este texto">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
                {value.texts.length === 0 && <li className="text-xs text-gray-500">Nenhum texto. A arte terá só a foto e o layout.</li>}
              </ul>

              <details className="rounded-lg border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-blue-700 inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Adicionar texto</summary>
                <div className="p-2 grid grid-cols-2 gap-1.5">
                  {TEXT_PRESETS.map((p) => (
                    <button key={p.label} onClick={() => addText(p.text)} className="px-2 py-1.5 rounded-md border text-xs hover:bg-gray-50 text-left">{p.label}</button>
                  ))}
                </div>
              </details>

              {sel && (
                <div className="space-y-3 rounded-lg border border-fuchsia-200 p-3">
                  <label className="block text-xs text-gray-600">
                    Conteúdo
                    <input value={sel.template} onChange={(e) => setText(sel.id, { template: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 font-mono text-xs" />
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {VARIABLES.map(([v, label]) => (
                      <button key={v} onClick={() => setText(sel.id, { template: `${sel.template}${sel.template ? ' ' : ''}${v}` })} className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-[11px]">+ {label}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Num label="X" value={sel.x} onChange={(v) => setText(sel.id, { x: v })} />
                    <Num label="Y" value={sel.y} onChange={(v) => setText(sel.id, { y: v })} />
                    <Num label="Largura" value={sel.maxWidth} onChange={(v) => setText(sel.id, { maxWidth: v })} />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex rounded-lg border overflow-hidden">
                      {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                        <button key={a} onClick={() => setText(sel.id, { align: a })} className={`p-2 ${sel.align === a ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`} title={`Alinhar ${a}`}>
                          <Icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                    <label className="text-xs text-gray-600">
                      Cor
                      <input type="color" value={sel.fill} onChange={(e) => setText(sel.id, { fill: e.target.value })} className="mt-1 block w-10 h-8 border rounded" />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 pb-2">
                      <input type="checkbox" checked={!!sel.uppercase} onChange={(e) => setText(sel.id, { uppercase: e.target.checked })} /> MAIÚSCULAS
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Num label="Tamanho" value={sel.font.size} onChange={(v) => setText(sel.id, { font: { ...sel.font, size: v } })} />
                    <label className="text-xs text-gray-600 block">
                      Peso
                      <select value={sel.font.weight} onChange={(e) => setText(sel.id, { font: { ...sel.font, weight: Number(e.target.value) } })} className="mt-1 w-full border rounded-lg px-2 py-1.5 bg-white">
                        {[400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </label>
                  </div>
                  <button onClick={() => removeText(sel.id)} className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs">
                    <Trash2 className="w-3.5 h-3.5" /> Remover este texto
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'canvas' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Num label="Largura da arte" value={value.canvas.width} onChange={(v) => onChange({ ...value, canvas: { ...value.canvas, width: v } })} />
                <Num label="Altura da arte" value={value.canvas.height} onChange={(v) => onChange({ ...value, canvas: { ...value.canvas, height: v } })} />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={!!value.layout.resizeToCanvas} onChange={(e) => onChange({ ...value, layout: { ...value.layout, resizeToCanvas: e.target.checked } })} />
                Esticar o layout para o tamanho da arte
              </label>
              <Range
                label="Opacidade do layout"
                min={0} max={1} step={0.05}
                value={value.layout.opacity ?? 1}
                onChange={(v) => onChange({ ...value, layout: { ...value.layout, opacity: v } })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </>
          )}
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

/** Foto de exemplo (silhueta) para configurar layouts sem uma criança específica. */
export function placeholderPhoto(): string {
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = 600; c.height = 800;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 800);
  g.addColorStop(0, '#cbd5e1'); g.addColorStop(1, '#94a3b8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 600, 800);
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath(); ctx.arc(300, 300, 130, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(300, 760, 250, 280, 0, Math.PI, 0); ctx.fill();
  return c.toDataURL('image/png');
}

/** Dados de exemplo para os textos ao configurar um layout. */
export const SAMPLE_CHILD: ComposeSample = {
  name: 'Maria da Silva',
  publicId: 123,
  ageText: '8 anos',
  wantedGift: 'Boneca',
  cityName: 'Cidade',
  communityName: 'Comunidade',
};
