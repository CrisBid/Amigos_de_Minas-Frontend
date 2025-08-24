'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import {
  User, Mail, Phone, MapPin, Briefcase, Wallet, Heart, Save, Loader2,
  LogIn
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

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
const FAIXAS_RENDA = ['Até R$ 2.000', 'R$ 2.001 - R$ 4.000', 'R$ 4.001 - R$ 6.000', 'R$ 6.001 - R$ 10.000', 'Acima de R$ 10.000'];

export default function MeuPerfilPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_NEST_API_URL; // ex.: http://localhost:3001

  const provider = useMemo(() => (session as any)?.user?.provider as string | undefined, [session]);
  const accessToken = useMemo(() => (session as any)?.accessToken as string | undefined, [session]);
  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [form, setForm] = useState<Profile>({
    name: '',
    email: '',
    phone: '',
    cep: '',
    address: '',
    city: '',
    profession: '',
    incomeRange: '',
    maritalStatus: '',
  });

  useEffect(() => {
    // usuário não logado → leva pro login
    if (status === 'unauthenticated') {
      router.replace('/auth/login?callbackUrl=/perfil');
      return;
    }
    if (status !== 'authenticated') return;

    // validações rápidas
    if (!api) {
      setError('Configuração ausente: defina NEXT_PUBLIC_NEST_API_URL.');
      setLoading(false);
      return;
    }
    // Se logou com Google, você NÃO terá accessToken do Nest.
    if (provider !== 'nest' || !accessToken) {
      setError('Sua conta não está vinculada ao sistema (login via Google). Entre com e-mail e senha para editar seu perfil.');
      setLoading(false);
      return;
    }

    // Carrega dados
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const me = await fetchWithTimeout(`${api}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (!me.ok) throw new Error(await safeErrMsg(me));
        const meJson = await me.json();

        let profile: any = {};
        const pr = await fetchWithTimeout(`${api}/profiles/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (pr.ok) profile = await pr.json();

        setForm({
          name: meJson.name ?? '',
          email: meJson.email ?? '',
          phone: profile.phone ?? '',
          cep: profile.cep ?? '',
          address: profile.address ?? '',
          city: profile.city ?? '',
          profession: profile.profession ?? '',
          incomeRange: profile.incomeRange ?? '',
          maritalStatus: profile.maritalStatus ?? '',
        });
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Falha ao carregar seu perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, [status, api, accessToken, provider, router]);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function onPhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, phone: maskPhone(e.target.value) }));
  }
  function onCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, cep: maskCep(e.target.value) }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!api || !accessToken) {
      setError('Sessão ou configuração ausentes. Faça login novamente.');
      return;
    }
    setError(null); setOkMsg(null);

    startSaving(async () => {
      try {
        const res = await fetchWithTimeout(`${api}/profiles/me`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name: form.name,
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
        setOkMsg('Perfil atualizado com sucesso!');
        router.refresh();
      } catch (e: any) {
        setError(e?.message || 'Não foi possível salvar as alterações.');
      }
    });
  }

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto relative">
        {/* cabeçalho igual */}
        <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-6">
          {loading ? (
            <div className="flex items-center gap-3 text-[#253243]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Carregando suas informações…</span>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
              {provider !== 'nest' && (
                <button
                  onClick={() => router.push('/auth/login?callbackUrl=/perfil')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-[#253243] hover:bg-[#375A7F]"
                >
                  <LogIn className="w-4 h-4" /> Entrar com e-mail e senha
                </button>
              )}
            </div>
          ) : (
            /* o formulário que já te entreguei */
            <form onSubmit={onSubmit} className="space-y-6">
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                  {error}
                </div>
              )}
              {okMsg && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  {okMsg}
                </div>
              )}

              {/* Básico */}
              <Section title="Informações básicas">
                <div className="grid md:grid-cols-2 gap-6">
                  <Field
                    label="Nome completo"
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    icon={<User className="w-4 h-4 mr-2 text-blue-500" />}
                    placeholder="Seu nome"
                    required
                  />
                  <Field
                    label="E-mail"
                    name="email"
                    value={form.email}
                    onChange={() => {}}
                    icon={<Mail className="w-4 h-4 mr-2 text-green-500" />}
                    placeholder="seu@email.com"
                    readOnly
                  />
                </div>
              </Section>

              {/* Contato & Endereço */}
              <Section title="Contato & Endereço">
                <div className="grid md:grid-cols-2 gap-6">
                  <Field
                    label="Telefone"
                    name="phone"
                    value={form.phone || ''}
                    onChange={onPhoneChange}
                    icon={<Phone className="w-4 h-4 mr-2 text-yellow-500" />}
                    placeholder="(31) 99999-9999"
                  />
                  <Field
                    label="CEP"
                    name="cep"
                    value={form.cep || ''}
                    onChange={onCepChange}
                    icon={<MapPin className="w-4 h-4 mr-2 text-red-500" />}
                    placeholder="00000-000"
                  />
                  <Field
                    className="md:col-span-2"
                    label="Endereço"
                    name="address"
                    value={form.address || ''}
                    onChange={onChange}
                    icon={<MapPin className="w-4 h-4 mr-2 text-purple-500" />}
                    placeholder="Rua, número, bairro"
                  />
                  <Field
                    label="Cidade"
                    name="city"
                    value={form.city || ''}
                    onChange={onChange}
                    icon={<MapPin className="w-4 h-4 mr-2 text-indigo-500" />}
                    placeholder="Sua cidade"
                  />
                </div>
              </Section>

              {/* Perfil socioeconômico */}
              <Section title="Perfil">
                <div className="grid md:grid-cols-2 gap-6">
                  <Field
                    label="Profissão"
                    name="profession"
                    value={form.profession || ''}
                    onChange={onChange}
                    icon={<Briefcase className="w-4 h-4 mr-2 text-blue-400" />}
                    placeholder="Sua profissão"
                  />
                  <SelectField
                    label="Faixa de renda"
                    name="incomeRange"
                    value={form.incomeRange || ''}
                    onChange={onChange}
                    options={FAIXAS_RENDA}
                    icon={<Wallet className="w-4 h-4 mr-2 text-emerald-500" />}
                  />
                  <SelectField
                    label="Estado civil"
                    name="maritalStatus"
                    value={form.maritalStatus || ''}
                    onChange={onChange}
                    options={ESTADOS_CIVIS}
                    icon={<User className="w-4 h-4 mr-2 text-sky-500" />}
                  />
                </div>
              </Section>

              {/* Ações */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/alterar-senha')}
                  className="px-4 py-2 text-[#253243] border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Alterar senha
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600 transition ${
                    saving ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar alterações
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- UI helpers ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-base font-semibold text-[#253243] mb-3">{title}</h3>
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
}) {
  const { label, icon, className, readOnly, ...rest } = props;
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <label className="flex items-center text-sm font-semibold text-gray-700">
        {icon}
        {label}
      </label>
      <input
        {...rest}
        readOnly={readOnly}
        className={`w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300 ${
          readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
        }`}
      />
    </div>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  value: string;
  onChange: (e: any) => void;
  options: string[];
  icon?: React.ReactNode;
}) {
  const { label, name, value, onChange, options, icon } = props;
  return (
    <div className="space-y-2">
      <label className="flex items-center text-sm font-semibold text-gray-700">
        {icon}
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300 bg-white"
      >
        <option value="">Selecione…</option>
        {options.map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
    </div>
  );
}

/* ---------- utils ---------- */
function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, '$1-$2').trim();
}
function stripNonDigits(v?: string) {
  return (v || '').replace(/\D/g, '');
}
async function safeErrMsg(res: Response) {
  try {
    const j = await res.json();
    return (j?.message || j?.error || res.statusText) as string;
  } catch {
    return res.statusText;
  }
}

/* util: fetch com timeout */
async function fetchWithTimeout(input: RequestInfo, init?: RequestInit & { timeoutMs?: number }) {
  const timeoutMs = (init as any)?.timeoutMs ?? 10000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}
