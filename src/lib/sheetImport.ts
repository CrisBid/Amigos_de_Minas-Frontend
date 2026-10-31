/* Utilitários para planilhas coladas (cadastro guiado): datas, colunas e categorias. */

/** Sem acentos, minúsculo, só letras/números separados por espaço: "Nº da Criança:" → "n da crianca" */
export function normalizeText(s?: string | null) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Texto copiado do Excel/Google Sheets → linhas e células. Entende células entre aspas
 * (o Excel faz isso quando a célula tem quebra de linha), então um "Enter" dentro de uma
 * observação não parte a linha em duas. Ignora linhas vazias.
 */
export function parseClipboardTable(text: string): string[][] {
  const src = (text ?? '').replace(/\r\n?/g, '\n');
  const first = src.split('\n')[0] ?? '';
  const sep = first.includes('\t') ? '\t' : (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell.trim()); cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim()); cell = '';
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.length > 0));
}

/**
 * Data da planilha → "yyyy-mm-dd". Aceita 27/12/2024, 27/12/24, 27-12-24, 27.12.2024 e 2024-12-27.
 * Ano com 2 dígitos: até o ano atual vira 20xx, acima disso 19xx.
 */
export function parseSheetDate(raw?: string | null): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let d: number, m: number, y: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const br = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (br) {
    d = +br[1]; m = +br[2]; y = +br[3];
    if (br[3].length === 2) {
      const yy = new Date().getFullYear() % 100;
      y += y <= yy ? 2000 : 1900;
    }
  } else return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Associa cada campo à coluna do cabeçalho: nome igual a um apelido > começa com o apelido
 * (apelidos com 4+ letras) > contém o apelido como palavra. Cada coluna é usada uma vez.
 */
export function autoMapColumns<K extends string>(headers: string[], aliases: Record<K, string[]>): Partial<Record<K, string>> {
  const norm = headers.map(normalizeText);
  const used = new Set<number>();
  const result: Partial<Record<K, string>> = {};

  const score = (h: string, alias: string) => {
    if (!h) return 0;
    if (h === alias) return 3;
    if (alias.length >= 4 && (h.startsWith(alias) || (h.length >= 4 && alias.startsWith(h)))) return 2;
    if (alias.length >= 4 && ` ${h} `.includes(` ${alias} `)) return 1;
    return 0;
  };

  // exatos primeiro (de todos os campos), depois os aproximados — evita um aproximado roubar a coluna de um exato
  for (const minScore of [3, 2, 1]) {
    for (const key of Object.keys(aliases) as K[]) {
      if (result[key]) continue;
      let best = -1;
      let bestScore = 0;
      norm.forEach((h, i) => {
        if (used.has(i)) return;
        const s = Math.max(...aliases[key].map((a) => score(h, a)));
        if (s >= minScore && s > bestScore) { best = i; bestScore = s; }
      });
      if (best >= 0) { result[key] = headers[best]; used.add(best); }
    }
  }
  return result;
}

/* ===================== Categorias ===================== */

export type CategoryHints = {
  categories: { category: string; count: number }[];
  gifts: { gift: string; category: string; count: number }[];
};

export type CategoryGuess = { category: string; source: 'exact' | 'similar' | 'gift' };

const singular = (w: string) => w.replace(/(oes|aes)$/, 'ao').replace(/(is)$/, 'l').replace(/s$/, '');
const words = (s: string) => normalizeText(s).split(' ').filter((w) => w.length >= 3).map(singular);

/** Categoria da planilha → a categoria equivalente que já existe no site (mesma grafia do site). */
export function matchCategory(raw: string | null | undefined, hints: CategoryHints | null): CategoryGuess | null {
  const value = normalizeText(raw);
  if (!value || !hints) return null;
  const exact = hints.categories.find((c) => normalizeText(c.category) === value);
  if (exact) return { category: exact.category, source: 'exact' };

  // mesma palavra no singular/plural, ou uma contém a outra ("BRINQUEDO" × "BRINQUEDOS", "ROUPA" × "ROUPAS E CALÇADOS")
  const v = words(value).join(' ');
  const similar = hints.categories.filter((c) => {
    const w = words(c.category).join(' ');
    return w === v || (v.length >= 4 && (` ${w} `.includes(` ${v} `) || ` ${v} `.includes(` ${w} `)));
  });
  if (similar.length === 1) return { category: similar[0].category, source: 'similar' };
  return null;
}

/** Sem categoria: sugere pela categoria que presentes iguais/parecidos já têm no cadastro. */
export function inferCategoryFromGift(gift: string | null | undefined, hints: CategoryHints | null): CategoryGuess | null {
  const g = normalizeText(gift);
  if (!g || !hints?.gifts.length) return null;

  const score = new Map<string, number>();
  const add = (cat: string, n: number) => score.set(cat, (score.get(cat) ?? 0) + n);

  // presente idêntico vale muito mais que palavras em comum
  for (const h of hints.gifts) if (normalizeText(h.gift) === g) add(h.category, h.count * 10);
  if (!score.size) {
    const giftWords = new Set(words(g).filter((w) => w.length >= 4));
    if (!giftWords.size) return null;
    for (const h of hints.gifts) {
      const shared = words(h.gift).filter((w) => giftWords.has(w)).length;
      if (shared) add(h.category, shared * h.count);
    }
  }
  const ranked = [...score].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  // empate entre categorias = não dá para saber
  if (ranked.length > 1 && ranked[1][1] === ranked[0][1]) return null;
  return { category: ranked[0][0], source: 'gift' };
}
