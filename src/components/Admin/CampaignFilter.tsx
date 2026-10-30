'use client';

import { useEffect, useState } from 'react';
import { CalendarRange } from 'lucide-react';

export type CampaignOption = { id: string; name: string; slug?: string; year?: number | null; status?: string | null };

const STORAGE_KEY = 'admin.campaignId';
const ALL = 'all';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'ativa',
  DRAFT: 'rascunho',
  FINISHED: 'finalizada',
  ARCHIVED: 'arquivada',
};

function readStored(): string | null {
  try { return window.sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStored(value: string) {
  try { window.sessionStorage.setItem(STORAGE_KEY, value); } catch { /* sem storage: só não lembra */ }
}

/**
 * Campanha selecionada nas telas do admin. Começa com a única campanha ativa
 * (se houver exatamente uma); a escolha é lembrada ao navegar entre as telas.
 * `ready` só fica true depois de decidir o valor inicial, para as telas não
 * carregarem dados duas vezes.
 */
export function useAdminCampaign() {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignIdState] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      let list: CampaignOption[] = [];
      try {
        const res = await fetch('/api/admin/campaigns?pageSize=200', { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          list = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
        }
      } catch { /* sem campanhas: filtro fica em "todas" */ }

      list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name));
      setCampaigns(list);

      const stored = readStored();
      const active = list.filter((c) => c.status === 'ACTIVE');
      if (stored === ALL) setCampaignIdState('');
      else if (stored && list.some((c) => c.id === stored)) setCampaignIdState(stored);
      else setCampaignIdState(active.length === 1 ? active[0].id : '');
      setReady(true);
    })();
  }, []);

  const setCampaignId = (id: string) => {
    setCampaignIdState(id);
    writeStored(id || ALL);
  };

  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  return { campaigns, campaignId, setCampaignId, campaign, ready };
}

export const campaignLabel = (c: CampaignOption) =>
  `${c.name}${c.year ? ` (${c.year})` : ''}${c.status && c.status !== 'ACTIVE' ? ` · ${STATUS_LABEL[c.status] ?? c.status}` : ''}`;

export default function CampaignFilter({
  campaigns,
  value,
  onChange,
  className = '',
}: {
  campaigns: CampaignOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      <CalendarRange className="w-4 h-4 text-gray-500 shrink-0" />
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Campanha</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      >
        <option value="">Todas as campanhas</option>
        {campaigns.map((c) => (<option key={c.id} value={c.id}>{campaignLabel(c)}</option>))}
      </select>
    </label>
  );
}
