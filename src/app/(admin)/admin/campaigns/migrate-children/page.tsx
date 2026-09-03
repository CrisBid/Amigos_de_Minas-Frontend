import { Suspense } from 'react';
import MigrateChildrenClient from './MigrateChildrenClient';

export default function MigrateChildrenPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-6 py-10">Carregando…</div>}>
      <MigrateChildrenClient />
    </Suspense>
  );
}
