'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Bell, Mail, Monitor, Send } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Pending = {
  count: number;
  latest: {
    id: string; createdAt: string; method: 'GIFT' | 'PIX'; childId: string; childName: string;
    childPublicId: number | null; sponsorName: string | null; campaignName: string | null;
  }[];
};
type Prefs = { email: string | null; emailPendingSponsorships: boolean; mailProblem: string | null };

const POLL_MS = 60_000;
const DESKTOP_KEY = 'admin:desktopNotify';
const SEEN_KEY = 'admin:lastPendingSeen';

const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };

function relTime(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 6e4);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

/**
 * Sino do painel: pedidos de apadrinhamento pendentes (atualiza a cada minuto) e as
 * preferências de aviso do admin — e-mail a cada novo pedido e alerta do navegador.
 */
export default function NotificationBell() {
  const { data: session, status } = useSession();
  const token = (session as any)?.accessToken ?? null;
  const roles: string[] = (session as any)?.user?.roles ?? (session as any)?.roles ?? [];
  const ready = status === 'authenticated' && !!token;

  const [pending, setPending] = useState<Pending | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDesktop(safeGet(DESKTOP_KEY) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted');
  }, []);

  const poll = useCallback(async () => {
    if (!ready) return;
    try {
      const res = await apiFetch('/notifications/pending', { cache: 'no-store' }, token);
      if (!res.ok) return;
      const data: Pending = await res.json();
      setPending(data);

      // alerta do navegador só para pedidos mais novos que o último já avisado
      const newest = data.latest[0]?.createdAt;
      const seen = safeGet(SEEN_KEY);
      if (newest && (!seen || newest > seen)) {
        if (seen && safeGet(DESKTOP_KEY) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const fresh = data.latest.filter((p) => p.createdAt > seen);
          const n = new Notification(
            fresh.length === 1 ? 'Novo apadrinhamento pendente' : `${fresh.length} novos apadrinhamentos pendentes`,
            {
              body: fresh.slice(0, 3).map((p) => `${p.childPublicId ?? ''} ${p.childName} — ${p.sponsorName ?? 'padrinho'}`).join('\n'),
              tag: 'pending-sponsorships',
            },
          );
          n.onclick = () => { window.focus(); window.location.href = '/admin/sponsorships'; };
        }
        safeSet(SEEN_KEY, newest);
      }
    } catch { /* rede: tenta no próximo ciclo */ }
  }, [ready, token]);

  useEffect(() => {
    if (!ready) return;
    poll();
    const id = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [ready, poll]);

  // preferências: carrega ao abrir
  useEffect(() => {
    if (!open || !ready || prefs) return;
    apiFetch('/notifications/preferences', { cache: 'no-store' }, token)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setPrefs(p))
      .catch(() => {});
  }, [open, ready, prefs, token]);

  // fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function toggleEmail() {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await apiFetch('/notifications/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emailPendingSponsorships: !prefs.emailPendingSponsorships }),
      }, token);
      if (res.ok) setPrefs(await res.json());
    } finally {
      setSaving(false);
    }
  }

  async function toggleDesktop() {
    if (desktop) { setDesktop(false); safeSet(DESKTOP_KEY, '0'); return; }
    if (typeof Notification === 'undefined') { alert('Este navegador não suporta notificações.'); return; }
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') { alert('As notificações foram bloqueadas no navegador. Libere nas configurações do site.'); return; }
    setDesktop(true);
    safeSet(DESKTOP_KEY, '1');
  }

  async function sendTest() {
    setTestMsg('Enviando…');
    try {
      const res = await apiFetch('/notifications/test', { method: 'POST' }, token);
      const j = await res.json().catch(() => null);
      setTestMsg(j?.sent ? `Enviado para ${j.to}` : `Não enviado: ${j?.reason ?? res.status}`);
    } catch {
      setTestMsg('Falha ao enviar');
    }
  }

  if (!ready || (roles.length && !roles.some((r) => r === 'ADMIN' || r === 'STAFF'))) return null;
  const count = pending?.count ?? 0;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-gray-600 hover:bg-white/80 hover:text-gray-900"
        title={count ? `${count} apadrinhamento(s) pendente(s)` : 'Notificações'}
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white shadow-xl z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-900">Apadrinhamentos pendentes</p>
            <p className="text-xs text-gray-500">{count ? `${count} aguardando aprovação` : 'Nenhum pedido aguardando'}</p>
          </div>

          {!!pending?.latest.length && (
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {pending.latest.map((p) => (
                <li key={p.id}>
                  <Link href="/admin/sponsorships" onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-gray-50">
                    <p className="text-sm text-gray-900">
                      <span className="text-gray-500">{p.childPublicId}</span> {p.childName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.sponsorName ?? 'Padrinho'} · {p.method === 'PIX' ? 'PIX' : 'Presente'} · {relTime(p.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {count > 0 && (
            <Link href="/admin/sponsorships" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 border-t border-gray-100">
              Abrir apadrinhamentos →
            </Link>
          )}

          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avisar-me de novos pedidos</p>

            <Toggle
              icon={<Mail className="w-4 h-4" />}
              label="Por e-mail"
              hint={prefs?.email ? `Para ${prefs.email}` : 'Carregando…'}
              checked={!!prefs?.emailPendingSponsorships}
              disabled={!prefs || saving}
              onChange={toggleEmail}
            />
            {prefs?.mailProblem && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                O servidor ainda não envia e-mails ({prefs.mailProblem}). A preferência fica salva e passa a valer quando for configurado.
              </p>
            )}
            {prefs?.emailPendingSponsorships && !prefs.mailProblem && (
              <button onClick={sendTest} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                <Send className="w-3.5 h-3.5" /> Enviar e-mail de teste
              </button>
            )}
            {testMsg && <p className="text-xs text-gray-600">{testMsg}</p>}

            <Toggle
              icon={<Monitor className="w-4 h-4" />}
              label="No navegador"
              hint="Alerta na tela enquanto o painel estiver aberto"
              checked={desktop}
              onChange={toggleDesktop}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ icon, label, hint, checked, disabled, onChange }: {
  icon: ReactNode; label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return (
    <button type="button" onClick={onChange} disabled={disabled} className="w-full flex items-center gap-3 text-left disabled:opacity-60">
      <span className="text-gray-500">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500 truncate">{hint}</span>}
      </span>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
