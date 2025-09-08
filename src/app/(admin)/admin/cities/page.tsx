'use client';

import { useEffect, useMemo, useState } from 'react';

type City = { id: string; publicId: number; name: string; state?: string | null; createdAt: string; updatedAt: string };
type PageResp = { items: City[]; total: number; page: number; pageSize: number; pages: number };

export default function AdminCitiesPage() {
  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/cities?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`, { cache: 'no-store' });
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, page]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Cidades</h1>
        <CreateCityButton onCreated={load} />
      </header>

      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2 w-full md:w-80"
          placeholder="Buscar por nome/UF"
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
        />
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">UF</th>
              <th className="text-right px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!loading && data?.items?.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Nenhuma cidade encontrada.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Carregando…</td></tr>
            )}
            {data?.items?.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2">{c.publicId}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2">{c.state ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <EditCityButton city={c} onUpdated={load} />
                  <DeleteCityButton city={c} onDeleted={load} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <Pagination page={data.page} pages={data.pages} onChange={setPage} />
      )}
    </div>
  );
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const prev = () => onChange(Math.max(1, page - 1));
  const next = () => onChange(Math.min(pages, page + 1));
  const label = useMemo(() => `Página ${page} de ${pages}`, [page, pages]);

  return (
    <div className="flex items-center gap-2">
      <button className="border px-3 py-1 rounded" onClick={prev} disabled={page <= 1}>Anterior</button>
      <span className="text-gray-600">{label}</span>
      <button className="border px-3 py-1 rounded" onClick={next} disabled={page >= pages}>Próxima</button>
    </div>
  );
}

function CreateCityButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="bg-black text-white px-3 py-2 rounded" onClick={() => setOpen(true)}>+ Nova Cidade</button>
      {open && <CityDialog title="Nova Cidade" onClose={() => setOpen(false)} onSubmit={async (payload) => {
        const res = await fetch('/api/admin/cities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) { alert(await res.text()); return; }
        setOpen(false); onCreated();
      }} />}
    </>
  );
}

function EditCityButton({ city, onUpdated }: { city: City; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="border px-2 py-1 rounded mr-2" onClick={() => setOpen(true)}>Editar</button>
      {open && <CityDialog title="Editar Cidade" initial={city} onClose={() => setOpen(false)} onSubmit={async (payload) => {
        const res = await fetch(`/api/admin/cities/${city.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) { alert(await res.text()); return; }
        setOpen(false); onUpdated();
      }} />}
    </>
  );
}

function DeleteCityButton({ city, onDeleted }: { city: City; onDeleted: () => void }) {
  const del = async () => {
    if (!confirm(`Excluir a cidade "${city.name}"?`)) return;
    const res = await fetch(`/api/admin/cities/${city.id}`, { method: 'DELETE' });
    if (!res.ok) { alert(await res.text()); return; }
    onDeleted();
  };
  return <button className="border px-2 py-1 rounded" onClick={del}>Excluir</button>;
}

function CityDialog({
  title, initial, onClose, onSubmit,
}: {
  title: string;
  initial?: Partial<City>;
  onClose: () => void;
  onSubmit: (payload: { publicId?: number; name: string; state?: string }) => Promise<void>;
}) {
  const [publicId, setPublicId] = useState<number | ''>(initial?.publicId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [state, setState] = useState(initial?.state ?? '');

  const submit = async () => {
    if (name.trim().length < 2) { alert('Nome inválido'); return; }
    const payload: any = { name: name.trim() };
    if (state) payload.state = state.trim().toUpperCase();
    if (publicId !== '') payload.publicId = Number(publicId);
    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">ID público (opcional)</span>
            <input className="border rounded px-3 py-2" type="number" min={1} value={publicId} onChange={(e) => setPublicId(e.target.value === '' ? '' : Number(e.target.value))} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Nome*</span>
            <input className="border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">UF</span>
            <input className="border rounded px-3 py-2" maxLength={10} placeholder="MG" value={state ?? ''} onChange={(e) => setState(e.target.value)} />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 border rounded" onClick={onClose}>Cancelar</button>
          <button className="px-3 py-2 bg-black text-white rounded" onClick={submit}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
