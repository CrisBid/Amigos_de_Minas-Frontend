// app/apadrinhamento/ApadrinhamentoClient.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Filter, Search, Loader2, AlertCircle } from 'lucide-react';
import Stats from '@/components/Apadrinhamento/Stats';
import ChildCard from '@/components/Apadrinhamento/ChildCard';

type SponsorshipStatus = 'PENDING' | 'ACTIVE' | 'ENDED' | 'CANCELLED' | 'NONE';

type City = { id: string; publicId?: number | null; name: string; state?: string | null };

type Child = {
  id: string;
  name: string;
  age?: number;
  cityName?: string;
  city?: City | null;
  school?: string;
  category?: string;
  wantedGift?: string;
  description?: string;
  photoUrl?: string;
  media?: Array<{ framedUrl?: string; processedUrl?: string }>;
  sponsorshipStatus: SponsorshipStatus;
};

type Campaign = {
  id: string;
  name: string;
  slug: string;
  year?: number;
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'ARCHIVED';
};

type Props = {
  initialScanFs: boolean;
};

type StatusFiltro = '' | 'disponivel' | 'apadrinhado';

const FAIXAS_ETARIAS = ['0-3 anos', '4-6 anos', '7-9 anos', '10-12 anos', '13+ anos'];

export default function ApadrinhamentoClient({ initialScanFs }: Props) {
  const { data: session, status } = useSession(); // agora não redirecionamos se não logado
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_NEST_API_URL;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>('');

  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [sponsoringId, setSponsoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scanFs, setScanFs] = useState<boolean>(initialScanFs);

  const [searchTerm, setSearchTerm] = useState('');
  const [filtros, setFiltros] = useState({
    cidade: '',
    escola: '',
    categoria: '',
    idade: '',
    status: 'disponivel' as StatusFiltro,
  });

  // 1) carregar campanhas (sem exigir login)
  useEffect(() => {
    if (!api) {
      setError('Defina NEXT_PUBLIC_NEST_API_URL.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [cRes, allRes] = await Promise.all([
          fetch(`${api}/campaigns?status=ACTIVE`, { cache: 'no-store' }),
          fetch(`${api}/campaigns`, { cache: 'no-store' }),
        ]);
        const active = cRes.ok ? await cRes.json() : [];
        const all = allRes.ok ? await allRes.json() : [];
        const unique = uniqBy<Campaign>([...active, ...all], 'id').sort(
          (a, b) => (b.year ?? 0) - (a.year ?? 0)
        );
        setCampaigns(unique);
        setCampaignId(unique[0]?.id || '');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha ao carregar campanhas.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [api]);

  // 2) carregar crianças da campanha
  useEffect(() => {
    if (!campaignId || !api) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const url = new URL(`${api}/children`);
        url.searchParams.set('campaignId', campaignId);
        if (scanFs) url.searchParams.set('scan', '1');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) throw new Error(await safeErrMsg(res));
        const data = await res.json();
        const mapped: Child[] = (data ?? []).map((c: any) => {
        const rel = Array.isArray(c.sponsorships)
          ? c.sponsorships.find(
              (s: any) => s.campaignId === campaignId && (s.status === 'ACTIVE' || s.status === 'PENDING')
            )
          : null;

          const status: SponsorshipStatus = rel?.status ?? 'NONE';
          const previewUrl = `/api/admin/children/${encodeURIComponent(c.id)}/preview?campaignId=${encodeURIComponent(
            campaignId
          )}&format=webp&q=82`;

          return {
            id: c.id,
            name: c.name,
            age: c.age ?? c.idade,
            cityName: c.city?.name ?? c.cityName,
            city: c.city ?? null,
            school: c.school ?? c.escola,
            category: c.category ?? c.categoria,
            wantedGift: c.wantedGift,
            description: c.description,
            // 🔸 prioriza preview dinâmico; se falhar, backend/edge responde erro e a imagem não carrega,
            // mas mantemos também o legado como fallback (se quiser trocar ordem, fique à vontade)
            //photoUrl: previewUrl || c.media?.[0]?.framedUrl || c.media?.[0]?.processedUrl || c.photoUrl || undefined,
            photoUrl: c.photoUrl,
            media: c.media,
            sponsorshipStatus: status,
          };
        });
        setChildren(mapped);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha ao carregar crianças.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, api, scanFs]);

  // 3) clique em "Apadrinhar"
  async function handleSponsor(childId: string) {
    if (!campaignId) {
      setError('Selecione uma campanha.');
      return;
    }
    setSponsoringId(childId);
    try {
      if (status === 'authenticated') {
        router.push(
          `/apadrinhamento/concluir?childId=${encodeURIComponent(childId)}&campaignId=${encodeURIComponent(
            campaignId
          )}`
        );
      } else {
        router.push(
          `/apadrinhamento/registro?childId=${encodeURIComponent(childId)}&campaignId=${encodeURIComponent(
            campaignId
          )}`
        );
      }
    } finally {
      setSponsoringId(null);
    }
  }

  // 4) stats
  const stats = useMemo(() => {
    const total = children.length;
    const indisponiveis = children.filter((c) => ['ACTIVE', 'PENDING'].includes(c.sponsorshipStatus)).length;
    const disponiveis = total - indisponiveis;
    return { total, apadrinhadas: indisponiveis, disponiveis };
  }, [children]);

  // 5) filtros (derivados)
  const cidades = useMemo(
    () => uniq(children.map((c) => c.city?.name ?? c.cityName).filter(Boolean) as string[]),
    [children]
  );
  const escolas = useMemo(() => uniq(children.map((c) => c.school).filter(Boolean) as string[]), [children]);
  const categorias = useMemo(
    () => uniq(children.map((c) => c.category).filter(Boolean) as string[]),
    [children]
  );

  // 6) aplicar filtros
  const childrenFiltradas = useMemo(() => {
    return children.filter((child) => {
      const nomeCidade = child.city?.name ?? child.cityName ?? '';
      const matchesSearch = child.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCidade = !filtros.cidade || nomeCidade === filtros.cidade;
      const matchesEscola = !filtros.escola || child.school === filtros.escola;
      const matchesCategoria = !filtros.categoria || child.category === filtros.categoria;
      const isIndisp = ['COMPLETED', 'PENDING'].includes(child.sponsorshipStatus);
      const matchesStatus =
        !filtros.status ||
        (filtros.status === 'disponivel' && !isIndisp) ||
        (filtros.status === 'apadrinhado' && isIndisp);
      let matchesIdade = true;
      const idade = Number(child.age ?? 0);
      switch (filtros.idade) {
        case '0-3 anos':
          matchesIdade = idade <= 3;
          break;
        case '4-6 anos':
          matchesIdade = idade >= 4 && idade <= 6;
          break;
        case '7-9 anos':
          matchesIdade = idade >= 7 && idade <= 9;
          break;
        case '10-12 anos':
          matchesIdade = idade >= 10 && idade <= 12;
          break;
        case '13+ anos':
          matchesIdade = idade >= 13;
          break;
      }
      return matchesSearch && matchesCidade && matchesEscola && matchesCategoria && matchesStatus && matchesIdade;
    });
  }, [children, searchTerm, filtros]);

  return (
    <div className="max-w-6xl mx-auto px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Crianças Para Apadrinhamento</h2>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Campanha:</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.year ? ` (${c.year})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* scan opcional */}
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={scanFs}
              onChange={(e) => setScanFs(e.target.checked)}
              className="rounded border-gray-300"
            />
            Ler imagens do disco (scan)
          </label>
        </div>
      </div>

      {/* banner opcional para convidados */}
      {status !== 'authenticated' && (
        <div className="mb-4 text-sm text-gray-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          Você pode navegar livremente. Para concluir o apadrinhamento, faremos um cadastro rápido no próximo passo. 💚
        </div>
      )}

      <Stats stats={stats} />

      {error && (
        <div className="mt-4 mb-2 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filtros e busca */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-8">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-600 mr-2" />
          <h2 className="text-lg font-bold text-gray-800">Filtros e Busca</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="sm:col-span-2 xl:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <select
            value={filtros.cidade}
            onChange={(e) => setFiltros({ ...filtros, cidade: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todas as cidades</option>
            {cidades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filtros.escola}
            onChange={(e) => setFiltros({ ...filtros, escola: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todas as escolas</option>
            {escolas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          <select
            value={filtros.categoria}
            onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value as StatusFiltro })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todos os status</option>
            <option value="disponivel">Disponíveis</option>
            <option value="apadrinhado">Indisponíveis</option>
          </select>

          <select
            value={filtros.idade}
            onChange={(e) => setFiltros({ ...filtros, idade: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todas as idades</option>
            {FAIXAS_ETARIAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {childrenFiltradas.map((child) => {
          const nomeCidade = child.city?.name ?? child.cityName ?? '';
          return (
            <ChildCard
              key={child.id}
              child={{
                id: child.id,
                nome: child.name,
                idade: child.age ?? 0,
                cidade: nomeCidade,
                escola: child.school ?? '',
                categoria: child.category ?? '',
                descricao: child.description ?? '',
                apadrinhado: ['COMPLETED', 'PENDING'].includes(child.sponsorshipStatus),
                foto: child.photoUrl ?? '',
                status: child.sponsorshipStatus,
              }}
              onSponsor={() => handleSponsor(child.id)}
              sponsoring={sponsoringId === child.id}
            />
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-600 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando…
        </div>
      )}

      {!loading && childrenFiltradas.length === 0 && (
        <div className="text-center text-gray-500 py-10">Nenhuma criança encontrada com os filtros aplicados.</div>
      )}
    </div>
  );
}

/* helpers */
function uniq(arr: (string | undefined | null)[]) {
  return Array.from(new Set(arr.filter(Boolean) as string[]));
}
function uniqBy<T extends Record<string, unknown>>(arr: T[], key: keyof T) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = String(it[key]);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}
function normalizeStatus(s?: string): SponsorshipStatus {
  return s === 'ACTIVE' || s === 'PENDING' || s === 'ENDED' || s === 'CANCELLED' ? s : 'NONE';
}
async function safeErrMsg(res: Response) {
  try {
    const d = await res.json();
    return (d as { message?: string; error?: string })?.message || (d as any)?.error || res.statusText;
  } catch {
    return res.statusText;
  }
}
