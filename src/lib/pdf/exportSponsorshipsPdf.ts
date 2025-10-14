// lib/pdf/exportSponsorshipsPdf.ts
import jsPDF from 'jspdf';

/* ===== Tipos ===== */

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
    color?: string;
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
  processedUrl?: string | null; // base/foto tratada
  layoutUrl?: string | null;    // PNG com moldura
  config?: ComposeConfig | null;
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

export type ExportPdfOptions = {
  fileName?: string;
  onProgress?: (p: { current: number; total: number; phase: 'compose'|'pdf' }) => void;
  /** quantidade por página (1,2,3,4,6,8,9…) — columns/rows têm prioridade */
  perPage?: number;
  columns?: number;
  rows?: number;
};

/* ===== Defaults ===== */

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

/* ===== Helpers de canvas/composição ===== */

function gravityToAnchor(g: ComposeConfig['photoRect']['gravity']) {
  switch (g) {
    case 'north': return [0.5, 0];
    case 'northeast': return [1, 0];
    case 'east': return [1, 0.5];
    case 'southeast': return [1, 1];
    case 'south': return [0.5, 1];
    case 'southwest': return [0, 1];
    case 'west': return [0, 0.5];
    case 'northwest': return [0, 0];
    default: return [0.5, 0.5];
  }
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
  img.crossOrigin = 'anonymous'; // precisa CORS
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
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

async function composeToDataURL(
  child: PdfChildInput,
  cfg: ComposeConfig,
  sample: { name: string; publicId?: number | null; age?: number | null; city?: string | null; community?: string | null; gift?: string | null; }
): Promise<string> {
  const W = cfg.canvas.width || DEFAULT_CONFIG.canvas.width;
  const H = cfg.canvas.height || DEFAULT_CONFIG.canvas.height;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = W; canvas.height = H;

  // background
  if (cfg.canvas.background) {
    ctx.fillStyle = cfg.canvas.background;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.clearRect(0, 0, W, H);
  }

  if (!child.processedUrl) throw new Error('processedUrl ausente');
  const photo = await loadImage(child.processedUrl);

  const pr = cfg.photoRect;
  const targetX = pr.x;
  const targetY = pr.y;
  const targetW = pr.width;
  const targetH = pr.height;

  const sW0 = photo.naturalWidth, sH0 = photo.naturalHeight;
  const scaleFit =
    pr.fit === 'cover'
      ? Math.max(targetW / sW0, targetH / sH0)
      : Math.min(targetW / sW0, targetH / sH0);

  const scale = scaleFit * (pr.scale || 1);
  const drawW = sW0 * scale;
  const drawH = sH0 * scale;

  const [ax, ay] = gravityToAnchor(pr.gravity);
  const dx = targetX + (targetW - drawW) * ax + (pr.offsetX || 0);
  const dy = targetY + (targetH - drawH) * ay + (pr.offsetY || 0);

  drawRoundedImage(ctx, photo, dx, dy, drawW, drawH, pr.cornerRadius || 0);

  // overlay
  if (child.layoutUrl) {
    const overlay = await loadImage(child.layoutUrl);
    let oW = overlay.naturalWidth, oH = overlay.naturalHeight;
    let ox = 0, oy = 0;
    if (cfg.layout?.resizeToCanvas) { oW = W; oH = H; }
    const opacity = Math.max(0, Math.min(1, cfg.layout?.opacity ?? 1));
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(overlay, ox, oy, oW, oH);
    ctx.restore();
  }

  // texts
  if (Array.isArray(cfg.texts)) {
    for (const t of cfg.texts) {
      const text = replaceTokens(t.text ?? '', sample);
      ctx.save();
      const style =
        t.fontStyle === 'bold' ? 'bold ' :
        t.fontStyle === 'italic' ? 'italic ' :
        t.fontStyle === 'bolditalic' ? 'bold italic ' : '';
      ctx.font = `${style}${t.fontSize || 32}px ${t.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = t.color || '#000';
      ctx.textAlign = (t.align || 'left') as CanvasTextAlign;

      const maxW = t.maxWidth ?? undefined;
      if (maxW) {
        const lines = wrapText(ctx, text, maxW);
        const lh = (t.fontSize || 32) * 1.15;
        lines.forEach((ln, i) => {
          ctx.fillText(ln, t.x, t.y + i * lh, maxW);
        });
      } else {
        ctx.fillText(text, t.x, t.y);
      }
      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
}

/* ===== Helpers de layout PDF ===== */

function gridFromOptions(perPage?: number): { cols: number; rows: number } {
  switch (perPage) {
    case 1: return { cols: 1, rows: 1 };
    case 2: return { cols: 2, rows: 1 };
    case 3: return { cols: 3, rows: 1 };
    case 4: return { cols: 2, rows: 2 };
    case 6: return { cols: 3, rows: 2 };
    case 8: return { cols: 4, rows: 2 };
    case 9: return { cols: 3, rows: 3 };
    default: return { cols: 2, rows: 2 };
  }
}

function legendScaleForDensity(density: number): number {
  // antes era agressivo; agora é mais contido
  if (density <= 1) return 1.35;
  if (density === 2) return 1.25;
  if (density === 3) return 1.15;
  if (density === 4) return 1.05;
  if (density === 6) return 1.00;
  if (density === 8) return 0.95;
  return 0.92; // 9+
}

function captionRatioForDensity(density: number): number {
  if (density <= 1) return 0.40;
  if (density === 2) return 0.34;
  if (density === 3) return 0.30;
  if (density === 4) return 0.28;
  if (density === 6) return 0.25;
  return 0.23; // 8+
}

/* ===== Função principal ===== */

export async function exportSponsorshipsPdf(
  items: PdfItem[],
  opts?: ExportPdfOptions
) {
  if (!items?.length) return;

  const report = (i: number, total: number, phase: 'compose'|'pdf') =>
    opts?.onProgress?.({ current: i, total, phase });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  const total = items.length;

  // ---- grade
  let cols = 2, rows = 2;
  if (opts?.columns && opts?.rows) {
    cols = opts.columns; rows = opts.rows;
  } else {
    const g = gridFromOptions(opts?.perPage);
    cols = g.cols; rows = g.rows;
  }

  // margens/gutter dinâmicos (reduz quando há menos cartões para ocupar mais a página)
  const density = cols * rows;
  const baseMargin = 34, denseMargin = 28, ultraMargin = 20;
  const margin = density <= 2 ? 28 : density >= 8 ? ultraMargin : density >= 6 ? denseMargin : baseMargin;
  const gutter = density <= 2 ? 18 : density >= 8 ? 10 : density >= 6 ? 12 : 16;

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const innerW = pageW - margin * 2;
  const innerH = pageH - margin * 2;

  // ===== FASE 1: compor imagens (ou pegar fallback)
  const composed: Array<{ dataURL: string; cfg: ComposeConfig; child: PdfChildInput; camp: PdfCampaign; status: PdfItem['status'] }> = [];

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const child = it.child;
    const cfg = child.config || DEFAULT_CONFIG;

    const sample = {
      name: child.name,
      publicId: child.publicId ?? null,
      age: child.age ?? null,
      city: child.city ?? null,
      community: child.community ?? null,
      gift: child.wantedGift ?? null
    };

    let dataURL: string | null = null;

    try {
      if (!child.processedUrl) throw new Error('sem processedUrl');
      dataURL = await composeToDataURL(child, cfg, sample);
    } catch {
      const best = child.framedUrl || child.processedUrl || child.photoUrl;
      if (best) {
        try { dataURL = await fetchAsDataURL(best); } catch {}
      }
    }

    if (!dataURL) {
      // placeholder
      const W = cfg.canvas.width || DEFAULT_CONFIG.canvas.width;
      const H = cfg.canvas.height || DEFAULT_CONFIG.canvas.height;
      const ph = document.createElement('canvas');
      ph.width = W; ph.height = H;
      const pctx = ph.getContext('2d')!;
      pctx.fillStyle = '#f1f5f9'; pctx.fillRect(0, 0, W, H);
      pctx.fillStyle = '#64748b';
      pctx.font = 'bold 40px sans-serif';
      pctx.textAlign = 'center';
      pctx.fillText('Sem imagem', W/2, H/2);
      dataURL = ph.toDataURL('image/png');
    }

    composed.push({ dataURL, cfg, child, camp: it.campaign, status: it.status });
    report(idx + 1, total, 'compose');
    await new Promise(r => setTimeout(r, 0)); // yield
  }

  // ===== FASE 2: desenhar no PDF (sem cabeçalho global)
  let i = 0;
  while (i < composed.length) {
    // --- dentro do while (páginas) ---
    for (let r = 0; r < rows && i < composed.length; r++) {
      for (let c = 0; c < cols && i < composed.length; c++, i++) {
        const slotW = (innerW - gutter * (cols - 1)) / cols;
        const slotH = (innerH - gutter * (rows - 1)) / rows;

        const slotX = margin + c * (slotW + gutter);
        const slotY = margin + r * (slotH + gutter);

        const { dataURL, cfg, child, camp } = composed[i];

        // manter aspecto do canvas do Config
        const aspect =
          (cfg.canvas.width || DEFAULT_CONFIG.canvas.width) /
          (cfg.canvas.height || DEFAULT_CONFIG.canvas.height);

        // gap entre imagem e legenda (um pouco maior com poucas imagens por página)
        const legendGap = (cols * rows) <= 2 ? 18 : (cols * rows) <= 4 ? 14 : 10;

        // ===== 1) dimensionamento inicial assumindo imagem em toda a largura do slot
        let drawW = slotW;
        let drawH = drawW / aspect;

        // escala de fonte baseada na densidade + largura da imagem (estimativa)
        const density = cols * rows;

        // multiplicador “suave” por densidade (função acima)
        const densityScale = legendScaleForDensity(density);

        // multiplicador por largura real da imagem (clamp mais estreito)
        const widthScale = Math.max(0.9, Math.min(1.20, drawW / 360));

        // multiplicador global opcional vindo das opções
        const userScale = (1);

        // base sizes
        const baseTitle = 11;
        const baseSub   = 10;
        const baseMeta  = 9;

        // helper clamp
        const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

        // aplica escalas e limita tamanho min/máx (evita exageros)
        const titleSize = clamp(Math.round(baseTitle * densityScale * widthScale * userScale), 9, 16);
        const subSize   = clamp(Math.round(baseSub   * densityScale * widthScale * userScale), 8, 14);
        const metaSize  = clamp(Math.round(baseMeta  * densityScale * widthScale * userScale), 8, 12);

        // strings da legenda
        const nomeLine = `${child.name}${typeof child.publicId === 'number' ? ` — #${child.publicId}` : ''}`;
        const campLine = `${camp.name}${camp.year ? ` (${camp.year})` : ''}`;
        const ageLine  = (typeof child.age === 'number' && !Number.isNaN(child.age)) ? `Idade: ${child.age} ${child.age === 1 ? 'ano' : 'anos'}` : '';
        const locLine  = [child.city, child.community].filter(Boolean).join(' • ');
        const schoolLn = child.school ? String(child.school) : '';
        const giftLine = child.wantedGift ? `Presente: ${child.wantedGift}` : '';

        // ===== 2) ESTIMAR ALTURA DA LEGENDA (wrap pelo drawW atual)
        const linesNome   = pdf.splitTextToSize(nomeLine, drawW);
        const linesCamp   = pdf.splitTextToSize(campLine, drawW);
        const linesAge    = ageLine   ? pdf.splitTextToSize(ageLine, drawW)   : [];
        const linesLoc    = locLine   ? pdf.splitTextToSize(locLine, drawW)   : [];
        const linesSchool = schoolLn  ? pdf.splitTextToSize(schoolLn, drawW)  : [];
        const linesGift   = giftLine  ? pdf.splitTextToSize(giftLine, drawW)  : [];

        const lineH = (size: number) => size * 1.25;
        let legendHeight =
          legendGap +
          (linesNome.length   ? linesNome.length   * lineH(titleSize) : 0) +
          (linesCamp.length   ? linesCamp.length   * lineH(subSize)   : 0) +
          (linesAge.length    ? linesAge.length    * lineH(metaSize)  : 0) +
          (linesLoc.length    ? linesLoc.length    * lineH(metaSize)  : 0) +
          (linesSchool.length ? linesSchool.length * lineH(metaSize)  : 0) +
          (linesGift.length   ? linesGift.length   * lineH(metaSize)  : 0);

        // ===== 3) dar à IMAGEM TODO o espaço restante (sem cortar legenda)
        // altura máxima possível para imagem dentro do slot
        let imgMaxH = Math.max(0, slotH - legendHeight);

        // se a imagem, usando slotW, ficar mais alta do que pode, reduz para caber
        if (drawH > imgMaxH) {
          drawH = imgMaxH;
          drawW = drawH * aspect;
          // (opcional) recomputar wrapping com nova largura da imagem — geralmente não necessário,
          // mas se quiser ser 100% exato, reexecute splitTextToSize com drawW atualizado.
        }

        // centralizar imagem
        const imgX = slotX + (slotW - drawW) / 2;
        const imgY = slotY + 4;

        // desenhar imagem
        const isPng = dataURL.startsWith('data:image/png');
        pdf.addImage(dataURL, isPng ? 'PNG' : 'JPEG', imgX, imgY, drawW, drawH, '', 'FAST');

        // ===== 4) LEGENDA ancorada à largura da IMAGEM
        const textX = imgX;
        let textY = imgY + drawH + legendGap;

        const write = (text: string, font: 'bold'|'normal', size: number, color?: number) => {
          if (!text) return;
          if (typeof color === 'number') pdf.setTextColor(color);
          pdf.setFont('helvetica', font);
          pdf.setFontSize(size);
          const wrapped = pdf.splitTextToSize(text, drawW);
          pdf.text(wrapped, textX, textY, { maxWidth: drawW });
          textY += lineH(size) * wrapped.length;
          pdf.setTextColor(0);
        };

        // Nome + publicId
        write(nomeLine, 'bold', titleSize);

        // Campanha
        write(campLine, 'normal', subSize);

        // Idade
        if (ageLine) write(ageLine, 'normal', metaSize, 90);

        // Cidade • Comunidade
        if (locLine) write(locLine, 'normal', metaSize, 90);

        // Escola (linha separada)
        if (schoolLn) write(schoolLn, 'normal', metaSize, 90);

        // Presente
        if (giftLine) write(giftLine, 'normal', metaSize, 60);

        report(i, total, 'pdf');
      }
    }

    if (i < composed.length) pdf.addPage();
  }

  const fileName = opts?.fileName || `meus-apadrinhamentos-${new Date().toISOString().slice(0,10)}.pdf`;
  pdf.save(fileName);
}
