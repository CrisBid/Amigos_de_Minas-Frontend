import { Suspense } from 'react';
import ConcluirClient from './ConcluirClient';

type SP = Record<string, string | string[] | undefined>;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const childId = (sp.childId as string) ?? '';
  const campaignId = (sp.campaignId as string) ?? '';

  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-6 py-10">Carregando…</div>}>
      <ConcluirClient initialChildId={childId} initialCampaignId={campaignId} />
    </Suspense>
  );
}
