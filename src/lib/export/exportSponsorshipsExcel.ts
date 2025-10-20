import ExcelJS from 'exceljs';

type ChildData = {
  publicId: number | null;
  name: string;
  birthDate: string | null;
  age?: number | null;
  gift?: string | null;
  mother?: string | null;
  sponsor?: {
    name: string;
    contact?: string | null;
    method?: string | null;
    pix?: string | null;
    collectionPoint?: string | null;
  } | null;
  city?: { name: string } | null;
  community?: { name: string } | null;
  school?: { name: string } | null;
};

type ExportOptions = {
  level?: 'general' | 'city' | 'community' | 'sponsor'; // nível de agrupamento
  filterValue?: string; // ID ou nome do filtro
  data: ChildData[];
};

/**
 * Gera um arquivo Excel estruturado com abas dinâmicas
 */
export async function exportSponsorshipsExcel({ data, level = 'general' }: ExportOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Amigos de Minas';
  workbook.created = new Date();

  const groupBy = (arr: any[], keyFn: (item: any) => string) => {
    return arr.reduce((acc, item) => {
      const key = keyFn(item) || 'Sem informação';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, any[]>);
  };

  // 🔹 Determina o agrupamento
  let grouped: Record<string, ChildData[]>;
  if (level === 'general') grouped = groupBy(data, d => d.city?.name || 'Sem cidade');
  else if (level === 'city') grouped = groupBy(data, d => d.community?.name || 'Sem comunidade');
  else if (level === 'community') grouped = groupBy(data, d => d.school?.name || 'Sem escola');
  else if (level === 'sponsor') grouped = groupBy(data, d => d.sponsor?.name || 'Sem padrinho');
  else grouped = { Geral: data };

  // 🔹 Cria abas
  for (const [groupName, items] of Object.entries(grouped)) {
    const sheet = workbook.addWorksheet(groupName.substring(0, 31)); // nome da aba (limite Excel)
    sheet.columns = [
      { header: 'PUBLICID', key: 'publicId', width: 12 },
      { header: 'CRIANÇA', key: 'name', width: 25 },
      { header: 'NASCIMENTO', key: 'birthDate', width: 15 },
      { header: 'IDADE', key: 'age', width: 8 },
      { header: 'PRESENTE', key: 'gift', width: 20 },
      { header: 'MÃE', key: 'mother', width: 25 },
      { header: 'PADRINHO', key: 'sponsorName', width: 25 },
      { header: 'CONTATO', key: 'contact', width: 20 },
      { header: 'FORMA DE APADRINHAMENTO', key: 'method', width: 25 },
      { header: 'PIX', key: 'pix', width: 25 },
      { header: 'PONTO DE ENTREGA', key: 'collectionPoint', width: 25 },
      { header: 'CIDADE', key: 'city', width: 20 },
      { header: 'COMUNIDADE', key: 'community', width: 20 },
      { header: 'ESCOLA', key: 'school', width: 20 },
    ];

    // Estilo do cabeçalho
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF25A273' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Adiciona linhas
    for (const d of items) {
      sheet.addRow({
        publicId: d.publicId || '',
        name: d.name,
        birthDate: d.birthDate || '',
        age: d.age || '',
        gift: d.gift || '',
        mother: d.mother || '',
        sponsorName: d.sponsor?.name || '',
        contact: d.sponsor?.contact || '',
        method: d.sponsor?.method || '',
        pix: d.sponsor?.pix || '',
        collectionPoint: d.sponsor?.collectionPoint || '',
        city: d.city?.name || '',
        community: d.community?.name || '',
        school: d.school?.name || '',
      });
    }

    sheet.autoFilter = { from: 'A1', to: 'N1' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
