// lib/pdf/exportSponsorshipsPdf.ts
// PDF dos apadrinhamentos (admin e "Meus apadrinhamentos").
// A arte de cada criança é montada pelo mesmo compositor do site (foto + layout + textos);
// sem foto na campanha, sai só o layout com a área da foto vazia.
import jsPDF from 'jspdf';
import { STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';
import { CARD_LIST_FIELDS, DEFAULT_SPONSOR_FIELDS, methodText, SPONSOR_FIELDS } from '@/lib/exportFields';
export { CARD_LIST_FIELDS, DEFAULT_GENERAL_COLUMNS, DEFAULT_LIST_COLUMNS } from '@/lib/exportFields';
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

export type PdfOrder = 'name' | 'id';
export type PdfGroupBy = 'none' | 'community' | 'city' | 'collectionPoint';

export type PdfCampaign = { id: string; name: string; year?: number | null };

export type PdfItem = {
  sponsorshipId: string;
  status: SponsorshipStatus;
  method?: 'PIX' | 'GIFT' | null;
  sponsorId?: string | null;
  sponsorName?: string | null;
  sponsorEmail?: string | null;
  sponsorPhone?: string | null;
  donationAmount?: number | null;
  collectionPoint?: string | null;
  /** criança da campanha ainda sem padrinho (não é um apadrinhamento) */
  unsponsored?: boolean;
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
  /** o que vai na legenda, na ordem (sem: nome, ID, idade, local, presente e status) */
  captionFields?: string[];
  /** lista de todas as crianças: no início (ou no fim, separando por padrinho) */
  summary?: boolean;
  /** ordem das crianças nas listas e nos cartões */
  order?: PdfOrder;
  /** separar por comunidade, cidade ou ponto de coleta (cada um começa com a lista dele) */
  groupBy?: PdfGroupBy;
  /** dentro de cada grupo (ou no todo): cada padrinho com a lista das crianças dele antes dos cartões */
  groupBySponsor?: boolean;
  /** false = só as listas, sem os cartões com foto */
  cards?: boolean;
  /** colunas das listas de cada grupo/padrinho (sem: o padrão de cada lista) */
  listColumns?: string[];
  /** colunas da listagem geral */
  generalColumns?: string[];
  /** última página: os padrinhos do conjunto, com as colunas escolhidas */
  sponsorPage?: boolean;
  sponsorColumns?: string[];
  /** folha com o resumo dos pontos de coleta */
  pointsSummary?: boolean;
  onProgress?: (p: { current: number; total: number; phase: 'compose' | 'pdf' }) => void;
  signal?: { cancelled: boolean };
};

export type ExportResult = { cards: number; withoutPhoto: number; pages: number; cancelled?: boolean };

/* ===== Colunas das listas das crianças ===== */


function cardCell(it: PdfItem, key: string): string {
  const c = it.child;
  switch (key) {
    case 'id': return c.publicId != null ? `#${c.publicId}` : '';
    case 'name': return c.name ?? '';
    case 'age': return typeof c.age === 'number' ? `${c.age} ${c.age === 1 ? 'ano' : 'anos'}` : '';
    case 'place': return c.community || c.city || '';
    case 'community': return c.community ?? '';
    case 'city': return c.city ?? '';
    case 'school': return c.school ?? '';
    case 'gift': return c.wantedGift ?? '';
    case 'sponsor': return it.unsponsored ? 'Sem padrinho' : it.sponsorName ?? '';
    case 'method': return it.unsponsored ? '' : it.method === 'PIX' ? 'PIX' : 'Presente';
    case 'collectionPoint': return it.unsponsored ? '' : it.method === 'PIX' ? 'PIX' : it.collectionPoint ?? 'Sem ponto';
    default: return '';
  }
}

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
export function estimatePages(count: number, perPage: number, summary: boolean, sponsorGroups = 0) {
  const per = Math.max(1, perPage);
  if (sponsorGroups > 1) {
    // cada padrinho: uma página de lista + as páginas dos cartões (arredondadas para cima)
    const avg = count / sponsorGroups;
    const perSponsor = 1 + Math.ceil(avg / per);
    const general = summary ? Math.max(1, Math.ceil((count - SUMMARY_FIRST) / SUMMARY_NEXT) + 1) : 0;
    return sponsorGroups * perSponsor + general;
  }
  const cards = Math.ceil(count / per);
  const summaryPages = summary ? Math.max(1, Math.ceil((count - SUMMARY_FIRST) / SUMMARY_NEXT) + 1) : 0;
  return cards + (summary && count > 0 ? summaryPages : 0);
}

const SUMMARY_FIRST = 30; // linhas na primeira página do resumo (tem o cabeçalho)
const SUMMARY_NEXT = 38;

const cmpText = (a?: string | null, b?: string | null) => (a ?? '').localeCompare(b ?? '', 'pt-BR', { sensitivity: 'base', numeric: true });
const byChild = (order: PdfOrder) => (a: PdfItem, b: PdfItem) =>
  order === 'id'
    ? (a.child.publicId ?? 1e9) - (b.child.publicId ?? 1e9) || cmpText(a.child.name, b.child.name)
    : cmpText(a.child.name, b.child.name) || (a.child.publicId ?? 1e9) - (b.child.publicId ?? 1e9);

// campanha → com foto antes das sem foto → comunidade → nome ou ID (as sem foto ficam no fim)
const byFlow = (order: PdfOrder) => (a: PdfItem, b: PdfItem) =>
  cmpText(a.campaign.name, b.campaign.name) ||
  Number(!a.child.photoUrl) - Number(!b.child.photoUrl) ||
  cmpText(a.child.community ?? a.child.city, b.child.community ?? b.child.city) ||
  byChild(order)(a, b);

/** Padrinhos dos itens (na ordem do nome), cada um com as suas crianças */
export function groupBySponsor(items: ReadonlyArray<PdfItem>) {
  const map = new Map<string, { key: string; name: string; email: string | null; phone: string | null; items: PdfItem[] }>();
  for (const it of items) {
    const key = it.sponsorId || it.sponsorName || '—';
    const g = map.get(key) ?? { key, name: it.sponsorName || 'Sem padrinho', email: it.sponsorEmail ?? null, phone: it.sponsorPhone ?? null, items: [] };
    g.items.push(it);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => cmpText(a.name, b.name));
}

const FREE_RGB: [number, number, number] = [100, 116, 139];
/** Selo de cada criança: o status do apadrinhamento ou "Sem padrinho" */
const chipOf = (it: PdfItem): { label: string; rgb: [number, number, number] } =>
  it.unsponsored ? { label: 'Sem padrinho', rgb: FREE_RGB } : { label: STATUS_PT[it.status] ?? it.status, rgb: STATUS_RGB[it.status] ?? FREE_RGB };

function drawChip(pdf: jsPDF, x: number, y: number, it: PdfItem, size: number, maxW: number) {
  const { label, rgb } = chipOf(it);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(size);
  const padX = size * 0.6, h = size * 1.6;
  // sem espaço para o texto inteiro, corta com reticências (nunca quebra em duas linhas)
  let text = label;
  while (text.length > 2 && pdf.getTextWidth(text) + padX * 2 > maxW) text = text.slice(0, -2) + '…';
  const w = Math.min(pdf.getTextWidth(text) + padX * 2, maxW);
  pdf.setFillColor(...tint(rgb));
  pdf.setDrawColor(...tint(rgb, 0.6));
  pdf.roundedRect(x, y, w, h, h / 2, h / 2, 'FD');
  pdf.setTextColor(...rgb);
  pdf.text(text, x + padX, y + h * 0.68);
  pdf.setTextColor(0);
  return h;
}

/* ===== Função principal ===== */

export async function exportSponsorshipsPdf(input: ReadonlyArray<PdfItem>, opts: ExportPdfOptions = {}): Promise<ExportResult> {
  const order: PdfOrder = opts.order ?? 'name';
  const groupBy: PdfGroupBy = opts.groupBy ?? 'none';
  const bySponsor = !!opts.groupBySponsor;
  const withCards = opts.cards !== false;

  // grupos (comunidade, cidade, ponto de coleta) — as sem padrinho não têm ponto: grupo próprio no fim
  type Section = { name: string; email: string | null; phone: string | null; items: PdfItem[]; free?: boolean };
  type Top = { label: string | null; sort: string; items: PdfItem[]; sections: Section[] };
  const topOf = (it: PdfItem): { label: string; sort: string } => {
    const c = it.child;
    if (groupBy === 'community') {
      const label = `${c.community || 'Sem comunidade'}${c.city ? ` (${c.city})` : ''}`;
      return { label, sort: `${c.city ?? '~'}|${c.community ?? '~'}` };
    }
    if (groupBy === 'city') return { label: c.city || 'Sem cidade', sort: c.city || '~' };
    if (it.unsponsored) return { label: 'Crianças sem padrinho', sort: '\uffff' };
    return { label: it.collectionPoint || 'Sem ponto de coleta', sort: it.collectionPoint || '\ufffe' };
  };
  const tops: Top[] = [];
  if (groupBy === 'none') {
    tops.push({ label: null, sort: '', items: [...input], sections: [] });
  } else {
    const map = new Map<string, Top>();
    for (const it of input) {
      const t = topOf(it);
      const g = map.get(t.label) ?? { label: t.label, sort: t.sort, items: [], sections: [] };
      g.items.push(it);
      map.set(t.label, g);
    }
    tops.push(...[...map.values()].sort((x, y) => cmpText(x.sort, y.sort)));
  }
  // dentro de cada grupo: por padrinho (e as sem padrinho no fim) ou tudo junto, na ordem escolhida
  for (const t of tops) {
    const sponsored = t.items.filter((i) => !i.unsponsored);
    const free = t.items.filter((i) => i.unsponsored).sort(byFlow(order));
    t.sections = bySponsor
      ? [
          ...groupBySponsor(sponsored).map((g) => ({ name: g.name, email: g.email, phone: g.phone, items: [...g.items].sort(byFlow(order)) })),
          ...(free.length ? [{ name: 'Crianças sem padrinho', email: null, phone: null, items: free, free: true }] : []),
        ]
      : [{ name: t.label ?? '', email: null, phone: null, items: [...[...sponsored].sort(byFlow(order)), ...free] }];
    t.items = t.sections.flatMap((x) => x.items);
  }
  const items = tops.flatMap((t) => t.items);
  const freeCount = items.filter((i) => i.unsponsored).length;
  const sponsorCount = new Set(items.filter((i) => !i.unsponsored).map((i) => i.sponsorId || i.sponsorName)).size;
  const total = items.length;
  if (!total) return { cards: 0, withoutPhoto: 0, pages: 0 };

  const report = (current: number, phase: 'compose' | 'pdf') => opts.onProgress?.({ current, total, phase });
  const textScale = Math.max(0.8, Math.min(1.3, opts.textScale ?? 1));
  const caption = opts.caption ?? true;

  // ===== 1) artes (3 por vez; o navegador baixa as imagens em paralelo)
  const cards = new Map<PdfItem, { dataURL: string; aspect: number }>();
  let done = 0;
  if (withCards) {
    await runPool(items, 3, async (it) => {
      if (opts.signal?.cancelled) return;
      cards.set(it, await composeCard(it));
      report(++done, 'compose');
    });
  }
  if (opts.signal?.cancelled) return { cards: 0, withoutPhoto: 0, pages: 0, cancelled: true };

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const footerH = 22;
  const campaigns = [...new Set(items.map((i) => `${i.campaign.name}${i.campaign.year ? ` (${i.campaign.year})` : ''}`))];
  const sameCampaign = campaigns.length === 1;
  const manyPlaces = new Set(items.map((i) => i.child.community || i.child.city || '')).size > 1;
  const withoutPhoto = items.filter((i) => !i.child.photoUrl).length;
  let first = true;
  const newPage = () => { if (!first) pdf.addPage(); first = false; };

  // ===== tabelas (listas das crianças, listagem geral, padrinhos, pontos de coleta)
  type TCol<T> = { label: string; weight: number; text?: (r: T) => string; chip?: (r: T) => PdfItem | null; bold?: boolean };
  const drawTable = <T,>(
    list: T[],
    head: { title: string; lines: string[]; statusItems?: PdfItem[] },
    tcols: TCol<T>[],
  ) => {
    const m = 36;
    const totalW = tcols.reduce((a, c) => a + c.weight, 0) || 1;
    const widths = tcols.map((c) => ((pageW - m * 2) * c.weight) / totalW);
    const fs = 8.5 * textScale;
    const rowH = Math.max(15, fs * 1.9);

    let y = 0;
    const header = (firstPage: boolean) => {
      newPage();
      y = m;
      if (firstPage) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.setTextColor(37, 50, 67);
        pdf.text(head.title, m, y + 14, { maxWidth: pageW - m * 2 });
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(100);
        head.lines.filter(Boolean).forEach((l, i) => pdf.text(l, m, y + 32 + i * 14, { maxWidth: pageW - m * 2 }));
        y += 32 + head.lines.filter(Boolean).length * 14;
        if (head.statusItems) {
          let cx = m;
          const counts = new Map<string, { n: number; rgb: [number, number, number] }>();
          head.statusItems.forEach((i) => { const c = chipOf(i); const prev = counts.get(c.label); counts.set(c.label, { n: (prev?.n ?? 0) + 1, rgb: c.rgb }); });
          for (const [st, { n, rgb }] of counts) {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
            const label = `${st}: ${n}`;
            const w = pdf.getTextWidth(label) + 12;
            if (cx + w > pageW - m) { cx = m; y += 18; }
            pdf.setFillColor(...tint(rgb)); pdf.setDrawColor(...tint(rgb, 0.6));
            pdf.roundedRect(cx, y, w, 14, 7, 7, 'FD');
            pdf.setTextColor(...rgb); pdf.text(label, cx + 6, y + 9.6);
            cx += w + 6;
          }
          y += 22;
        } else {
          y += 6;
        }
      } else {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(100);
        pdf.text(`${head.title} (continuação)`, m, y + 8);
        y += 16;
      }
      pdf.setFillColor(241, 245, 249);
      pdf.rect(m, y, pageW - m * 2, rowH, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fs); pdf.setTextColor(71, 85, 105);
      let x = m;
      tcols.forEach((c, i) => {
        let t = c.label;
        while (t.length > 1 && pdf.getTextWidth(t) > widths[i] - 8) t = t.slice(0, -2) + '…';
        pdf.text(t, x + 4, y + rowH * 0.65);
        x += widths[i];
      });
      y += rowH;
    };

    header(true);
    list.forEach((r, idx) => {
      if (y + rowH > pageH - m - footerH) header(false);
      if (idx % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(m, y, pageW - m * 2, rowH, 'F'); }
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(fs); pdf.setTextColor(30, 41, 59);
      let x = m;
      tcols.forEach((col, i) => {
        const chipItem = col.chip?.(r);
        if (chipItem) {
          drawChip(pdf, x + 2, y + (rowH - fs * 1.4) / 2, chipItem, fs * 0.85, widths[i] - 4);
        } else {
          // uma linha por célula, cortada com reticências
          let t = col.text?.(r) || '—';
          while (t.length > 1 && pdf.getTextWidth(t) > widths[i] - 8) t = t.slice(0, -2) + '…';
          if (col.bold) pdf.setFont('helvetica', 'bold');
          pdf.text(t, x + 4, y + rowH * 0.65);
          pdf.setFont('helvetica', 'normal');
        }
        x += widths[i];
      });
      y += rowH;
    });
  };

  // colunas das crianças: as escolhidas na tela, ou o padrão de cada lista
  const childCol = (key: string): TCol<PdfItem> | null => {
    const f = CARD_LIST_FIELDS.find((x) => x.key === key);
    if (!f) return null;
    return key === 'status'
      ? { label: f.label, weight: f.weight, chip: (it) => it }
      : { label: f.label, weight: f.weight, text: (it) => cardCell(it, key), bold: key === 'name' };
  };
  const autoCols = (withSponsor: boolean) =>
    ['id', 'name', 'age', ...((!withSponsor || manyPlaces) ? ['place'] : []), 'gift', ...(withSponsor ? ['sponsor'] : []), 'status'];
  const listTable = (list: PdfItem[], head: { title: string; lines: string[]; statusCounts?: boolean }, withSponsor: boolean, kind: 'list' | 'general' = 'list') => {
    const chosen = kind === 'general' ? opts.generalColumns : opts.listColumns;
    // na lista de um padrinho, a coluna do padrinho seria repetida
    const keys = chosen?.length ? chosen.filter((k) => withSponsor || k !== 'sponsor') : autoCols(withSponsor);
    drawTable(list, { title: head.title, lines: head.lines, statusItems: head.statusCounts ? list : undefined }, keys.map(childCol).filter(Boolean) as TCol<PdfItem>[]);
  };

  // padrinhos do conjunto (última página) e resumo dos pontos de coleta
  const sponsorPage = () => {
    const map = new Map<string, { name: string; email: string | null; phone: string | null; count: number; gift: number; pix: number; pixAmount: number; points: Set<string>; communities: Set<string>; ids: number[] }>();
    for (const it of items) {
      if (it.unsponsored) continue;
      const k = it.sponsorId || it.sponsorName || '—';
      const s = map.get(k) ?? { name: it.sponsorName || 'Padrinho', email: it.sponsorEmail ?? null, phone: it.sponsorPhone ?? null, count: 0, gift: 0, pix: 0, pixAmount: 0, points: new Set<string>(), communities: new Set<string>(), ids: [] };
      s.count++;
      if (it.method === 'PIX') { s.pix++; s.pixAmount += it.donationAmount ?? 0; } else s.gift++;
      if (it.collectionPoint) s.points.add(it.collectionPoint);
      const place = it.child.community ? `${it.child.community}${it.child.city ? ` (${it.child.city})` : ''}` : it.child.city;
      if (place) s.communities.add(place);
      if (it.child.publicId != null) s.ids.push(it.child.publicId);
      map.set(k, s);
    }
    const list = [...map.values()].sort((a, b) => cmpText(a.name, b.name));
    if (!list.length) return;
    const keys = opts.sponsorColumns?.length ? opts.sponsorColumns : DEFAULT_SPONSOR_FIELDS;
    const cell = (s: (typeof list)[number], key: string): string => {
      switch (key) {
        case 'name': return s.name;
        case 'count': return String(s.count);
        case 'method': return methodText(s.gift, s.pix);
        case 'email': return s.email ?? '';
        case 'phone': return s.phone ?? '';
        case 'pixAmount': return s.pixAmount ? s.pixAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
        case 'points': return [...s.points].sort(cmpText).join('; ');
        case 'communities': return [...s.communities].sort(cmpText).join('; ');
        case 'ids': return [...s.ids].sort((a, b) => a - b).join(', ');
        default: return '';
      }
    };
    const total = list.reduce((n, s) => n + s.count, 0);
    drawTable(list, {
      title: `Padrinhos${opts.title ? ` — ${opts.title}` : ''}`,
      lines: [[`${list.length} padrinho${list.length === 1 ? '' : 's'}`, kids(total), methodText(list.reduce((n, s) => n + s.gift, 0), list.reduce((n, s) => n + s.pix, 0))].filter(Boolean).join('  ·  ')],
    }, keys.map((k) => SPONSOR_FIELDS.find((f) => f.key === k)).filter(Boolean).map((f) => ({ label: f!.label, weight: f!.weight, text: (s: (typeof list)[number]) => cell(s, f!.key), bold: f!.key === 'name' })));
  };

  const pointsPage = () => {
    type P = { label: string; kind: number; children: number; sponsors: Set<string>; received: number; pending: number; communities: Set<string> };
    const map = new Map<string, P>();
    for (const it of items) {
      if (it.unsponsored) continue;
      const kind = it.method === 'PIX' ? 1 : it.collectionPoint ? 0 : 2;
      const label = kind === 1 ? 'PIX (presente comprado pela equipe)' : kind === 2 ? 'Presente sem ponto de coleta' : it.collectionPoint!;
      const p = map.get(label) ?? { label, kind, children: 0, sponsors: new Set<string>(), received: 0, pending: 0, communities: new Set<string>() };
      p.children++;
      if (['PACKED', 'BOXED', 'COMPLETED'].includes(it.status)) p.received++;
      if (it.status === 'PENDING') p.pending++;
      p.sponsors.add(it.sponsorId || it.sponsorName || '');
      const place = it.child.community ? `${it.child.community}${it.child.city ? ` (${it.child.city})` : ''}` : it.child.city;
      if (place) p.communities.add(place);
      map.set(label, p);
    }
    const list = [...map.values()].sort((a, b) => a.kind - b.kind || cmpText(a.label, b.label));
    if (!list.length) return;
    drawTable(list, {
      title: `Resumo dos pontos de coleta${opts.title ? ` — ${opts.title}` : ''}`,
      lines: [`${list.filter((p) => p.kind === 0).length} ponto(s)  ·  recebidos = embalados, encaixotados ou entregues`],
    }, [
      { label: 'Ponto de coleta', weight: 2.6, text: (p) => p.label, bold: true },
      { label: 'Crianças', weight: 0.9, text: (p) => String(p.children) },
      { label: 'Padrinhos', weight: 0.9, text: (p) => String(p.sponsors.size) },
      { label: 'Recebidos', weight: 0.9, text: (p) => String(p.received) },
      { label: 'Pendentes', weight: 0.9, text: (p) => String(p.pending) },
      { label: 'Comunidades', weight: 3, text: (p) => [...p.communities].sort(cmpText).join('; ') },
    ]);
  };
  const kids = (n: number) => `${n} criança${n === 1 ? '' : 's'}`;

  // ===== cartões (grade)
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
  let drawn = 0;

  // legenda: os campos escolhidos (a campanha entra sozinha quando há mais de uma)
  const captionFields = opts.captionFields?.length
    ? opts.captionFields
    : ['name', 'id', ...(sameCampaign ? [] : ['campaign']), 'age', 'place', 'gift', 'status'];
  const withChip = captionFields.includes('status');
  const drawCards = async (list: PdfItem[]) => {
    if (!withCards) return;
    for (let i = 0; i < list.length; i++) {
      if (opts.signal?.cancelled) return;
      const pos = i % density;
      if (pos === 0) newPage();
      const r = Math.floor(pos / cols), c = pos % cols;
      const slotX = margin + c * (slotW + gutter);
      const slotY = margin + r * (slotH + gutter);
      const it = list[i];
      const ch = it.child;
      const { dataURL, aspect } = cards.get(it)!;

      // legenda: medida antes para dar à arte o resto do espaço
      const lines: { text: string; bold?: boolean; color?: [number, number, number]; size: number }[] = [];
      if (caption) {
        const GRAY: [number, number, number] = [71, 85, 105];
        let metaDone = false;
        for (const f of captionFields) {
          switch (f) {
            case 'name':
              lines.push({ text: `${ch.name}${captionFields.includes('id') && ch.publicId != null ? ` — #${ch.publicId}` : ''}`, bold: true, size: titleSize, color: [15, 23, 42] });
              break;
            case 'id':
              if (!captionFields.includes('name') && ch.publicId != null) lines.push({ text: `#${ch.publicId}`, bold: true, size: titleSize, color: [15, 23, 42] });
              break;
            case 'age': case 'place': case 'community': case 'city': {
              // idade e local numa linha só, na posição do primeiro deles
              if (metaDone) break;
              metaDone = true;
              const meta = captionFields.filter((k) => ['age', 'place', 'community', 'city'].includes(k)).map((k) =>
                k === 'age' ? (typeof ch.age === 'number' ? `${ch.age} ${ch.age === 1 ? 'ano' : 'anos'}` : '')
                : k === 'place' ? ch.community || ch.city || ''
                : k === 'community' ? ch.community ?? '' : ch.city ?? '').filter(Boolean).join('  ·  ');
              if (meta) lines.push({ text: meta, size: metaSize, color: GRAY });
              break;
            }
            case 'school': if (ch.school) lines.push({ text: `Escola: ${ch.school}`, size: metaSize, color: GRAY }); break;
            case 'gift': if (ch.wantedGift) lines.push({ text: `Presente: ${ch.wantedGift}`, size: metaSize, color: [146, 64, 14] }); break;
            case 'sponsor': lines.push({ text: `Padrinho: ${it.unsponsored ? 'sem padrinho' : it.sponsorName || '—'}`, size: metaSize, color: GRAY }); break;
            case 'method': if (!it.unsponsored) lines.push({ text: `Forma: ${it.method === 'PIX' ? 'PIX' : 'Presente'}`, size: metaSize, color: GRAY }); break;
            case 'collectionPoint':
              if (!it.unsponsored && it.method !== 'PIX') lines.push({ text: `Entrega: ${it.collectionPoint || 'sem ponto de coleta'}`, size: metaSize, color: GRAY });
              break;
            case 'campaign': lines.push({ text: `${it.campaign.name}${it.campaign.year ? ` (${it.campaign.year})` : ''}`, size: metaSize, color: GRAY }); break;
            default: break;
          }
        }
      }
      let drawW = slotW;
      const measure = (w: number) => {
        let h = caption ? 8 : 0;
        for (const l of lines) {
          pdf.setFont('helvetica', l.bold ? 'bold' : 'normal'); pdf.setFontSize(l.size);
          h += pdf.splitTextToSize(l.text, w).slice(0, 2).length * lineH(l.size);
        }
        return h + (caption && withChip ? metaSize * 1.6 + 4 : 0); // + selo
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
        if (withChip) drawChip(pdf, imgX, y + 2, it, metaSize * 0.9, drawW);
        pdf.setTextColor(0);
      }
      report(++drawn, 'pdf');
      if (drawn % 12 === 0) await new Promise((res) => setTimeout(res, 0)); // não travar a tela
    }
  };

  const campaignLine = sameCampaign ? campaigns[0] : `${campaigns.length} campanhas`;
  const orderLine = order === 'id' ? 'em ordem de ID' : 'em ordem alfabética';
  const cancelled = () => !!opts.signal?.cancelled;
  const grouped = groupBy !== 'none' || bySponsor;

  if (!grouped) {
    // tudo junto: resumo no início e os cartões
    if (opts.summary || !withCards) {
      listTable(items, {
        title: opts.title || 'Apadrinhamentos',
        lines: [[campaignLine, kids(total), freeCount ? `${freeCount} sem padrinho` : '', withoutPhoto && withCards ? `${withoutPhoto} sem foto` : '', `gerado em ${new Date().toLocaleDateString('pt-BR')}`].filter(Boolean).join('  ·  ')],
        statusCounts: true,
      }, sponsorCount > 1 || freeCount > 0);
    }
    await drawCards(items);
    if (cancelled()) return { cards: 0, withoutPhoto: 0, pages: 0, cancelled: true };
  } else {
    for (const t of tops) {
      // grupo (comunidade…) separado por padrinho: primeiro a lista do grupo inteiro, com o padrinho
      if (t.label && bySponsor) {
        listTable(t.items, {
          title: t.label,
          lines: [[opts.title, campaignLine, kids(t.items.length), `${t.sections.filter((x) => !x.free).length} padrinho(s)`, orderLine].filter(Boolean).join('  ·  ')],
          statusCounts: true,
        }, true);
      }
      for (const sec of t.sections) {
        if (bySponsor) {
          listTable(sec.items, {
            title: sec.name,
            lines: [
              sec.free ? 'Crianças que ainda não foram apadrinhadas' : [sec.email, sec.phone].filter(Boolean).join('  ·  '),
              [t.label, !t.label ? opts.title : '', campaignLine, kids(sec.items.length), orderLine].filter(Boolean).join('  ·  '),
            ],
          }, false);
        } else {
          listTable(sec.items, {
            title: t.label ?? opts.title ?? 'Apadrinhamentos',
            lines: [[opts.title, campaignLine, kids(sec.items.length), orderLine].filter(Boolean).join('  ·  ')],
            statusCounts: true,
          }, true);
        }
        await drawCards(sec.items);
        if (cancelled()) return { cards: 0, withoutPhoto: 0, pages: 0, cancelled: true };
      }
    }
    // no fim, a listagem geral (todas as crianças, com o padrinho)
    if (opts.summary) {
      const all = [...items].sort((a, b) =>
        cmpText(a.child.community ?? a.child.city, b.child.community ?? b.child.city) || byChild(order)(a, b));
      listTable(all, {
        title: `Listagem geral${opts.title ? ` — ${opts.title}` : ''}`,
        lines: [[campaignLine, kids(total), `${sponsorCount} padrinho${sponsorCount === 1 ? '' : 's'}`, freeCount ? `${freeCount} sem padrinho` : '', orderLine].filter(Boolean).join('  ·  ')],
        statusCounts: true,
      }, true, 'general');
    }
  }
  // folhas finais: resumo dos pontos de coleta e, por último, os padrinhos do conjunto
  if (opts.pointsSummary) pointsPage();
  if (opts.sponsorPage) sponsorPage();

  // ===== rodapé em todas as páginas
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
  return { cards: withCards ? total : 0, withoutPhoto, pages };
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
    sponsorId: sp.sponsor?.id ?? null,
    sponsorName: sp.sponsor?.name ?? null,
    sponsorEmail: sp.sponsor?.email ?? null,
    sponsorPhone: sp.sponsor?.profile?.phone || sp.sponsor?.phone || null,
    donationAmount: sp.donationAmount != null && !isNaN(Number(sp.donationAmount)) ? Number(sp.donationAmount) : null,
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
