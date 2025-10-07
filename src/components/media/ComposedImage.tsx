'use client';

import { useEffect, useState } from 'react';

type Gravity =
  | 'north'|'northeast'|'east'|'southeast'|'south'|'southwest'|'west'|'northwest'|'center';

type TextSpec = {
  id: string;
  template: string;
  x: number; y: number; maxWidth: number;
  align: 'left'|'center'|'right';
  font: { family: string; size: number; weight: number };
  fill: string;
  uppercase?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
};

export type ComposeConfig = {
  version: number;
  canvas: { width: number; height: number; background: null | { r:number; g:number; b:number; alpha:number } };
  layout: { resizeToCanvas: boolean; opacity?: number; onTop?: boolean };
  photoRect: {
    x:number; y:number; width:number; height:number;
    fit:'cover'|'contain'|'fill'|'inside'|'outside';
    gravity: Gravity; cornerRadius: number;
    scale?: number; offsetX?: number; offsetY?: number;
  };
  texts: TextSpec[];
};

export type ComposeSample = {
  name?: string;
  publicId?: string | number;
  ageText?: string;         // ex: "10 anos"
  wantedGift?: string;
  cityName?: string;
  communityName?: string;
};

type Props = {
  /** URL da foto (processed ou original) */
  photoUrl: string;
  /** URL do layout (PNG/JPG transparente ou cheio) */
  layoutUrl: string;
  /** Config que veio do seu banco (Image.Config) */
  config: ComposeConfig;

  /** Variáveis de template para os textos do config */
  sample?: ComposeSample;

  /** Fallback caso falhe a composição (ex.: framed do backend) */
  fallbackUrl?: string | null;

  /** Atributos visuais */
  alt?: string;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;

  /** Qualidade do JPEG do dataURL (0..1). Padrão 0.9 */
  quality?: number;
};

export default function ComposedImage({
  photoUrl,
  layoutUrl,
  config,
  sample,
  fallbackUrl,
  alt = '',
  className,
  imgClassName,
  style,
  quality = 0.9,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSrc(null);

    (async () => {
      try {
        const dataUrl = await composeFromUrls(photoUrl, layoutUrl, config, {
          name: sample?.name ?? '',
          publicId: String(sample?.publicId ?? ''),
          age: sample?.ageText ?? '',
          wantedGift: sample?.wantedGift ?? '',
          cityName: sample?.cityName ?? '',
          communityName: sample?.communityName ?? '',
        }, quality);
        if (!cancelled) setSrc(dataUrl);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setSrc(fallbackUrl || null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [photoUrl, layoutUrl, JSON.stringify(config), JSON.stringify(sample), quality, fallbackUrl]);

  if (!src) {
    return (
      <div className={className} style={style}>
        <div className={`w-full h-full flex items-center justify-center text-sm text-gray-400 ${imgClassName || ''}`}>
          Carregando…
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      {/* Se falhou e cair no fallback, src pode ser uma URL http(s); se não, será data:image */}
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        crossOrigin="anonymous"
      />
    </div>
  );
}

/* ===================== helpers de composição ===================== */

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // sua API já libera acesso
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number) {
  const radius = Math.min(r, Math.min(w,h)/2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

type TextCtx = {
  name: string; publicId: string; age: string;
  wantedGift: string; cityName: string; communityName: string;
};

async function composeFromUrls(
  photoUrl: string,
  layoutUrl: string,
  cfg: ComposeConfig,
  vars: TextCtx,
  quality = 0.9
) {
  const [photoImg, layoutImg] = await Promise.all([loadImg(photoUrl), loadImg(layoutUrl)]);
  const W = cfg.canvas?.width ?? layoutImg.width ?? 1080;
  const H = cfg.canvas?.height ?? layoutImg.height ?? 1350;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // fundo
  if (cfg.canvas?.background) {
    const bg = cfg.canvas.background;
    ctx.fillStyle = `rgba(${bg.r},${bg.g},${bg.b},${bg.alpha ?? 1})`;
    ctx.fillRect(0,0,W,H);
  }

  // foto
  const pr = cfg.photoRect;
  const dw = pr.width, dh = pr.height;
  const sw = photoImg.width, sh = photoImg.height;
  let r = 1;
  switch (pr.fit) {
    case 'contain': r = Math.min(dw/sw, dh/sh); break;
    case 'fill': r = Math.max(dw/sw, dh/sh); break;
    case 'inside': r = Math.min(dw/sw, dh/sh); break;
    case 'outside': r = Math.max(dw/sw, dh/sh); break;
    default: r = Math.max(dw/sw, dh/sh); // cover
  }
  if (typeof pr.scale === 'number' && pr.scale !== 1) r *= pr.scale;
  const nw = Math.round(sw * r);
  const nh = Math.round(sh * r);
  const ox = Math.round((dw - nw)/2) + (pr.offsetX || 0);
  const oy = Math.round((dh - nh)/2) + (pr.offsetY || 0);
  const dx = pr.x + ox;
  const dy = pr.y + oy;

  if (pr.cornerRadius && pr.cornerRadius > 0) {
    ctx.save(); roundRect(ctx, pr.x, pr.y, pr.width, pr.height, pr.cornerRadius); ctx.clip();
    ctx.drawImage(photoImg, dx, dy, nw, nh); ctx.restore();
  } else {
    ctx.drawImage(photoImg, dx, dy, nw, nh);
  }

  // layout
  const layoutOpacity = Math.max(0, Math.min(1, cfg.layout?.opacity ?? 1));
  if (layoutOpacity < 1) { ctx.save(); ctx.globalAlpha = layoutOpacity; }
  if (cfg.layout?.resizeToCanvas) ctx.drawImage(layoutImg, 0, 0, W, H);
  else ctx.drawImage(layoutImg, 0, 0);
  if (layoutOpacity < 1) ctx.restore();

  // textos
  const drawWrappedText = (t: TextSpec) => {
    let raw = (t.template ?? '')
      .replace(/\{name\}/g, vars.name)
      .replace(/\{publicId\}/g, vars.publicId)
      .replace(/\{age\}/g, vars.age)
      .replace(/\{wantedGift\}/g, vars.wantedGift)
      .replace(/\{cityName\}/g, vars.cityName)
      .replace(/\{communityName\}/g, vars.communityName);
    if (t.uppercase) raw = raw.toUpperCase();

    ctx.save();
    const fontSize = t.font?.size ?? 42;
    const lineH = (t.lineHeight ?? 1.1) * fontSize;
    ctx.font = `${t.font?.weight ?? 700} ${fontSize}px ${t.font?.family ?? 'Inter, system-ui, sans-serif'}`;
    ctx.fillStyle = t.fill ?? '#000';
    ctx.textAlign = (t.align as CanvasTextAlign) ?? 'left';
    ctx.textBaseline = 'top';

    const maxW = t.maxWidth ?? W;
    const words = raw.split(/\s+/);
    let line = '';
    let y = t.y;

    const measure = (s: string) => {
      if ((t.letterSpacing ?? 0) === 0) return ctx.measureText(s).width;
      const base = ctx.measureText(s).width;
      const extra = (s.length - 1) * (t.letterSpacing ?? 0);
      return base + extra;
    };

    const drawLine = (s: string) => {
      let x = t.x;
      if (t.align === 'center') x = t.x + maxW / 2;
      if (t.align === 'right') x = t.x + maxW;
      if ((t.letterSpacing ?? 0) === 0) {
        ctx.fillText(s, x, y, maxW);
      } else {
        let cx = x;
        if (t.align === 'center') cx = x - measure(s)/2;
        if (t.align === 'right') cx = x - measure(s);
        for (let i=0;i<s.length;i++) {
          const ch = s[i];
          ctx.fillText(ch, cx, y);
          cx += ctx.measureText(ch).width + (t.letterSpacing ?? 0);
        }
      }
    };

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (measure(test) <= maxW) line = test;
      else { if (line) drawLine(line); y += lineH; line = w; }
    }
    if (line) drawLine(line);
    ctx.restore();
  };

  (cfg.texts || []).forEach(drawWrappedText);

  return canvas.toDataURL('image/jpeg', quality);
}
