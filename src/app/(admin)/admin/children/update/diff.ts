/* Comparação planilha × cadastro da tela de atualização de crianças. Campo vazio na planilha
   nunca é diferença: a atualização não apaga o que já existe. */

/** Ficha atual da criança, como o backend devolve na prévia */
export type Snapshot = {
  id: string;
  publicId: number;
  campaignPublicId: number | null;
  name: string;
  birthDate: string | null; // yyyy-mm-dd
  age: number | null;
  motherName: string | null;
  category: string | null;
  wantedGift: string | null;
  giftFromCampaign: boolean;
  description: string | null;
  cityId: string | null;
  cityName: string | null;
  communityId: string | null;
  communityName: string | null;
  schoolId: string | null;
  schoolName: string | null;
  inCampaign: boolean;
  hasPhoto: boolean;
};

/** Linha da planilha já lida */
export type SheetRow = {
  key: string;
  line: number;
  publicId: string;
  name: string;
  birthDate?: string; // yyyy-mm-dd
  age?: number;
  motherName?: string;
  category?: string;
  wantedGift?: string;
  description?: string;
};

export type FieldKey =
  | 'name' | 'birthDate' | 'age' | 'motherName' | 'wantedGift' | 'category' | 'description' | 'campaignPublicId' | 'location';

export const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'Nome',
  birthDate: 'Nascimento',
  age: 'Idade',
  motherName: 'Mãe',
  wantedGift: 'Presente',
  category: 'Categoria',
  description: 'Observações',
  campaignPublicId: 'ID na campanha',
  location: 'Comunidade / escola',
};

export const FIELD_ORDER: FieldKey[] = [
  'name', 'campaignPublicId', 'wantedGift', 'category', 'birthDate', 'age', 'motherName', 'description', 'location',
];

export type Change = { field: FieldKey; from: string; to: string };

/** Local escolhido na tela (para a mudança de comunidade/escola) */
export type TargetLocation = { communityId?: string; communityName?: string; schoolId?: string; schoolName?: string };

// diferenças só de maiúsculas ou espaços não contam; acento conta (é correção de grafia)
const same = (a?: string | null, b?: string | null) =>
  (a ?? '').trim().replace(/\s+/g, ' ').toUpperCase() === (b ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
const filled = (v?: string | null) => !!v && !!v.trim();

export function formatDate(iso?: string | null) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** O que mudaria na ficha se a linha fosse aplicada */
export function computeChanges(row: SheetRow, snap: Snapshot, target: TargetLocation): Change[] {
  const out: Change[] = [];
  const text = (field: FieldKey, current: string | null, incoming?: string) => {
    if (filled(incoming) && !same(current, incoming)) out.push({ field, from: current ?? '', to: incoming!.trim() });
  };
  text('name', snap.name, row.name);
  const pid = parseInt(row.publicId, 10);
  if (Number.isFinite(pid) && snap.campaignPublicId !== pid) {
    out.push({ field: 'campaignPublicId', from: snap.campaignPublicId != null ? String(snap.campaignPublicId) : '', to: String(pid) });
  }
  text('wantedGift', snap.wantedGift, row.wantedGift);
  text('category', snap.category, row.category);
  if (row.birthDate && row.birthDate !== snap.birthDate) {
    out.push({ field: 'birthDate', from: formatDate(snap.birthDate), to: formatDate(row.birthDate) });
  }
  if (typeof row.age === 'number' && row.age !== snap.age) {
    out.push({ field: 'age', from: snap.age != null ? String(snap.age) : '', to: String(row.age) });
  }
  text('motherName', snap.motherName, row.motherName);
  text('description', snap.description, row.description);
  const movesCommunity = !!target.communityId && target.communityId !== snap.communityId;
  const movesSchool = !!target.schoolId && target.schoolId !== snap.schoolId;
  if (movesCommunity || movesSchool) {
    const now = [snap.communityName, snap.schoolName].filter(Boolean).join(' · ');
    const next = [
      movesCommunity ? target.communityName : snap.communityName,
      movesSchool ? target.schoolName : snap.schoolName,
    ].filter(Boolean).join(' · ');
    out.push({ field: 'location', from: now, to: next });
  }
  return out.sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field));
}

/** Campos a enviar para o backend: só os escolhidos, com o valor da planilha */
export function updateFields(row: SheetRow, fields: FieldKey[]) {
  const pick = new Set(fields);
  const pid = parseInt(row.publicId, 10);
  return {
    ...(pick.has('name') ? { name: row.name } : {}),
    ...(pick.has('birthDate') && row.birthDate ? { birthDate: row.birthDate } : {}),
    ...(pick.has('age') && typeof row.age === 'number' ? { age: row.age } : {}),
    ...(pick.has('motherName') && row.motherName ? { motherName: row.motherName } : {}),
    ...(pick.has('wantedGift') && row.wantedGift ? { wantedGift: row.wantedGift } : {}),
    ...(pick.has('category') && row.category ? { category: row.category } : {}),
    ...(pick.has('description') && row.description ? { description: row.description } : {}),
    ...(pick.has('campaignPublicId') && Number.isFinite(pid) ? { campaignPublicId: pid } : {}),
    ...(pick.has('location') ? { location: true } : {}),
  };
}
