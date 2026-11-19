'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, PlusCircle, School, XCircle } from 'lucide-react';
import type { MissingCommunity, MissingSchool } from '@/lib/sourceCompare';

/* Comunidades e escolas que aparecem na planilha e não existem no site: confere, ajusta o nome
   e cadastra. Cada cadastro vai para o histórico. */

type Result = { cityId: string; name: string; ok: boolean; id?: string; status?: string; message?: string };

const btn = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40';

function newBatchId() {
  try { return crypto.randomUUID(); } catch { return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

export default function SourceMissing({
  campaignId, communities, schools, onDone,
}: {
  campaignId: string;
  communities: MissingCommunity[];
  schools: MissingSchool[];
  /** depois de cadastrar: recarregar as listas e ligar as escolas criadas às suas comunidades */
  onDone: (created: { schools: { linkKeys: string[]; id: string }[] }) => Promise<void> | void;
}) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ ok: string[]; failed: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // novas pendências entram marcadas, menos as comunidades parecidas com uma que já existe
  const allKeys = useMemo(() => [...communities.map((c) => `c:${c.key}`), ...schools.map((s) => `s:${s.key}`)].join(','), [communities, schools]);
  useEffect(() => {
    setChecked(new Set([
      ...communities.filter((c) => !c.similar).map((c) => `c:${c.key}`),
      ...schools.map((s) => `s:${s.key}`),
    ]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKeys]);

  if (!communities.length && !schools.length && !results) return null;

  const nameOf = (key: string, fallback: string) => names[key] ?? fallback;
  const toggle = (k: string, on: boolean) => setChecked((p) => { const s = new Set(p); if (on) s.add(k); else s.delete(k); return s; });
  const chosenC = communities.filter((c) => checked.has(`c:${c.key}`));
  const chosenS = schools.filter((s) => checked.has(`s:${s.key}`));

  async function register() {
    setBusy(true); setError(null); setResults(null);
    try {
      const r = await fetch('/api/admin/source-check/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          batchId: newBatchId(),
          communities: chosenC.map((c) => ({ cityId: c.cityId, name: nameOf(`c:${c.key}`, c.name) })),
          schools: chosenS.map((s) => ({ cityId: s.cityId, name: nameOf(`s:${s.key}`, s.name), communityNames: s.communities })),
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.message ? String(j.message) : `erro ${r.status}`);
      }
      const j: { communities: Result[]; schools: Result[] } = await r.json();
      const ok: string[] = [], failed: string[] = [];
      for (const x of j.communities) (x.ok ? ok : failed).push(`Comunidade ${x.name}: ${x.ok ? x.status : x.message}`);
      for (const x of j.schools) (x.ok ? ok : failed).push(`Escola ${x.name}: ${x.ok ? x.status : x.message}${x.ok && x.message ? ` (${x.message})` : ''}`);
      setResults({ ok, failed });
      const created = j.schools
        .map((x, i) => (x.ok && x.id ? { linkKeys: chosenS[i].linkKeys, id: x.id } : null))
        .filter(Boolean) as { linkKeys: string[]; id: string }[];
      await onDone({ schools: created });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao cadastrar.');
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full max-w-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-sm';

  return (
    <section className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlusCircle className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-gray-900">Cadastros que faltam no site</h2>
        <span className="text-sm text-gray-600">
          {communities.length > 0 && `${communities.length} comunidade(s)`}{communities.length > 0 && schools.length > 0 && ' e '}{schools.length > 0 && `${schools.length} escola(s)`} da planilha não existem no site.
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Confira o nome (sugerido com maiúsculas só nas iniciais), desmarque o que não quiser e cadastre. As crianças novas dessas comunidades e escolas passam a ser ligadas a elas. Sem cadastrar aqui, a comunidade é criada sozinha quando a primeira criança dela for gravada.
      </p>

      {communities.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1 inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Comunidades</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {communities.map((c) => {
                const k = `c:${c.key}`;
                return (
                  <tr key={k} className="align-top">
                    <td className="py-1.5 pr-2 w-6"><input type="checkbox" className="mt-1.5 accent-amber-600" checked={checked.has(k)} onChange={(e) => toggle(k, e.target.checked)} /></td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-gray-700">{c.city}<div className="text-xs text-gray-500">{c.count} criança(s) na planilha</div></td>
                    <td className="py-1.5">
                      <input className={input} value={nameOf(k, c.name)} onChange={(e) => setNames((p) => ({ ...p, [k]: e.target.value }))} disabled={c.status === 'deleted'} />
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        na planilha: {c.sheetName}
                        {c.status === 'deleted' && <span className="text-amber-800"> · existe, mas foi excluída: será reativada</span>}
                        {c.similar && <span className="text-amber-800"> · parecida com &quot;{c.similar}&quot; no site: confira se não é a mesma (aí corrija o nome na planilha)</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {schools.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1 inline-flex items-center gap-1"><School className="w-3.5 h-3.5" /> Escolas (marcadas como &quot;criar escola nova&quot; em Escolas da planilha)</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {schools.map((s) => {
                const k = `s:${s.key}`;
                return (
                  <tr key={k} className="align-top">
                    <td className="py-1.5 pr-2 w-6"><input type="checkbox" className="mt-1.5 accent-amber-600" checked={checked.has(k)} onChange={(e) => toggle(k, e.target.checked)} /></td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-gray-700">{s.city}<div className="text-xs text-gray-500">{s.count} criança(s)</div></td>
                    <td className="py-1.5">
                      <input className={input} value={nameOf(k, s.name)} onChange={(e) => setNames((p) => ({ ...p, [k]: e.target.value }))} />
                      <div className="text-[11px] text-gray-500 mt-0.5">na planilha: {s.sheetName} · atende: {s.communities.join(', ')}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={register} disabled={busy || (!chosenC.length && !chosenS.length)} className={`${btn} bg-amber-600 text-white`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
          Cadastrar {chosenC.length + chosenS.length} selecionada(s)
        </button>
        {error && <span className="text-sm text-red-700 inline-flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {error}</span>}
      </div>
      {results && (
        <div className="text-xs space-y-0.5">
          {results.ok.map((t) => <div key={t} className="text-emerald-700 flex gap-1"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />{t}</div>)}
          {results.failed.map((t) => <div key={t} className="text-red-700 flex gap-1"><XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />{t}</div>)}
        </div>
      )}
    </section>
  );
}
