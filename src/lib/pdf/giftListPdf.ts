// Lista de presentes e padrinhos em PDF: tabela com as colunas escolhidas, separada por
// grupo (comunidade, por padrão) e, no final, os padrinhos com os contatos.
import jsPDF from 'jspdf';
import { cellText, EXPORT_FIELDS, groupRows, type ExportRow, type GroupBy, type SortBy, type SponsorContact } from '@/lib/exportFields';

export type GiftListOptions = {
  title?: string;
  subtitle?: string;
  fields: string[];
  groupBy: GroupBy;
  sortBy?: SortBy;
  /** página nova para cada grupo */
  breakPerGroup?: boolean;
  sponsorList?: boolean;
  /** 0.85 (menor) a 1.2 (maior) */
  textScale?: number;
  fileName?: string;
};

const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const GREEN: [number, number, number] = [31, 95, 71];

export function giftListPdf(rows: ExportRow[], sponsors: SponsorContact[], opts: GiftListOptions) {
  const fields = opts.fields.map((k) => EXPORT_FIELDS.find((f) => f.key === k)).filter(Boolean) as typeof EXPORT_FIELDS;
  const landscape = fields.reduce((a, f) => a + f.weight, 0) > 11;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: landscape ? 'landscape' : 'portrait', compress: true });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const m = 32;
  const bottom = H - m - 18;
  const scale = Math.max(0.8, Math.min(1.3, opts.textScale ?? 1));
  const fs = 8.5 * scale;
  const line = fs * 1.25;
  const pad = 4;
  let y = m;

  const fit = (text: string, w: number, maxLines: number) => {
    const lines: string[] = pdf.splitTextToSize(text || '', w - pad * 2);
    if (lines.length <= maxLines) return lines.length ? lines : [''];
    const out = lines.slice(0, maxLines);
    let last = out[maxLines - 1];
    while (last.length > 1 && pdf.getTextWidth(`${last}…`) > w - pad * 2) last = last.slice(0, -1);
    out[maxLines - 1] = `${last}…`;
    return out;
  };

  /** Tabela genérica com cabeçalho repetido a cada página */
  const table = (cols: { label: string; w: number; bold?: boolean }[], data: string[][], opts2: { before?: () => void } = {}) => {
    const head = () => {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(m, y, W - m * 2, line + pad * 2, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fs); pdf.setTextColor(...MUTED);
      let x = m;
      for (const c of cols) { pdf.text(fit(c.label, c.w, 1)[0], x + pad, y + pad + fs); x += c.w; }
      y += line + pad * 2;
    };
    const newPage = () => { pdf.addPage(); y = m; opts2.before?.(); head(); };
    if (y + (line + pad * 2) * 2 > bottom) { pdf.addPage(); y = m; opts2.before?.(); }
    head();
    data.forEach((cells, i) => {
      const wrapped = cells.map((t, ci) => fit(t, cols[ci].w, 3));
      const h = Math.max(...wrapped.map((l) => l.length)) * line + pad * 2;
      if (y + h > bottom) newPage();
      if (i % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(m, y, W - m * 2, h, 'F'); }
      let x = m;
      wrapped.forEach((lines, ci) => {
        pdf.setFont('helvetica', cols[ci].bold ? 'bold' : 'normal'); pdf.setFontSize(fs); pdf.setTextColor(...INK);
        pdf.text(lines, x + pad, y + pad + fs);
        x += cols[ci].w;
      });
      pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.4);
      pdf.line(m, y + h, W - m, y + h);
      y += h;
    });
  };

  // ===== cabeçalho do documento
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17 * scale); pdf.setTextColor(...INK);
  pdf.text(opts.title || 'Lista de presentes e padrinhos', m, y + 14);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5 * scale); pdf.setTextColor(...MUTED);
  const sub = [opts.subtitle, `${rows.length} criança(s)`, `${sponsors.length} padrinho(s)`, `gerado em ${new Date().toLocaleDateString('pt-BR')}`]
    .filter(Boolean).join('  ·  ');
  pdf.text(sub, m, y + 30);
  y += 44;

  // ===== crianças, por grupo
  const total = fields.reduce((a, f) => a + f.weight, 0);
  const cols = fields.map((f) => ({ label: f.label, w: ((W - m * 2) * f.weight) / total, bold: f.key === 'childName' }));
  const groups = groupRows(rows, opts.groupBy, opts.sortBy ?? 'name');
  groups.forEach((g, gi) => {
    if (opts.groupBy !== 'none') {
      if (gi > 0 && opts.breakPerGroup) { pdf.addPage(); y = m; }
      const title = () => {
        if (y + 60 > bottom) { pdf.addPage(); y = m; }
        pdf.setFillColor(232, 245, 239);
        pdf.roundedRect(m, y, W - m * 2, 20 * scale, 4, 4, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5 * scale); pdf.setTextColor(...GREEN);
        pdf.text(`${g.label}  —  ${g.rows.length} criança(s)`, m + 8, y + 13.5 * scale);
        y += 20 * scale + 4;
      };
      title();
      // em página nova no meio do grupo, repete o nome do grupo (continuação)
      const cont = () => {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9 * scale); pdf.setTextColor(...GREEN);
        pdf.text(`${g.label} (continuação)`, m, y + 10);
        y += 16;
      };
      table(cols, g.rows.map((r) => fields.map((f) => cellText(r, f.key))), { before: cont });
      y += 12;
    } else {
      table(cols, g.rows.map((r) => fields.map((f) => cellText(r, f.key))));
    }
  });
  if (!rows.length) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(...MUTED);
    pdf.text('Nenhum apadrinhamento com estes filtros.', m, y + 10);
  }

  // ===== padrinhos e contatos
  if (opts.sponsorList && sponsors.length) {
    pdf.addPage(); y = m;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15 * scale); pdf.setTextColor(...INK);
    pdf.text('Padrinhos e contatos', m, y + 12);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9 * scale); pdf.setTextColor(...MUTED);
    pdf.text(`${sponsors.length} padrinho(s), em ordem alfabética`, m, y + 27);
    y += 38;
    const weights = [2.2, 2.6, 1.3, 0.8, 2.6];
    const tw = weights.reduce((a, b) => a + b, 0);
    const sc = ['Padrinho', 'E-mail', 'Telefone', 'Crianças', 'Comunidades'].map((label, i) => ({ label, w: ((W - m * 2) * weights[i]) / tw, bold: i === 0 }));
    table(sc, sponsors.map((s) => [s.name, s.email ?? '', s.phone ?? '', String(s.children), s.communities.join('; ')]));
  }

  // ===== rodapé
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.5);
    pdf.line(m, H - m + 6, W - m, H - m + 6);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(120);
    pdf.text(['Amigos de Minas', opts.title, opts.subtitle].filter(Boolean).join('  ·  '), m, H - m + 18, { maxWidth: W - m * 2 - 90 });
    pdf.text(`Página ${p} de ${pages}`, W - m, H - m + 18, { align: 'right' });
  }
  pdf.save(opts.fileName || `lista-de-presentes-${new Date().toISOString().slice(0, 10)}.pdf`);
  return { pages };
}
