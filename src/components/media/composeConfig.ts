/* Modelo de composição salvo em ChildImage.Config: a tela de apadrinhamento monta a
   arte (foto + layout + textos) com ele toda vez que exibe a criança. */

export type Gravity =
  | 'north' | 'northeast' | 'east' | 'southeast'
  | 'south' | 'southwest' | 'west' | 'northwest' | 'center';

export type PhotoRect = {
  x: number; y: number; width: number; height: number;
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  gravity: Gravity;
  cornerRadius: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
};

export type TextSpec = {
  id: string;
  template: string;
  x: number;
  y: number;
  maxWidth: number;
  align: 'left'|'center'|'right';
  font: { family: string; size: number; weight: number };
  fill: string;
  uppercase?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
};

export type ComposeConfig = {
  version: number;
  canvas: { width: number; height: number; background?: null | { r:number; g:number; b:number; alpha:number } };
  layout: { resizeToCanvas: boolean; opacity?: number; onTop?: boolean }; // <— novo onTop
  photoRect: PhotoRect;
  texts: TextSpec[];
};

export const DEFAULT_COMPOSE_CONFIG: ComposeConfig = {
  version: 2,
  canvas: { width: 1080, height: 1350, background: null },
  layout: { resizeToCanvas: true, opacity: 1, onTop: true },
  photoRect: {
    x: 60, y: 200, width: 960, height: 960,
    fit: 'cover', gravity: 'center', cornerRadius: 0,
    scale: 1, offsetX: 0, offsetY: 0
  },
  texts: [
    {
      id: 'name',
      template: '{name}',
      x: 72, y: 140, maxWidth: 936,
      align: 'center',
      font: { family: 'Inter, sans-serif', size: 54, weight: 800 },
      fill: '#0f172a',
      uppercase: true, letterSpacing: 0, lineHeight: 1.1
    },
    {
      id: 'meta',
      template: 'ID {publicId} • {age} • {cityName}',
      x: 72, y: 1180, maxWidth: 936,
      align: 'center',
      font: { family: 'Inter, sans-serif', size: 40, weight: 700 },
      fill: '#111827'
    },
    {
      id: 'gift',
      template: '{wantedGift}',
      x: 72, y: 1240, maxWidth: 936,
      align: 'center',
      font: { family: 'Inter, sans-serif', size: 34, weight: 600 },
      fill: '#374151'
    }
  ]
};

export function deepMerge<T>(a: T, b: any): T {
  const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(a)) return (b ?? a) as T;
  if (!isObj(b)) return a;
  const out: any = Array.isArray(a) ? [...(a as any)] : { ...(a as any) };
  for (const k of Object.keys(b)) {
    const av = (a as any)[k], bv = b[k];
    if (Array.isArray(bv)) out[k] = bv;
    else if (isObj(bv)) out[k] = deepMerge(av ?? {}, bv);
    else out[k] = bv;
  }
  return out;
}

/** Configuração completa de um layout, igual à usada no cadastro guiado: padrão + o que o layout define. */
export function composeConfigForFrame(frameConfig?: unknown): ComposeConfig {
  const raw = typeof frameConfig === 'string' ? safeParse(frameConfig) : frameConfig;
  return deepMerge(DEFAULT_COMPOSE_CONFIG, raw ?? {});
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}
