// app/apadrinhamento/page.tsx
import { Suspense } from 'react';
import ApadrinhamentoClient from './ApadrinhamentoClient';

type SP = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  // só usamos "scan" aqui; se quiser levar outras querystrings, extraia e passe por props
  const initialScanFs = sp.scan === '1';

  return (
    <Suspense fallback={<div className="px-6 py-10">Carregando…</div>}>
      <ApadrinhamentoClient initialScanFs={initialScanFs} />
    </Suspense>
  );
}
