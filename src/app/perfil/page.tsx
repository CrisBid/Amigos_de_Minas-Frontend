'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  User, Mail, Phone, MapPin, Save, Loader2, LogIn, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle,
  Heart, Gift, ChevronRight, Home, Building2, RotateCcw,
} from 'lucide-react';

type Profile = {
  name: string;
  email: string;
  phone?: string;
  cep?: string;
  address?: string;
  city?: string;
  profession?: string;
  incomeRange?: string;
  maritalStatus?: string;
};

const EMPTY: Profile = { name: '', email: '', phone: '', cep: '', address: '', city: '', profession: '', incomeRange: '', maritalStatus: '' };
const MIN_PASSWORD = 6;
// apadrinhamentos que já chegaram à criança
const DONE = new Set(['COMPLETED']);
const CLOSED = new Set(['ENDED', 'CANCELLED']);

export default function MeuPerfilPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_NEST_API_URL;

  const provider = useMemo(() => (session as any)?.user?.provider as string | undefined, [session]);
  const accessToken = useMemo(() => (session as any)?.accessToken as string | undefined, [session]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [form, setForm] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState<Profile>(EMPTY); // último estado salvo, para saber se há mudanças
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total: number; active: number; done: number } | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login?callbackUrl=/perfil');
      return;
    }
    if (status !== 'authenticated') return;

    if (!api) {
      setFatal('Configuração ausente: defina NEXT_PUBLIC_NEST_API_URL.');
      setLoading(false);
      return;
    }
    // login pelo Google não tem token do sistema
    if (provider !== 'nest' || !accessToken) {
      setFatal('Sua conta entrou pelo Google e não está vinculada ao cadastro. Entre com e-mail e senha para editar seu perfil.');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setFatal(null);
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [me, pr, sp] = await Promise.all([
          fetchWithTimeout(`${api}/auth/me`, { headers, cache: 'no-store' }),
          fetchWithTimeout(`${api}/profiles/me`, { headers, cache: 'no-store' }),
          fetchWithTimeout(`${api}/sponsorships/me`, { headers, cache: 'no-store' }).catch(() => null),
        ]);
        if (!me.ok) throw new Error(await safeErrMsg(me));
        const meJson = await me.json();
        const profile: any = pr.ok ? await pr.json() : {};

        const loaded: Profile = {
          name: meJson.name ?? '',
          email: meJson.email ?? '',
          phone: profile.phone ? maskPhone(profile.phone) : '',
          cep: profile.cep ? maskCep(profile.cep) : '',
          address: profile.address ?? '',
          city: profile.city ?? '',
          profession: profile.profession ?? '',
          incomeRange: profile.incomeRange ?? '',
          maritalStatus: profile.maritalStatus ?? '',
        };
        setForm(loaded);
        setSaved(loaded);
        setMemberSince(meJson.createdAt ?? null);

        if (sp?.ok) {
          const list: { status: string }[] = await sp.json().catch(() => []);
          if (Array.isArray(list)) {
            setSummary({
              total: list.filter((s) => !CLOSED.has(s.status)).length,
              active: list.filter((s) => !CLOSED.has(s.status) && !DONE.has(s.status)).length,
              done: list.filter((s) => DONE.has(s.status)).length,
            });
          }
        }
      } catch (e: any) {
        setFatal(e?.name === 'AbortError' ? 'O servidor demorou a responder. Tente de novo.' : e?.message || 'Falha ao carregar seu perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, [status, api, accessToken, provider, router]);

  const dirty = (Object.keys(form) as (keyof Profile)[]).some((k) => (form[k] ?? '') !== (saved[k] ?? ''));

  // some o aviso de sucesso sozinho
  useEffect(() => {
    if (!okMsg) return;
    const t = setTimeout(() => setOkMsg(null), 4000);
    return () => clearTimeout(t);
  }, [okMsg]);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }
  function onPhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, phone: maskPhone(e.target.value) }));
  }
  function onCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cep = maskCep(e.target.value);
    setForm((prev) => ({ ...prev, cep }));
    if (stripNonDigits(cep).length === 8) lookupCep(stripNonDigits(cep));
  }

  // CEP completo: preenche endereço e cidade (só o que estiver vazio)
  async function lookupCep(cep: string) {
    setCepLoading(true);
    try {
      const r = await fetchWithTimeout(`https://viacep.com.br/ws/${cep}/json/`, { timeoutMs: 6000 });
      const j = r.ok ? await r.json() : null;
      if (!j || j.erro) return;
      const street = [j.logradouro, j.bairro].filter(Boolean).join(', ');
      const city = j.localidade ? `${j.localidade}${j.uf ? `/${j.uf}` : ''}` : '';
      setForm((prev) => ({
        ...prev,
        address: prev.address?.trim() ? prev.address : street,
        city: prev.city?.trim() ? prev.city : city,
      }));
    } catch {
      // sem conexão com o serviço de CEP: segue preenchendo à mão
    } finally {
      setCepLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!api || !accessToken) {
      setError('Sessão ou configuração ausentes. Faça login novamente.');
      return;
    }
    if (!form.name.trim()) { setError('Informe seu nome.'); return; }
    const phoneDigits = stripNonDigits(form.phone);
    if (phoneDigits && phoneDigits.length < 10) { setError('Telefone incompleto: use DDD + número.'); return; }

    setError(null); setOkMsg(null); setSaving(true);
    try {
      const res = await fetchWithTimeout(`${api}/profiles/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone,
          cep: stripNonDigits(form.cep),
          address: form.address,
          city: form.city,
          profession: form.profession,
          incomeRange: form.incomeRange,
          maritalStatus: form.maritalStatus,
        }),
      });
      if (!res.ok) throw new Error(await safeErrMsg(res));
      setSaved(form);
      setOkMsg('Perfil atualizado com sucesso!');
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  const firstName = (form.name || session?.user?.name || '').split(' ')[0];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Cabeçalho do perfil */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#253243] via-[#2f4a68] to-emerald-700 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10" aria-hidden />
        <div className="absolute right-16 -bottom-16 w-40 h-40 rounded-full bg-white/5" aria-hidden />
        <div className="relative p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 ring-2 ring-white/30 flex items-center justify-center text-2xl sm:text-3xl font-bold shrink-0">
            {initials(form.name || session?.user?.name || '')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/70">Olá{firstName ? `, ${firstName}` : ''} 👋</p>
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{loading ? 'Meu perfil' : form.name || 'Meu perfil'}</h1>
            <p className="text-sm text-white/80 truncate">{form.email || session?.user?.email}</p>
            {memberSince && (
              <p className="mt-1 text-xs text-white/60">Padrinho desde {new Date(memberSince).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            )}
          </div>
        </div>

        {/* resumo dos apadrinhamentos */}
        {summary && (
          <Link href="/meus-apadrinhamentos" className="relative grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 bg-black/10 hover:bg-black/20 transition">
            {[
              { label: 'Crianças', value: summary.total, icon: Heart },
              { label: 'Em andamento', value: summary.active, icon: Gift },
              { label: 'Entregues', value: summary.done, icon: CheckCircle2 },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="px-3 py-3 sm:py-4 text-center">
                <div className="text-xl sm:text-2xl font-bold inline-flex items-center gap-1.5"><Icon className="w-4 h-4 text-white/70" />{value}</div>
                <div className="text-[11px] sm:text-xs text-white/70">{label}</div>
              </div>
            ))}
          </Link>
        )}
      </div>

      {loading ? (
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 space-y-4 animate-pulse">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
        </div>
      ) : fatal ? (
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {fatal}
          </div>
          {provider !== 'nest' && (
            <button
              onClick={() => router.push('/auth/login?callbackUrl=/perfil')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white bg-[#253243] hover:bg-[#375A7F]"
            >
              <LogIn className="w-4 h-4" /> Entrar com e-mail e senha
            </button>
          )}
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-5">
            <Card title="Informações básicas" subtitle="Como você aparece para a equipe da campanha." icon={<User className="w-5 h-5" />}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Nome completo"
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  icon={<User className="w-4 h-4" />}
                  placeholder="Seu nome"
                  autoComplete="name"
                  required
                />
                <Field
                  label="E-mail"
                  name="email"
                  value={form.email}
                  onChange={() => {}}
                  icon={<Mail className="w-4 h-4" />}
                  readOnly
                  hint="O e-mail é usado no login e não pode ser alterado aqui."
                />
              </div>
            </Card>

            <Card title="Contato e endereço" subtitle="Usados para combinar a entrega dos presentes, se preciso." icon={<MapPin className="w-5 h-5" />}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Telefone / WhatsApp"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone || ''}
                  onChange={onPhoneChange}
                  icon={<Phone className="w-4 h-4" />}
                  placeholder="(31) 99999-9999"
                />
                <Field
                  label="CEP"
                  name="cep"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={form.cep || ''}
                  onChange={onCepChange}
                  icon={cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  placeholder="00000-000"
                  hint="Com o CEP completo, preenchemos endereço e cidade."
                />
                <Field
                  className="sm:col-span-2"
                  label="Endereço"
                  name="address"
                  autoComplete="street-address"
                  value={form.address || ''}
                  onChange={onChange}
                  icon={<Home className="w-4 h-4" />}
                  placeholder="Rua, número, bairro"
                />
                <Field
                  label="Cidade"
                  name="city"
                  autoComplete="address-level2"
                  value={form.city || ''}
                  onChange={onChange}
                  icon={<Building2 className="w-4 h-4" />}
                  placeholder="Sua cidade"
                />
              </div>
            </Card>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
              </div>
            )}

            {/* barra de salvar: fica presa no rodapé enquanto houver mudança */}
            <div className={`${dirty ? 'sticky bottom-3 z-30' : ''}`}>
              <div className={`flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 rounded-2xl ${dirty ? 'bg-white/95 backdrop-blur border border-gray-200 shadow-lg p-3' : ''}`}>
                {dirty && <span className="text-sm text-amber-700 sm:mr-auto">Você tem alterações não salvas.</span>}
                {dirty && (
                  <button
                    type="button"
                    onClick={() => { setForm(saved); setError(null); }}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" /> Desfazer
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || !dirty}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </form>

          <ChangePasswordCard api={api!} accessToken={accessToken!} email={form.email} />

          <Link
            href="/meus-apadrinhamentos"
            className="flex items-center gap-3 bg-white border border-gray-100 shadow-sm rounded-2xl p-4 hover:shadow-md transition"
          >
            <span className="p-2.5 rounded-xl bg-pink-50 text-pink-600"><Heart className="w-5 h-5" /></span>
            <span className="flex-1">
              <span className="block font-semibold text-[#253243]">Meus apadrinhamentos</span>
              <span className="block text-sm text-gray-500">Acompanhe a entrega dos presentes e baixe os cartões.</span>
            </span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </>
      )}

      {okMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-gray-900 text-white text-sm px-4 py-3 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {okMsg}
        </div>
      )}
    </div>
  );
}

/* ---------- Troca de senha ---------- */

function ChangePasswordCard({ api, accessToken, email }: { api: string; accessToken: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = passwordStrength(next);

  function reset() {
    setCurrent(''); setNext(''); setConfirm(''); setError(null); setShow(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < MIN_PASSWORD) return setError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (next !== confirm) return setError('A confirmação não é igual à nova senha.');
    setBusy(true);
    try {
      const r = await fetchWithTimeout(`${api}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!r.ok) throw new Error(await safeErrMsg(r));
      reset();
      setDone(true);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Não foi possível alterar a senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Segurança"
      subtitle="Troque a senha que você usa para entrar no site."
      icon={<KeyRound className="w-5 h-5" />}
      action={!open && (
        <button
          type="button"
          onClick={() => { setOpen(true); setDone(false); }}
          className="px-4 py-2 text-sm font-medium text-[#253243] border border-gray-200 rounded-xl hover:bg-gray-50"
        >
          Alterar senha
        </button>
      )}
    >
      {done && !open && (
        <p className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <CheckCircle2 className="w-4 h-4" /> Senha alterada. Use a nova senha no próximo login.
        </p>
      )}
      {!open && !done && (
        <p className="text-sm text-gray-500">
          Esqueceu a senha atual? <Link href="/forgot-password" className="text-blue-700 hover:underline">Receba um link por e-mail</Link>.
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="space-y-4">
          {/* ajuda o gerenciador de senhas do navegador a saber de qual conta é */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <PasswordInput label="Senha atual" value={current} onChange={setCurrent} show={show} autoComplete="current-password" autoFocus />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <PasswordInput label="Nova senha" value={next} onChange={setNext} show={show} autoComplete="new-password" />
              {next && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength.score ? strength.bar : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className={`mt-1 text-xs ${strength.text}`}>{strength.label}</p>
                </div>
              )}
            </div>
            <PasswordInput label="Confirmar nova senha" value={confirm} onChange={setConfirm} show={show} autoComplete="new-password" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} Mostrar senhas
          </label>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button type="button" onClick={() => { reset(); setOpen(false); }} disabled={busy} className="px-4 py-2.5 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !current || !next || !confirm}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold bg-[#253243] hover:bg-[#375A7F] disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Salvar nova senha
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

function PasswordInput({ label, value, onChange, show, autoComplete, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; autoComplete: string; autoFocus?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm"
      />
    </label>
  );
}

/* ---------- UI helpers ---------- */

function Card({ title, subtitle, icon, action, children }: {
  title: string; subtitle?: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="p-2 rounded-xl bg-[#253243]/5 text-[#253243] shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-[#253243]">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field(props: {
  label: string;
  name: string;
  value: string;
  onChange: (e: any) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  type?: string;
  required?: boolean;
  className?: string;
  readOnly?: boolean;
  hint?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}) {
  const { label, icon, className, readOnly, hint, ...rest } = props;
  return (
    <label className={`block space-y-1.5 ${className ?? ''}`}>
      <span className="text-sm font-semibold text-gray-700">{label}{props.required && <span className="text-red-500"> *</span>}</span>
      <span className="relative block">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{icon}</span>}
        <input
          {...rest}
          readOnly={readOnly}
          className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition hover:border-gray-300 text-base sm:text-sm ${
            readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
          }`}
        />
      </span>
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

/* ---------- utils ---------- */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function passwordStrength(p: string) {
  let score = 0;
  if (p.length >= MIN_PASSWORD) score++;
  if (p.length >= 10) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  if (p.length < MIN_PASSWORD) return { score: 1, label: `Muito curta (mínimo ${MIN_PASSWORD})`, bar: 'bg-red-500', text: 'text-red-600' };
  if (score <= 1) return { score, label: 'Fraca', bar: 'bg-orange-500', text: 'text-orange-600' };
  if (score === 2) return { score, label: 'Razoável', bar: 'bg-amber-500', text: 'text-amber-600' };
  if (score === 3) return { score, label: 'Boa', bar: 'bg-lime-500', text: 'text-lime-700' };
  return { score, label: 'Forte', bar: 'bg-emerald-500', text: 'text-emerald-700' };
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 10) return d.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? `-${c}` : ''}`);
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
function stripNonDigits(v?: string) {
  return (v || '').replace(/\D/g, '');
}
async function safeErrMsg(res: Response) {
  try {
    const j = await res.json();
    const m = j?.message || j?.error || res.statusText;
    return (Array.isArray(m) ? m.join(' ') : m) as string;
  } catch {
    return res.statusText;
  }
}

/* util: fetch com timeout */
async function fetchWithTimeout(input: RequestInfo, init?: RequestInit & { timeoutMs?: number }) {
  const { timeoutMs = 10000, ...rest } = init ?? {};
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}
