'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, XCircle } from 'lucide-react';
import { apiPath } from '@/lib/api';

const MIN = 6;

async function errorText(res: Response, fallback: string) {
  try {
    const j = await res.json();
    if (j?.message) return Array.isArray(j.message) ? j.message.join(' ') : String(j.message);
  } catch {
    // sem corpo JSON
  }
  return fallback;
}

export default function ResetPasswordPage() {
  // useSearchParams precisa de Suspense para a página poder ser pré-renderizada
  return (
    <Suspense fallback={<Shell><div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div></Shell>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'checking' | 'invalid' | 'form' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // confere o link antes de mostrar o formulário
  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(token)) { setState('invalid'); return; }
    fetch(apiPath(`/auth/reset-password/validate?token=${token}`), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { valid: false }))
      .then((j) => setState(j?.valid ? 'form' : 'invalid'))
      .catch(() => setState('form')); // sem conexão com a validação: o envio confere de novo
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN) return setError(`A senha precisa ter pelo menos ${MIN} caracteres.`);
    if (password !== confirm) return setError('As senhas não são iguais.');
    setSaving(true);
    try {
      const res = await fetch(apiPath('/auth/reset-password'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const msg = await errorText(res, 'Não foi possível salvar a nova senha.');
        if (res.status === 400 && /inválido|expirou/i.test(msg)) setState('invalid');
        throw new Error(msg);
      }
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a nova senha.');
    } finally {
      setSaving(false);
    }
  }

  if (state === 'checking') {
    return <Shell><div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div></Shell>;
  }

  if (state === 'invalid') {
    return (
      <Shell icon={<XCircle className="w-10 h-10 text-white" />} title="Link inválido ou expirado" subtitle="O link de redefinição vale por 1 hora e só pode ser usado uma vez.">
        <Link href="/forgot-password" className="block w-full text-center py-4 px-6 bg-gradient-to-r from-blue-600 to-green-500 text-white font-semibold rounded-2xl">
          Pedir um novo link
        </Link>
      </Shell>
    );
  }

  if (state === 'done') {
    return (
      <Shell icon={<CheckCircle2 className="w-10 h-10 text-white" />} title="Senha alterada" subtitle="Pronto! Agora é só entrar com a nova senha.">
        <Link href="/auth/login" className="block w-full text-center py-4 px-6 bg-gradient-to-r from-blue-600 to-green-500 text-white font-semibold rounded-2xl">
          Ir para o login
        </Link>
      </Shell>
    );
  }

  const strong = password.length >= 10 && /\d/.test(password) && /[a-zA-Z]/.test(password);
  return (
    <Shell title="Criar nova senha" subtitle="Escolha uma senha nova para sua conta.">
      <form className="space-y-5" onSubmit={submit} noValidate>
        <PasswordField label="Nova senha" value={password} onChange={setPassword} show={show} onToggle={() => setShow((s) => !s)} disabled={saving} autoFocus />
        {password && (
          <p className={`text-xs -mt-3 ${password.length < MIN ? 'text-red-600' : strong ? 'text-green-700' : 'text-amber-700'}`}>
            {password.length < MIN ? `Mínimo de ${MIN} caracteres` : strong ? 'Senha forte' : 'Dica: use 10+ caracteres com letras e números'}
          </p>
        )}
        <PasswordField label="Confirmar nova senha" value={confirm} onChange={setConfirm} show={show} onToggle={() => setShow((s) => !s)} disabled={saving} />
        {confirm && confirm !== password && <p className="text-xs -mt-3 text-red-600">As senhas não são iguais</p>}

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-3 disabled:opacity-70"
        >
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {saving ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </Shell>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, disabled, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; disabled?: boolean; autoFocus?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Lock className="w-4 h-4 text-green-500" /> {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-3 focus:ring-green-100 focus:border-green-400 text-gray-800 pr-12"
          autoComplete="new-password"
          disabled={disabled}
          autoFocus={autoFocus}
          required
        />
        <button type="button" onClick={onToggle} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

function Shell({ icon, title, subtitle, children }: { icon?: React.ReactNode; title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-blue-100 to-green-100 rounded-full opacity-30 blur-xl" />
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-gradient-to-br from-green-100 to-blue-100 rounded-full opacity-20 blur-2xl" />
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-green-500 rounded-2xl mb-6 shadow-lg">
              {icon ?? <KeyRound className="w-10 h-10 text-white" />}
            </div>
            {title && <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-3">{title}</h1>}
            {subtitle && <p className="text-gray-600">{subtitle}</p>}
          </div>
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-50 p-8">{children}</div>
          <div className="text-center mt-8">
            <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4" /> Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
