// lib/pdf/exportSponsorshipsPdfGrid.ts
import jsPDF from 'jspdf';

type ComposeConfig = {
  version: number;
  canvas: { width: number; height: number; background: string | null };
  layout: { onTop?: boolean; opacity?: number; resizeToCanvas?: boolean };
  photoRect: {
    x: number; y: number; width: number; height: number;
    fit: 'cover' | 'contain';
    scale: number;
    gravity: 'north'|'northeast'|'east'|'southeast'|'south'|'southwest'|'west'|'northwest'|'center';
    offsetX: number; offsetY: number; cornerRadius: number;
  };
  texts: Array<{
    text: string;
    x: number; y: number;
    maxWidth?: number;
    fontSize?: number;
    fontFamily?: string;
    fontStyle?: 'normal'|'bold'|'italic'|'bolditalic';
    color?: string; // hex ou rgba
    align?: 'left'|'center'|'right';
  }>;
};

export type PdfChildInput = {
  id: string;
  name: string;
  publicId?: number | null;
  age?: number | null;
  city?: string | null;
  community?: string | null;
  school?: string | null;
  wantedGift?: string | null;
  // fontes de imagem
  processedUrl?: string | null;  // base/foto tratada
  layoutUrl?: string | null;     // PNG com moldura
  config?: ComposeConfig | null; // JSON de composição
  // fallbacks
  framedUrl?: string | null;
  photoUrl?: string | null;
};

export type PdfCampaign = {
  id: string;
  name: string;
  year?: number | null;
};

export type PdfItem = {
  sponsorshipId: string;
  status: 'PENDING' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
  child: PdfChildInput;
  campaign: PdfCampaign;
};

const DEFAULT_CONFIG: ComposeConfig = {
  version: 1,
  canvas: { width: 1080, height: 1920, background: null },
  layout: { onTop: true, opacity: 1, resizeToCanvas: true },
  photoRect: {
    x: 0, y: 0, width: 1080, height: 1440,
    fit: 'cover', scale: 1, gravity: 'center',
    offsetX: 0, offsetY: 0, cornerRadius: 0
  },
  texts: []
};

function toRGBA(ctx: CanvasRenderingContext2D, color?: string) {
  if (!color) return 'rgba(0,0,0,1)';
  return color;
}

function gravityToAnchor(g: ComposeConfig['photoRect']['gravity']) {
  // retorna [ax, ay] em [0..1] para posicionar a imagem dentro do retângulo alvo
  switch (g) {
    case 'north': return [0.5, 0];
    case 'northeast': return [1, 0];
    case 'east': return [1, 0.5];
    case 'southeast': return [1, 1];
    case 'south': return [0.5, 1];
    case 'southwest': return [0, 1];
    case 'west': return [0, 0.5];
    case 'northwest': return [0, 0];
    default: return [0.5, 0.5]; // center
  }
}

function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dWidth: number, dHeight: number,
  radius: number
) {
  if (radius > 0) {
    ctx.save();
    const r = Math.min(radius, Math.min(dWidth, dHeight) / 2);
    const path = new Path2D();
    path.moveTo(dx + r, dy);
    path.arcTo(dx + dWidth, dy, dx + dWidth, dy + dHeight, r);
    path.arcTo(dx + dWidth, dy + dHeight, dx, dy + dHeight, r);
    path.arcTo(dx, dy + dHeight, dx, dy, r);
    path.arcTo(dx, dy, dx + dWidth, dy, r);
    ctx.clip(path);
    ctx.drawImage(img, dx, dy, dWidth, dHeight);
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, dy, dWidth, dHeight);
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous'; // importante para não “tintar” o canvas (requer CORS no host)
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function composeToDataURL(
  child: PdfChildInput,
  cfg: ComposeConfig,
  sample: { name: string; publicId?: number | null; age?: number | null; city?: string | null; community?: string | null; gift?: string | null; }
): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const W = cfg.canvas.width || DEFAULT_CONFIG.canvas.width;
  const H = cfg.canvas.height || DEFAULT_CONFIG.canvas.height;

  canvas.width = W;
  canvas.height = H;

  // Background
  if (cfg.canvas.background) {
    ctx.fillStyle = cfg.canvas.background;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.clearRect(0, 0, W, H);
  }

  // Base photo (processedUrl é a ideal para composição)
  if (!child.processedUrl) throw new Error('processedUrl ausente');
  const photo = await loadImage(child.processedUrl);

  const pr = cfg.photoRect;
  const targetX = pr.x;
  const targetY = pr.y;
  const targetW = pr.width;
  const targetH = pr.height;

  // calcular escala e recorte (cover/contain)
  const sx0 = 0, sy0 = 0, sW0 = photo.naturalWidth, sH0 = photo.naturalHeight;
  const scaleFit =
    pr.fit === 'cover'
      ? Math.max(targetW / sW0, targetH / sH0)
      : Math.min(targetW / sW0, targetH / sH0);

  const scale = scaleFit * (pr.scale || 1);
  const drawW = sW0 * scale;
  const drawH = sH0 * scale;

  // gravidade
  const [ax, ay] = gravityToAnchor(pr.gravity);
  let dx = targetX + (targetW - drawW) * ax + (pr.offsetX || 0);
  let dy = targetY + (targetH - drawH) * ay + (pr.offsetY || 0);

  drawRoundedImage(ctx, photo, dx, dy, drawW, drawH, pr.cornerRadius || 0);

  // overlay (layoutUrl)
  if (child.layoutUrl) {
    const overlay = await loadImage(child.layoutUrl);
    let overlayW = overlay.naturalWidth;
    let overlayH = overlay.naturalHeight;

    let ox = 0, oy = 0, oW = overlayW, oH = overlayH;

    if (cfg.layout?.resizeToCanvas) {
      oW = W; oH = H;
    }

    const opacity = Math.max(0, Math.min(1, cfg.layout?.opacity ?? 1));
    ctx.save();
    ctx.globalAlpha = opacity;
    if (cfg.layout?.onTop !== false) {
      // padrão é acima da foto
      ctx.drawImage(overlay, ox, oy, oW, oH);
    } else {
      // caso queira sob a foto (raro), desenhe antes da foto
      // deixei aqui por compat; mas já desenhamos foto acima.
      // se precisar MESMO sob a foto, mova este bloco antes do drawRoundedImage.
      ctx.drawImage(overlay, ox, oy, oW, oH);
    }
    ctx.restore();
  }

  // texts
  if (Array.isArray(cfg.texts)) {
    for (const t of cfg.texts) {
      const text = replaceTokens(t.text ?? '', sample);
      ctx.save();
      ctx.font = `${t.fontStyle === 'bold' ? 'bold ' : t.fontStyle === 'italic' ? 'italic ' : t.fontStyle === 'bolditalic' ? 'bold italic ' : ''}${t.fontSize || 32}px ${t.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = toRGBA(ctx, t.color || '#000');
      ctx.textAlign = (t.align || 'left') as CanvasTextAlign;
      const maxW = t.maxWidth ?? undefined;

      // alinhamento manual para left/center/right
      let tx = t.x;
      if (t.align === 'center') tx = t.x;
      if (t.align === 'right') tx = t.x;
      // y já é a linha de base (como no canvas)

      if (maxW) {
        // quebra simples por palavras
        const lines = wrapText(ctx, text, maxW);
        const lh = (t.fontSize || 32) * 1.15;
        lines.forEach((ln, i) => {
          ctx.fillText(ln, tx, t.y + i * lh, maxW);
        });
      } else {
        ctx.fillText(text, tx, t.y);
      }
      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const wWidth = ctx.measureText(test).width;
    if (wWidth > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function replaceTokens(input: string, s: { name: string; publicId?: number | null; age?: number | null; city?: string | null; community?: string | null; gift?: string | null; }) {
  return input
    .replace(/\{name\}/g, s.name ?? '')
    .replace(/\{publicId\}/g, String(s.publicId ?? ''))
    .replace(/\{age\}/g, s.age != null ? `${s.age}` : '')
    .replace(/\{city\}/g, s.city ?? '')
    .replace(/\{community\}/g, s.community ?? '')
    .replace(/\{gift\}/g, s.gift ?? '');
}

async function fetchAsDataURL(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Exporta PDF em A4 (portrait), 4 crianças por página (2×2),
 * mantendo o aspecto do canvas de composição.
 */
// lib/pdf/exportSponsorshipsPdfGrid.ts

export async function exportSponsorshipsPdfGrid(
  items: PdfItem[],
  opts?: { fileName?: string; onProgress?: (p: { current: number; total: number; phase: 'compose'|'pdf' }) => void }
) {
  if (!items?.length) return;

  const total = items.length;
  const report = (i: number, phase: 'compose'|'pdf') => {
    opts?.onProgress?.({ current: i, total, phase });
  };

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const innerW = pageW - margin * 2;
  const innerH = pageH - margin * 2;
  const gutter = 16;

  const cols = 2, rows = 2;

  const composedList: Array<{ dataURL: string; cfg: ComposeConfig; child: PdfChildInput; camp: PdfCampaign; status: PdfItem['status'] }> = [];

  // === FASE 1: composição das imagens ===
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const c = it.child;
    const cfg = c.config || DEFAULT_CONFIG;

    const sample = {
      name: c.name,
      publicId: c.publicId ?? null,
      age: c.age ?? null,
      city: c.city ?? null,
      community: c.community ?? null,
      gift: c.wantedGift ?? null
    };

    let dataURL: string | null = null;
    try {
      if (!c.processedUrl) throw new Error('sem processedUrl');
      dataURL = await composeToDataURL(c, cfg, sample);
    } catch {
      const best = c.framedUrl || c.processedUrl || c.photoUrl;
      if (best) {
        try { dataURL = await fetchAsDataURL(best); } catch {}
      }
    }
    if (!dataURL) {
      const ph = document.createElement('canvas');
      ph.width = cfg.canvas.width; ph.height = cfg.canvas.height;
      const pctx = ph.getContext('2d')!;
      pctx.fillStyle = '#f1f5f9';
      pctx.fillRect(0, 0, ph.width, ph.height);
      pctx.fillStyle = '#64748b';
      pctx.font = 'bold 40px sans-serif';
      pctx.textAlign = 'center';
      pctx.fillText('Sem imagem', ph.width/2, ph.height/2);
      dataURL = ph.toDataURL('image/png');
    }

    composedList.push({ dataURL, cfg, child: c, camp: it.campaign, status: it.status });

    // feedback de composição (1-indexed para UX)
    report(idx + 1, 'compose');
    // yield ao browser para não travar a UI (opcional)
    await new Promise(r => setTimeout(r, 0));
  }

  // === FASE 2: desenhar no PDF ===
  let i = 0;
  while (i < composedList.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Meus Apadrinhamentos', margin, margin - 10);

    for (let r = 0; r < rows && i < composedList.length; r++) {
      for (let c = 0; c < cols && i < composedList.length; c++, i++) {
        const slotX = margin + c * ((innerW - gutter) / 2 + gutter);
        const slotY = margin + r * ((innerH - gutter) / 2 + gutter);
        const slotW = (innerW - gutter) / 2;
        const slotH = (innerH - gutter) / 2;

        const { dataURL, cfg, child, camp, status } = composedList[i];

        const aspect = (cfg.canvas.width || DEFAULT_CONFIG.canvas.width) / (cfg.canvas.height || DEFAULT_CONFIG.canvas.height);
        let drawW = slotW;
        let drawH = drawW / aspect;
        if (drawH > slotH * 0.8) {
          drawH = slotH * 0.8;
          drawW = drawH * aspect;
        }
        const imgX = slotX + (slotW - drawW) / 2;
        const imgY = slotY + 8;

        const isPng = dataURL.startsWith('data:image/png');
        pdf.addImage(dataURL, isPng ? 'PNG' : 'JPEG', imgX, imgY, drawW, drawH, '', 'FAST');

        const textX = slotX;
        let textY = imgY + drawH + 12;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        const nomeLine = `${child.name}${typeof child.publicId === 'number' ? ` — #${child.publicId}` : ''}`;
        pdf.text(nomeLine, textX, textY, { maxWidth: slotW });
        textY += 14;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const campLine = `${camp.name}${camp.year ? ` (${camp.year})` : ''}`;
        pdf.text(campLine, textX, textY, { maxWidth: slotW });
        textY += 12;

        const loc = [child.city, child.community, child.school].filter(Boolean).join(' • ') || '';
        if (loc) {
          pdf.setTextColor(90);
          pdf.text(loc, textX, textY, { maxWidth: slotW });
          pdf.setTextColor(0);
          textY += 12;
        }

        {/* 
        const label = status === 'ACTIVE' ? 'Ativo' : status === 'PENDING' ? 'Pendente' : status === 'ENDED' ? 'Encerrado' : status === 'CANCELLED' ? 'Cancelado' : String(status);
        pdf.setTextColor(60);
        pdf.text(`Status: ${label}`, textX, textY, { maxWidth: slotW });
        pdf.setTextColor(0);
        */}

        // feedback durante a fase PDF também (i é 1-indexado p/ UX)
        report(i, 'pdf');
      }
    }

    if (i < composedList.length) pdf.addPage();
  }

  const fileName = opts?.fileName || `meus-apadrinhamentos-${new Date().toISOString().slice(0,10)}.pdf`;
  pdf.save(fileName);
}