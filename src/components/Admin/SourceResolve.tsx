'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Hash, Heart, History, ImageIcon, Loader2, Mail, Pencil, Phone, Undo2, UserMinus, UserPlus, X, XCircle,
} from 'lucide-react';
import { issueToItem, type Issue, type SyncItem } from '@/lib/sourceCompare';
import { STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';

/* Resolver pendências da conferência: confere no servidor o que cada ajuste fará (cadastro
   existente, comunidade nova, padrinhos), deixa escolher item a item e grava em lotes. */

type ChildBrief = { id: string; publicId: number; name: string; community: string | null; birthDate: string | null; age: number | null; inCampaign: boolean };
type SponsorshipDetail = {
  id: string; status: SponsorshipStatus; method: string; donationAmount: string | null; pixPaidAt: string | null; createdAt: string; note: string | null;
  sponsor: { id: string; name: string; email: string; phone: string | null };
  collectionPoint: { name: string; cityName: string | null } | null;
  blocking: boolean; locked: boolean;
};
type Replacement = { id: string; publicId: number; name: string; community: string | null; age: number | null; gift: string | null; hasPhoto: boolean };
type Plan = {
  key: string; op: SyncItem['op']; ok: boolean; error?: string; warnings: string[]; effects: string[];
  child?: { id: string; name: string; publicId: number } | null;
  match?: { kind: 'new' } | { kind: 'reuse'; child: ChildBrief; reason: string };
  candidates?: ChildBrief[];
  community?: { action: string; name: string; similarTo?: string };
  sponsorships?: SponsorshipDetail[];
  needsDecision?: boolean;
  replacements?: Replacement[];
};
type Result = { key: string; ok: boolean; message?: string; childId?: string; auditId?: string };

const OP_ORDER: SyncItem['op'][] = ['create', 'renumber', 'update', 'photo', 'remove'];
const OP_TITLE: Record<SyncItem['op'], string> = {
  create: 'Cadastrar na campanha',
  renumber: 'Corrigir ID',
  update: 'Atualizar dados',
  photo: 'Trazer foto do Drive',
  remove: 'Tirar da campanha',
};
const OP_ICON: Record<SyncItem['op'], typeof UserPlus> = { create: UserPlus, renumber: Hash, update: Pencil, photo: ImageIcon, remove: UserMinus };
const FIELD_PT: Record<string, string> = { name: 'Nome', gift: 'Presente', birthDate: 'Nascimento', community: 'Comunidade', school: 'Escola' };
const CHUNK = 10;
const btn = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40';

const brl = (v: string | null) => (v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

async function errorText(res: Response) {
  try { const j = await res.json(); const m = j?.message ?? j?.error; return Array.isArray(m) ? m.join(' ') : String(m ?? `erro ${res.status}`); }
  catch { return `erro ${res.status}`; }
}

function newBatchId() {
  try { return crypto.randomUUID(); } catch { return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

export default function SourceResolve({
  campaignId, issues, cityIdByName, onClose,
}: {
  campaignId: string;
  issues: Issue[];
  cityIdByName: Record<string, string>;
  onClose: (changed: boolean) => void;
}) {
  const issueByKey = useMemo(() => {
    const m = new Map<string, Issue>();
    for (const i of issues) { const it = issueToItem(i, cityIdByName); if (it) m.set(it.key, i); }
    return m;
  }, [issues, cityIdByName]);
  const original = useRef(new Map<string, SyncItem>());

  const [items, setItems] = useState<Record<string, SyncItem>>({});
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<'planning' | 'review' | 'applying' | 'done'>('planning');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [batchId] = useState(newBatchId);
  const [undoState, setUndoState] = useState<string | null>(null);
  const skipped = issues.length - issueByKey.size;

  const post = async (path: string, body: unknown) => {
    const r = await fetch(`/api/admin/source-check/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await errorText(r));
    return r.json();
  };

  const defaultInclude = (p: Plan) => p.ok && !p.needsDecision && !p.warnings.some((w) => w.startsWith('Nada a mudar') || w.startsWith('O ID já é'));

  // confere tudo ao abrir
  useEffect(() => {
    let alive = true;
    (async () => {
      const list: SyncItem[] = [];
      for (const i of issues) { const it = issueToItem(i, cityIdByName); if (it) list.push(it); }
      original.current = new Map(list.map((i) => [i.key, i]));
      setItems(Object.fromEntries(list.map((i) => [i.key, i])));
      try {
        const out: Record<string, Plan> = {};
        for (let i = 0; i < list.length; i += 200) {
          setProgress(`Conferindo ${Math.min(list.length, i + 200)} de ${list.length}…`);
          const j = await post('plan', { campaignId, items: list.slice(i, i + 200) });
          for (const p of j.results as Plan[]) out[p.key] = p;
        }
        if (!alive) return;
        setPlans(out);
        setIncluded(new Set(Object.values(out).filter(defaultInclude).map((p) => p.key)));
        setPhase('review');
      } catch (e) {
        if (alive) { setError(e instanceof Error ? e.message : 'Falha ao conferir.'); setPhase('review'); }
      } finally {
        if (alive) setProgress('');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Muda um ajuste e confere de novo só ele */
  async function replan(next: SyncItem, include?: boolean) {
    setItems((p) => ({ ...p, [next.key]: next }));
    setBusyKeys((p) => new Set(p).add(next.key));
    try {
      const j = await post('plan', { campaignId, items: [next] });
      const p: Plan = j.results[0];
      setPlans((prev) => ({ ...prev, [p.key]: p }));
      setIncluded((prev) => {
        const s = new Set(prev);
        const ready = p.ok && (!p.needsDecision || (next.op === 'remove' && !!next.sponsorship));
        if (ready && (include ?? true)) s.add(p.key); else s.delete(p.key);
        return s;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao conferir.');
    } finally {
      setBusyKeys((p) => { const s = new Set(p); s.delete(next.key); return s; });
    }
  }

  const toggle = (key: string, on: boolean) => setIncluded((p) => { const s = new Set(p); if (on) s.add(key); else s.delete(key); return s; });

  const keysByOp = useMemo(() => {
    const m: Record<SyncItem['op'], string[]> = { create: [], renumber: [], update: [], photo: [], remove: [] };
    for (const it of Object.values(items)) m[it.op].push(it.key);
    for (const op of OP_ORDER) m[op].sort((a, b) => (issueByKey.get(a)?.name ?? '').localeCompare(issueByKey.get(b)?.name ?? '', 'pt-BR'));
    return m;
  }, [items, issueByKey]);

  const removingIds = useMemo(
    () => new Set(Object.values(items).filter((i) => i.op === 'remove' && included.has(i.key)).map((i) => (i as Extract<SyncItem, { op: 'remove' }>).childId)),
    [items, included],
  );
  const sponsoredKeys = keysByOp.remove.filter((k) => plans[k]?.sponsorships?.some((s) => s.blocking));
  const plainRemoveKeys = keysByOp.remove.filter((k) => !sponsoredKeys.includes(k));
  const chosen = [...included].filter((k) => items[k]);
  const chosenRemovals = chosen.filter((k) => items[k].op === 'remove').length;
  const chosenSponsorChanges = chosen.filter((k) => items[k].op === 'remove' && (items[k] as Extract<SyncItem, { op: 'remove' }>).sponsorship).length;

  async function apply() {
    setPhase('applying'); setError(null);
    const order = OP_ORDER.flatMap((op) => keysByOp[op].filter((k) => included.has(k)));
    const out: Record<string, Result> = {};
    try {
      for (let i = 0; i < order.length; i += CHUNK) {
        setProgress(`Gravando ${Math.min(order.length, i + CHUNK)} de ${order.length}…`);
        const j = await post('apply', { campaignId, batchId, items: order.slice(i, i + CHUNK).map((k) => items[k]) });
        for (const r of j.results as Result[]) out[r.key] = r;
        setResults({ ...out });
      }
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Falha ao gravar.'} O que já foi gravado está no histórico deste lote.`);
    } finally {
      setProgress('');
      setPhase('done');
    }
  }

  async function undoBatch() {
    if (!window.confirm('Desfazer tudo o que este lote gravou? As crianças voltam a ficar como estavam antes.')) return;
    setUndoState('Desfazendo…');
    try {
      const j = await post('undo-batch', { batchId });
      setUndoState(j.failed?.length
        ? `Desfeito ${j.undone} de ${j.total}. Não deu para desfazer: ${j.failed.map((f: { summary: string; message?: string }) => `${f.summary} (${f.message})`).join(' · ')}`
        : `Lote desfeito (${j.undone} ajuste(s)).`);
    } catch (e) {
      setUndoState(e instanceof Error ? e.message : 'Falha ao desfazer.');
    }
  }

  const okCount = Object.values(results).filter((r) => r.ok).length;
  const failCount = Object.values(results).filter((r) => !r.ok).length;
  const changed = okCount > 0;

  const title = (key: string) => {
    const i = issueByKey.get(key);
    const p = plans[key];
    return (
      <div className="min-w-0">
        <div className="font-medium text-gray-900 truncate">
          <span className="font-mono text-gray-500 mr-1.5">{i?.publicId}</span>{i?.name}
          {p?.child && p.child.name !== i?.name && <span className="text-xs text-gray-500"> · no site: {p.child.name}</span>}
        </div>
        <div className="text-xs text-gray-500">{i?.city}{i?.community ? ` / ${i.community}` : ''}</div>
      </div>
    );
  };

  const notes = (key: string) => {
    const p = plans[key];
    const r = results[key];
    if (!p) return null;
    return (
      <div className="mt-1 space-y-0.5 text-xs">
        {p.effects.map((e) => <div key={e} className="text-gray-700">• {e}</div>)}
        {p.warnings.map((w) => <div key={w} className="text-amber-800 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{w}</div>)}
        {p.error && <div className="text-red-700 flex gap-1"><XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />{p.error}</div>}
        {r && (r.ok
          ? <div className="text-emerald-700 flex gap-1"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />Gravado{r.message ? ` — ${r.message}` : ''}</div>
          : <div className="text-red-700 flex gap-1"><XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />{r.message}</div>)}
      </div>
    );
  };

  const check = (key: string, extraDisabled = false) => {
    const p = plans[key];
    const it = items[key];
    const ready = !!p?.ok && (!p.needsDecision || (it?.op === 'remove' && !!(it as Extract<SyncItem, { op: 'remove' }>).sponsorship));
    return (
      <input
        type="checkbox"
        className="mt-1 w-4 h-4 accent-blue-600 shrink-0"
        checked={included.has(key)}
        disabled={!ready || extraDisabled || phase !== 'review' || busyKeys.has(key)}
        onChange={(e) => toggle(key, e.target.checked)}
        title={ready ? '' : 'Resolva o aviso antes de incluir'}
      />
    );
  };

  const sectionHeader = (op: SyncItem['op'], keys: string[], label?: string) => {
    const Icon = OP_ICON[op];
    const can = keys.filter((k) => plans[k]?.ok && !plans[k]?.needsDecision);
    return (
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-600" />
        <h3 className="font-semibold text-gray-900">{label ?? OP_TITLE[op]}</h3>
        <span className="text-sm text-gray-500">{keys.filter((k) => included.has(k)).length} de {keys.length} marcada(s)</span>
        {phase === 'review' && can.length > 0 && (
          <span className="ml-auto flex gap-2 text-xs">
            <button className="text-blue-700 hover:underline" onClick={() => setIncluded((p) => { const s = new Set(p); can.forEach((k) => s.add(k)); return s; })}>marcar todas</button>
            <button className="text-gray-600 hover:underline" onClick={() => setIncluded((p) => { const s = new Set(p); keys.forEach((k) => s.delete(k)); return s; })}>desmarcar</button>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-5xl sm:rounded-2xl shadow-xl flex flex-col max-h-full sm:max-h-[92vh]">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Resolver pendências</h2>
            <p className="text-sm text-gray-600">
              Confira o que vai acontecer com cada criança, desmarque o que não quiser e grave. Tudo fica no histórico e pode ser desfeito.
              {skipped > 0 && <> {skipped} pendência(s) selecionada(s) não se resolvem por aqui (ID com outra criança, fotos sem criança, sem foto).</>}
            </p>
          </div>
          <button onClick={() => onClose(changed)} disabled={phase === 'applying'} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {phase === 'planning' && (
            <div className="flex items-center gap-2 text-gray-600 py-10 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> {progress || 'Conferindo…'}</div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>
          )}

          {phase !== 'planning' && sponsoredKeys.length > 0 && (
            <section>
              {sectionHeader('remove', sponsoredKeys, 'Saíram da planilha e têm padrinho')}
              <p className="text-xs text-gray-600 mb-3">
                Para tirar estas crianças, decida o que acontece com o apadrinhamento. Sem decisão, a criança fica na campanha. Avise o padrinho pelo contato abaixo.
              </p>
              <div className="space-y-3">
                {sponsoredKeys.map((key) => {
                  const p = plans[key];
                  const it = items[key] as Extract<SyncItem, { op: 'remove' }>;
                  const sp = p?.sponsorships?.find((s) => s.blocking);
                  const decision = it?.sponsorship?.decision ?? 'keep';
                  const replacements = (p?.replacements ?? []).filter((r) => !removingIds.has(r.id) || r.id === it?.sponsorship?.replacementChildId);
                  const set = (d: 'keep' | 'cancel' | 'replace', replacementChildId?: string) => {
                    if (!sp) return;
                    if (d === 'keep') { setItems((prev) => ({ ...prev, [key]: { ...it, sponsorship: null } })); toggle(key, false); return; }
                    void replan({ ...it, sponsorship: { id: sp.id, decision: d, replacementChildId: d === 'replace' ? replacementChildId ?? null : null } });
                  };
                  return (
                    <div key={key} className={`rounded-xl border p-4 ${included.has(key) ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`}>
                      <div className="flex items-start gap-3">
                        {check(key)}
                        <div className="flex-1 min-w-0 space-y-2">
                          {title(key)}
                          {sp && (
                            <div className="rounded-lg bg-white border border-gray-200 p-3 text-sm grid gap-1 sm:grid-cols-2">
                              <div className="flex items-center gap-1.5 font-semibold text-gray-900 sm:col-span-2"><Heart className="w-4 h-4 text-pink-600" /> {sp.sponsor.name}</div>
                              <div className="flex items-center gap-1.5 text-gray-700 min-w-0"><Mail className="w-3.5 h-3.5 shrink-0" /><a href={`mailto:${sp.sponsor.email}`} className="truncate hover:underline">{sp.sponsor.email}</a></div>
                              <div className="flex items-center gap-1.5 text-gray-700"><Phone className="w-3.5 h-3.5 shrink-0" />{sp.sponsor.phone || 'sem telefone'}</div>
                              <div><span className="text-gray-500">Situação:</span> <b>{STATUS_PT[sp.status] ?? sp.status}</b></div>
                              <div><span className="text-gray-500">Forma:</span> {sp.method === 'PIX' ? `PIX ${brl(sp.donationAmount)}${sp.pixPaidAt ? ` (pago em ${day(sp.pixPaidAt)})` : ''}` : 'Presente'}</div>
                              <div><span className="text-gray-500">Ponto de coleta:</span> {sp.collectionPoint ? `${sp.collectionPoint.name}${sp.collectionPoint.cityName ? ` (${sp.collectionPoint.cityName})` : ''}` : '—'}</div>
                              <div><span className="text-gray-500">Desde:</span> {day(sp.createdAt)}</div>
                              {sp.note && <div className="sm:col-span-2 text-xs text-gray-600 whitespace-pre-line"><span className="text-gray-500">Observação:</span> {sp.note}</div>}
                              {sp.status !== 'PENDING' && (
                                <div className="sm:col-span-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                                  O apadrinhamento já está em &quot;{STATUS_PT[sp.status]}&quot;: o presente pode já ter sido comprado ou entregue. Fale com o padrinho antes.
                                </div>
                              )}
                            </div>
                          )}
                          {sp && !sp.locked && phase === 'review' && (
                            <div className="flex flex-col gap-1.5 text-sm">
                              <label className="inline-flex items-center gap-2"><input type="radio" name={`d-${key}`} checked={decision === 'keep'} onChange={() => set('keep')} /> Deixar na campanha por enquanto</label>
                              <label className="inline-flex items-center gap-2"><input type="radio" name={`d-${key}`} checked={decision === 'cancel'} onChange={() => set('cancel')} /> Cancelar o apadrinhamento e tirar da campanha</label>
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex items-center gap-2"><input type="radio" name={`d-${key}`} checked={decision === 'replace'} onChange={() => set('replace', it.sponsorship?.replacementChildId ?? replacements[0]?.id)} disabled={!replacements.length} /> Passar o apadrinhamento para</label>
                                <select
                                  value={it?.sponsorship?.decision === 'replace' ? it.sponsorship.replacementChildId ?? '' : ''}
                                  onChange={(e) => set('replace', e.target.value)}
                                  disabled={!replacements.length}
                                  className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-sm max-w-full"
                                >
                                  <option value="" disabled>{replacements.length ? 'escolha a criança' : 'nenhuma criança livre na cidade'}</option>
                                  {replacements.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.publicId} · {r.name}{r.age != null ? ` · ${r.age} anos` : ''}{r.community ? ` · ${r.community}` : ''}{r.gift ? ` · ${r.gift}` : ''}{r.hasPhoto ? '' : ' · sem foto'}
                                    </option>
                                  ))}
                                </select>
                                {busyKeys.has(key) && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                              </div>
                            </div>
                          )}
                          {notes(key)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {phase !== 'planning' && OP_ORDER.map((op) => {
            const keys = op === 'remove' ? plainRemoveKeys : keysByOp[op];
            if (!keys.length) return null;
            return (
              <section key={op}>
                {sectionHeader(op, keys, op === 'remove' ? 'Saíram da planilha (sem padrinho)' : undefined)}
                <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                  {keys.map((key) => {
                    const p = plans[key];
                    const it = items[key];
                    return (
                      <li key={key} className="flex items-start gap-3 px-3 py-2.5">
                        {check(key)}
                        <div className="flex-1 min-w-0">
                          {title(key)}
                          {/* cadastro: novo ou um que já existe */}
                          {it.op === 'create' && p && phase === 'review' && ((p.candidates?.length ?? 0) > 0 || p.match?.kind === 'reuse' || !p.ok) && (
                            <select
                              className="mt-1 border border-gray-200 rounded-lg px-2 py-1 bg-white text-xs max-w-full"
                              value={it.useChildId ? `use:${it.useChildId}` : it.forceNew ? 'new' : 'auto'}
                              onChange={(e) => {
                                const v = e.target.value;
                                void replan({ ...it, useChildId: v.startsWith('use:') ? v.slice(4) : null, forceNew: v === 'new' });
                              }}
                            >
                              <option value="auto">Automático{p.match?.kind === 'reuse' ? ` (usa ${p.match.child.name})` : p.match?.kind === 'new' ? ' (cadastro novo)' : ''}</option>
                              <option value="new">Cadastrar como nova criança</option>
                              {(p.candidates ?? []).map((c) => (
                                <option key={c.id} value={`use:${c.id}`}>
                                  Usar cadastro: {c.name} (ID {c.publicId}{c.birthDate ? `, nasc. ${day(c.birthDate)}` : ''}{c.community ? `, ${c.community}` : ''}{c.inCampaign ? ', já na campanha' : ''})
                                </option>
                              ))}
                            </select>
                          )}
                          {/* atualização: escolher os campos */}
                          {it.op === 'update' && phase === 'review' && (() => {
                            const orig = original.current.get(key) as Extract<SyncItem, { op: 'update' }> | undefined;
                            const all = Object.keys(orig?.fields ?? {}) as (keyof Extract<SyncItem, { op: 'update' }>['fields'])[];
                            if (all.length < 2) return null;
                            return (
                              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                                {all.map((f) => (
                                  <label key={f} className="inline-flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={it.fields[f] !== undefined}
                                      onChange={(e) => {
                                        const fields = { ...it.fields };
                                        if (e.target.checked) (fields as Record<string, unknown>)[f] = orig!.fields[f]; else delete fields[f];
                                        void replan({ ...it, fields }, Object.keys(fields).length > 0);
                                      }}
                                    />
                                    {FIELD_PT[f]}
                                  </label>
                                ))}
                              </div>
                            );
                          })()}
                          {busyKeys.has(key) ? <div className="text-xs text-gray-500 mt-1 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> conferindo…</div> : notes(key)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {phase === 'done' && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
              <div className="font-semibold text-gray-900">
                {okCount} ajuste(s) gravado(s){failCount ? `, ${failCount} com erro (veja acima)` : ''}.
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/audit?batchId=${encodeURIComponent(batchId)}`} target="_blank" className={`${btn} border border-gray-200 bg-white text-gray-700`}><History className="w-4 h-4" /> Ver no histórico</Link>
                {okCount > 0 && (
                  <button onClick={undoBatch} disabled={!!undoState && undoState === 'Desfazendo…'} className={`${btn} border border-red-200 bg-white text-red-700`}>
                    <Undo2 className="w-4 h-4" /> Desfazer este lote
                  </button>
                )}
              </div>
              {undoState && <p className="text-gray-700">{undoState}</p>}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap items-center gap-3">
          {phase === 'review' && chosenRemovals > 0 && (
            <label className="inline-flex items-start gap-2 text-sm text-gray-800 max-w-xl">
              <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              Confirmo tirar {chosenRemovals} criança(s) da campanha{chosenSponsorChanges ? ` e mudar ${chosenSponsorChanges} apadrinhamento(s)` : ''}.
            </label>
          )}
          {progress && phase === 'applying' && <span className="text-sm text-gray-600 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {progress}</span>}
          <div className="ml-auto flex gap-2">
            <button onClick={() => onClose(changed)} disabled={phase === 'applying'} className={`${btn} border border-gray-200 bg-white text-gray-700`}>
              {phase === 'done' ? 'Fechar e conferir de novo' : 'Cancelar'}
            </button>
            {phase === 'review' && (
              <button
                onClick={apply}
                disabled={!chosen.length || (chosenRemovals > 0 && !confirmed) || busyKeys.size > 0}
                className={`${btn} bg-blue-600 text-white`}
              >
                Gravar {chosen.length} ajuste(s)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
