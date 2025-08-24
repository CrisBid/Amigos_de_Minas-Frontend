import { Suspense } from 'react';
import ConcluirClient from './ConcluirClient';

type SearchParams = Record<string, string | string[] | undefined>;

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  const childId = (searchParams.childId as string) ?? '';
  const campaignId = (searchParams.campaignId as string) ?? '';

  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-6 py-10">Carregando…</div>}>
      <ConcluirClient initialChildId={childId} initialCampaignId={campaignId} />
    </Suspense>
  );
}
