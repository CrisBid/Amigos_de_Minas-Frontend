// lib/pdf/exportSponsorshipsPdf.ts
// PDF dos apadrinhamentos (admin e "Meus apadrinhamentos").
// A arte de cada criança é montada pelo mesmo compositor do site (foto + layout + textos);
// sem foto na campanha, sai só o layout com a área da foto vazia.
import jsPDF from 'jspdf';
import { STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';
import { composeFromUrls, type ComposeConfig as ArtConfig } from '@/components/media/ComposedImage';
import { composeConfigForFrame } from '@/components/media/composeConfig';

/* ===== Tipos ===== */

export type PdfChildInput = {
  id: string;
  name: string;
  publicId?: number | null;
  age?: number | null;
  city?: string | null;
  community?: string | null;
  school?: string | null;
  wantedGift?: string | null;
  /** foto DESTA campanha (sem foto: null; nunca a de campanhas anteriores) */
  photoUrl?: string | null;
  layoutUrl?: string | null;
  config?: unknown;
  /** arte pronta do servidor (reserva se a montagem falhar) */
  framedUrl?: string | null;
};

export type PdfCampaign = { id: string; name: string; year?: number | null };

export type PdfItem = {
  sponsorshipId: string;
  status: SponsorshipStatus;
  method?: 'PIX' | 'GIFT' | null;
  sponsorName?: string | null;
  collectionPoint?: string | null;
  child: PdfChildInput;
  campaign: PdfCampaign;
};

export type ExportPdfOptions = {
  fileName?: string;
  /** título do resumo e do rodapé (ex.: nome do padrinho) */
  title?: string;
  perPage?: number;
  /** 0.85 (menor) a 1.2 (maior) */
  textScale?: number;
  /** legenda com nome, idade, local, presente e status abaixo de cada arte */
  caption?: boolean;
  /** primeira página com a lista de todas as crianças */
  summary?: boolean;
  onProgress?: (p: { current: number; total: number; phase: 'compose' | 'pdf' }) => void;
  signal?: { cancelled: boolean };
};

export type ExportResult = { cards: number; withoutPhoto: number; pages: number; cancelled?: boolean };

/* ===== Cores dos status (as mesmas do site) ===== */

const STATUS_RGB: Record<SponsorshipStatus, [number, number, number]> = {
  PENDING: [217, 119, 6],
  IN_PROGRESS: [2, 132, 199],
  AWAITING_DELIVERY: [234, 88, 12],
  IN_PURCHASE: [79, 70, 229],
  PACKED: [124, 58, 237],
  BOXED: [192, 38, 211],
  COMPLETED: [5, 150, 105],
  ENDED: [71, 85, 105],
  CANCELLED: [225, 29, 72],
};
const tint = ([r, g, b]: [number, number, number], k = 0.88): [number, number, number] =>
  [Math.round(r + (255 - r) * k), Math.round(g + (255 - g) * k), Math.round(b + (255 - b) * k)];

/* ===== Montagem das artes ===== */

const JPEG_QUALITY = 0.86;

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Cartão neutro quando não há layout nem foto */
function placeholderCard(cfg: ArtConfig, label: string) {
  const W = cfg.canvas?.width || 1080, H = cfg.canvas?.height || 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${Math.round(W / 18)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, H / 2);
  return c.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** Só a foto, sem layout (campanha sem layout definido) */
async function photoOnly(url: string, cfg: ArtConfig) {
  const img = await loadImage(url);
  const W = cfg.canvas?.width || 1080, H = cfg.canvas?.height || 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const r = Math.max(W / img.width, H / img.height);
  ctx.drawImage(img, (W - img.width * r) / 2, (H - img.height * r) / 2, img.width * r, img.height * r);
  return c.toDataURL('image/jpeg', JPEG_QUALITY);
}

async function fetchAsDataURL(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function composeCard(it: PdfItem): Promise<{ dataURL: string; aspect: number }> {
  const child = it.child;
  const cfg = composeConfigForFrame(child.config) as unknown as ArtConfig;
  const aspect = (cfg.canvas?.width || 1080) / (cfg.canvas?.height || 1350);
  const vars = {
    name: child.name ?? '',
    publicId: child.publicId != null ? String(child.publicId) : '',
    age: typeof child.age === 'number' ? `${child.age} ${child.age === 1 ? 'ano' : 'anos'}` : '',
    wantedGift: child.wantedGift ?? '',
    cityName: child.city ?? '',
    communityName: child.community ?? '',
  };
  try {
    if (child.layoutUrl) return { dataURL: await composeFromUrls(child.photoUrl || '', child.layoutUrl, cfg, vars, JPEG_QUALITY), aspect };
    if (child.photoUrl) return { dataURL: await photoOnly(child.photoUrl, cfg), aspect };
  } catch {
    // reserva: arte pronta do servidor (só existe quando há foto desta campanha)
    if (child.framedUrl) {
      try { return { dataURL: await fetchAsDataURL(child.framedUrl), aspect }; } catch { /* segue */ }
    }
  }
  return { dataURL: placeholderCard(cfg, child.photoUrl ? 'Imagem indisponível' : 'Sem foto'), aspect };
}

async function runPool<T>(items: T[], size: number, fn: (it: T, i: number) => Promise<void>) {
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

/* ===== Layout das páginas ===== */

function gridFor(perPage?: number): { cols: number; rows: number } {
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

/** Quantas páginas sairão (para mostrar antes de gerar) */
export function estimatePages(count: number, perPage: number, summary: boolean) {
  const cards = Math.ceil(count / Math.max(1, perPage));
  const summaryPages = summary ? Math.max(1, Math.ceil((count - SUMMARY_FIRST) / SUMMARY_NEXT) + 1) : 0;
  return cards + (summary && count > 0 ? summaryPages : 0);
}

const SUMMARY_FIRST = 30; // linhas na primeira página do resumo (tem o cabeçalho)
const SUMMARY_NEXT = 38;

// campanha → com foto antes das sem foto → comunidade → nome (as sem foto ficam no fim)
const byFlow = (a: PdfItem, b: PdfItem) =>
  (a.campaign.name ?? '').localeCompare(b.campaign.name ?? '', 'pt-BR') ||
  Number(!a.child.photoUrl) - Number(!b.child.photoUrl) ||
  (a.child.community ?? a.child.city ?? '').localeCompare(b.child.community ?? b.child.city ?? '', 'pt-BR') ||
  (a.child.name ?? '').localeCompare(b.child.name ?? '', 'pt-BR');

function drawChip(pdf: jsPDF, x: number, y: number, status: SponsorshipStatus, size: number, maxW: number) {
  const label = STATUS_PT[status] ?? status;
  const rgb = STATUS_RGB[status] ?? [100, 116, 139];
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(size);
  const padX = size * 0.6, h = size * 1.6;
  const w = Math.min(pdf.getTextWidth(label) + padX * 2, maxW);
  pdf.setFillColor(...tint(rgb));
  pdf.setDrawColor(...tint(rgb, 0.6));
  pdf.roundedRect(x, y, w, h, h / 2, h / 2, 'FD');
  pdf.setTextColor(...rgb);
  pdf.text(label, x + padX, y + h * 0.68, { maxWidth: w - padX * 2 });
  pdf.setTextColor(0);
  return h;
}

/* ===== Função principal ===== */

export async function exportSponsorshipsPdf(input: ReadonlyArray<PdfItem>, opts: ExportPdfOptions = {}): Promise<ExportResult> {
  const items = [...input].sort(byFlow);
  const total = items.length;
  if (!total) return { cards: 0, withoutPhoto: 0, pages: 0 };

  const report = (current: number, phase: 'compose' | 'pdf') => opts.onProgress?.({ current, total, phase });
  const textScale = Math.max(0.8, Math.min(1.3, opts.textScale ?? 1));
  const caption = opts.caption ?? true;

  // ===== 1) artes (3 por vez; o navegador baixa as imagens em paralelo)
  const cards: { dataURL: string; aspect: number }[] = new Array(total);
  let done = 0;
  await runPool(items, 3, async (it, i) => {
    if (opts.signal?.cancelled) return;
    cards[i] = await composeCard(it);
    report(++done, 'compose');
  });
  if (opts.signal?.cancelled) return { cards: 0, withoutPhoto: 0, pages: 0, cancelled: true };

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const footerH = 22;
  const campaigns = [...new Set(items.map((i) => `${i.campaign.name}${i.campaign.year ? ` (${i.campaign.year})` : ''}`))];
  const sameCampaign = campaigns.length === 1;
  const withoutPhoto = items.filter((i) => !i.child.photoUrl).length;
  let first = true;
  const newPage = () => { if (!first) pdf.addPage(); first = false; };

  // ===== 2) resumo (lista de todas as crianças)
  if (opts.summary) {
    const m = 36;
    const cols = [
      { key: 'id', label: 'ID', w: 42 },
      { key: 'name', label: 'Criança', w: 150 },
      { key: 'age', label: 'Idade', w: 44 },
      { key: 'place', label: 'Comunidade / cidade', w: 120 },
      { key: 'gift', label: 'Presente', w: 0 }, // resto da largura
      { key: 'status', label: 'Status', w: 86 },
    ];
    const fixed = cols.reduce((a, c) => a + c.w, 0);
    cols[4].w = pageW - m * 2 - fixed;
    const fs = 8.5 * textScale;
    const rowH = Math.max(15, fs * 1.9);

    let y = 0;
    const header = (firstPage: boolean) => {
      newPage();
      y = m;
      if (firstPage) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(37, 50, 67);
        pdf.text(opts.title || 'Apadrinhamentos', m, y + 14);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(100);
        const sub = [
          sameCampaign ? campaigns[0] : `${campaigns.length} campanhas`,
          `${total} criança${total === 1 ? '' : 's'}`,
          withoutPhoto ? `${withoutPhoto} sem foto` : '',
          `gerado em ${new Date().toLocaleDateString('pt-BR')}`,
        ].filter(Boolean).join('  ·  ');
        pdf.text(sub, m, y + 32);
        // quantos em cada status
        let cx = m;
        const counts = new Map<SponsorshipStatus, number>();
        items.forEach((i) => counts.set(i.status, (counts.get(i.status) ?? 0) + 1));
        y += 44;
        for (const [st, n] of counts) {
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
          const label = `${STATUS_PT[st]}: ${n}`;
          const w = pdf.getTextWidth(label) + 12;
          if (cx + w > pageW - m) { cx = m; y += 18; }
          const rgb = STATUS_RGB[st];
          pdf.setFillColor(...tint(rgb)); pdf.setDrawColor(...tint(rgb, 0.6));
          pdf.roundedRect(cx, y, w, 14, 7, 7, 'FD');
          pdf.setTextColor(...rgb); pdf.text(label, cx + 6, y + 9.6);
          cx += w + 6;
        }
        y += 26;
      }
      // cabeçalho da tabela
      pdf.setFillColor(241, 245, 249);
      pdf.rect(m, y, pageW - m * 2, rowH, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fs); pdf.setTextColor(71, 85, 105);
      let x = m;
      for (const c of cols) { pdf.text(c.label, x + 4, y + rowH * 0.65); x += c.w; }
      y += rowH;
    };

    header(true);
    items.forEach((it, idx) => {
      if (y + rowH > pageH - m - footerH) header(false);
      if (idx % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(m, y, pageW - m * 2, rowH, 'F'); }
      const c = it.child;
      const cells: Record<string, string> = {
        id: c.publicId != null ? `#${c.publicId}` : '—',
        name: c.name || '—',
        age: typeof c.age === 'number' ? `${c.age} ${c.age === 1 ? 'ano' : 'anos'}` : '—',
        place: c.community || c.city || '—',
        gift: c.wantedGift || '—',
      };
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(fs); pdf.setTextColor(30, 41, 59);
      let x = m;
      for (const col of cols) {
        if (col.key === 'status') {
          drawChip(pdf, x + 2, y + (rowH - fs * 1.4) / 2, it.status, fs * 0.85, col.w - 4);
        } else {
          // uma linha por célula, cortada com reticências
          let t = cells[col.key];
          while (t.length > 1 && pdf.getTextWidth(t) > col.w - 8) t = t.slice(0, -2) + '…';
          if (col.key === 'name') pdf.setFont('helvetica', 'bold');
          pdf.text(t, x + 4, y + rowH * 0.65);
          pdf.setFont('helvetica', 'normal');
        }
        x += col.w;
      }
      y += rowH;
    });
  }

  // ===== 3) cartões
  const { cols, rows } = gridFor(opts.perPage);
  const density = cols * rows;
  const margin = density <= 2 ? 28 : density >= 8 ? 20 : density >= 6 ? 24 : 30;
  const gutter = density <= 2 ? 18 : density >= 8 ? 10 : density >= 6 ? 12 : 16;
  const innerW = pageW - margin * 2;
  const innerH = pageH - margin * 2 - footerH;
  const slotW = (innerW - gutter * (cols - 1)) / cols;
  const slotH = (innerH - gutter * (rows - 1)) / rows;
  const densityScale = density <= 1 ? 1.35 : density === 2 ? 1.2 : density <= 4 ? 1.05 : density <= 6 ? 0.95 : 0.88;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const titleSize = clamp(11 * densityScale * textScale, 7.5, 18);
  const metaSize = clamp(9 * densityScale * textScale, 6.5, 14);
  const lineH = (s: number) => s * 1.28;

  for (let i = 0; i < total; i++) {
    if (opts.signal?.cancelled) return { cards: 0, withoutPhoto: 0, pages: 0, cancelled: true };
    const pos = i % density;
    if (pos === 0) newPage();
    const r = Math.floor(pos / cols), c = pos % cols;
    const slotX = margin + c * (slotW + gutter);
    const slotY = margin + r * (slotH + gutter);
    const it = items[i];
    const ch = it.child;
    const { dataURL, aspect } = cards[i];

    // legenda: medida antes para dar à arte o resto do espaço
    const lines: { text: string; bold?: boolean; color?: [number, number, number]; size: number }[] = [];
    if (caption) {
      lines.push({ text: `${ch.name}${ch.publicId != null ? ` — #${ch.publicId}` : ''}`, bold: true, size: titleSize, color: [15, 23, 42] });
      if (!sameCampaign) lines.push({ text: `${it.campaign.name}${it.campaign.year ? ` (${it.campaign.year})` : ''}`, size: metaSize, color: [71, 85, 105] });
      const meta = [typeof ch.age === 'number' ? `${ch.age} ${ch.age === 1 ? 'ano' : 'anos'}` : '', ch.community || ch.city || ''].filter(Boolean).join('  ·  ');
      if (meta) lines.push({ text: meta, size: metaSize, color: [71, 85, 105] });
      if (ch.wantedGift) lines.push({ text: `Presente: ${ch.wantedGift}`, size: metaSize, color: [146, 64, 14] });
    }
    // largura da arte = largura do slot (ajustada pela altura disponível mais abaixo)
    let drawW = slotW;
    const measure = (w: number) => {
      let h = caption ? 8 : 0;
      for (const l of lines) {
        pdf.setFont('helvetica', l.bold ? 'bold' : 'normal'); pdf.setFontSize(l.size);
        h += pdf.splitTextToSize(l.text, w).slice(0, 2).length * lineH(l.size);
      }
      return h + (caption ? metaSize * 1.6 + 4 : 0); // + chip
    };
    let captionH = measure(drawW);
    let drawH = drawW / aspect;
    if (drawH + captionH > slotH) {
      drawH = Math.max(40, slotH - captionH);
      drawW = drawH * aspect;
      captionH = measure(drawW);
    }
    const imgX = slotX + (slotW - drawW) / 2;
    const imgY = slotY;
    pdf.addImage(dataURL, dataURL.startsWith('data:image/png') ? 'PNG' : 'JPEG', imgX, imgY, drawW, drawH, undefined, 'FAST');
    // contorno leve da arte
    pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.5); pdf.rect(imgX, imgY, drawW, drawH);

    if (caption) {
      let y = imgY + drawH + 8;
      for (const l of lines) {
        pdf.setFont('helvetica', l.bold ? 'bold' : 'normal'); pdf.setFontSize(l.size);
        pdf.setTextColor(...(l.color ?? [0, 0, 0]));
        const wrapped = pdf.splitTextToSize(l.text, drawW).slice(0, 2);
        pdf.text(wrapped, imgX, y + l.size * 0.9);
        y += wrapped.length * lineH(l.size);
      }
      drawChip(pdf, imgX, y + 2, it.status, metaSize * 0.9, drawW);
      pdf.setTextColor(0);
    }
    report(i + 1, 'pdf');
    if (i % 12 === 11) await new Promise((res) => setTimeout(res, 0)); // não travar a tela
  }

  // ===== 4) rodapé em todas as páginas
  const pages = pdf.getNumberOfPages();
  const footLeft = ['Amigos de Minas', opts.title, sameCampaign ? campaigns[0] : ''].filter(Boolean).join('  ·  ');
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.5);
    pdf.line(28, pageH - 26, pageW - 28, pageH - 26);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(120);
    pdf.text(footLeft, 28, pageH - 14, { maxWidth: pageW - 140 });
    pdf.text(`Página ${p} de ${pages}`, pageW - 28, pageH - 14, { align: 'right' });
  }
  pdf.setTextColor(0);

  pdf.save(opts.fileName || `apadrinhamentos-${new Date().toISOString().slice(0, 10)}.pdf`);
  return { cards: total, withoutPhoto, pages };
}

/* ===== Conversão a partir do formato da API (/sponsorships/me e /sponsorships/pdf-data) ===== */

const ageOf = (c: any): number | null => {
  if (c?.birthDate) {
    const d = new Date(c.birthDate);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      let a = now.getUTCFullYear() - d.getUTCFullYear();
      if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--;
      return a;
    }
  }
  return typeof c?.age === 'number' && c.age > 0 ? c.age : null;
};

/**
 * Apadrinhamento da API → item do PDF. Usa só a imagem DA CAMPANHA do apadrinhamento:
 * sem foto nela (só layout), o cartão sai sem foto — a do cadastro antigo não é usada.
 */
function campaignImage(sp: any) {
  const campaignId = sp?.campaign?.id;
  const imgs: any[] = Array.isArray(sp?.child?.images) ? sp.child.images : [];
  const img = imgs.find((i) => !campaignId || i?.campaignId === campaignId) ?? null;
  // "só layout" (placeholder) não é foto
  const hasPhoto = !!img && !img.placeholder && !!img.id;
  return { img, hasPhoto };
}

/** A criança tem foto na campanha deste apadrinhamento? (mesmo critério da tela e do PDF) */
export function sponsorshipHasPhoto(sp: any) {
  return campaignImage(sp).hasPhoto;
}

export function sponsorshipToPdfItem(sp: any): PdfItem {
  const ch = sp?.child ?? {};
  const { img, hasPhoto } = campaignImage(sp);
  const cp = sp?.collectionPoint;
  return {
    sponsorshipId: sp.id,
    status: (sp.status ?? 'PENDING') as SponsorshipStatus,
    method: sp.method ?? null,
    sponsorName: sp.sponsor?.name ?? null,
    collectionPoint: cp?.name ? `${cp.name}${cp.cityName ? ` · ${cp.cityName}` : ''}` : null,
    campaign: { id: sp.campaign?.id ?? '', name: sp.campaign?.name ?? '', year: sp.campaign?.year ?? null },
    child: {
      id: ch.id,
      name: ch.name ?? '—',
      publicId: typeof ch.publicId === 'number' ? ch.publicId : null,
      age: ageOf(ch),
      city: ch.city?.name ?? ch.cityName ?? null,
      community: ch.community?.name ?? ch.communityName ?? null,
      school: ch.school?.name ?? ch.schoolLegacy ?? null,
      wantedGift: ch.wantedGift ?? null,
      photoUrl: hasPhoto ? img.processedUrl || img.originalUrl || null : null,
      layoutUrl: img?.layoutUrl ?? null,
      config: img?.Config ?? null,
      framedUrl: hasPhoto ? img.framedUrl ?? null : null,
    },
  };
}
