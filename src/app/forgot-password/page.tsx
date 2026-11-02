'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, Mail, MailCheck, KeyRound } from 'lucide-react';
import { apiPath } from '@/lib/api';

async function errorText(res: Response, fallback: string) {
  try {
    const j = await res.json();
    if (j?.message) return Array.isArray(j.message) ? j.message.join(' ') : String(j.message);
  } catch {
    // sem corpo JSON
  }
  return fallback;
}

/** Pede o link de redefinição: o backend envia por e-mail (se a conta existir). */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Informe um e-mail válido.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(apiPath('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) throw new Error(await errorText(res, 'Não foi possível enviar agora. Tente novamente.'));
      setSentTo(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar agora. Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-blue-100 to-green-100 rounded-full opacity-30 blur-xl" />
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-gradient-to-br from-green-100 to-blue-100 rounded-full opacity-20 blur-2xl" />

      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-green-500 rounded-2xl mb-6 shadow-lg">
              {sentTo ? <MailCheck className="w-10 h-10 text-white" /> : <KeyRound className="w-10 h-10 text-white" />}
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-3">
              {sentTo ? 'Verifique seu e-mail' : 'Esqueci minha senha'}
            </h1>
            <p className="text-gray-600">
              {sentTo
                ? 'Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha.'
                : 'Digite o e-mail da sua conta e enviaremos um link para você criar uma nova senha.'}
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl border border-gray-50 p-8">
            {sentTo ? (
              <div className="space-y-5 text-sm text-gray-700">
                <div className="rounded-2xl bg-green-50 border border-green-100 p-4">
                  Enviamos para <b className="break-all">{sentTo}</b>. O link vale por <b>1 hora</b> e só pode ser usado uma vez.
                </div>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>Não chegou? Confira a caixa de spam ou promoções.</li>
                  <li>Pode levar alguns minutos.</li>
                </ul>
                <button
                  onClick={() => { setSentTo(null); setError(null); }}
                  className="w-full py-3 px-6 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl font-medium text-gray-700"
                >
                  Enviar para outro e-mail
                </button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={submit} noValidate>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-500" /> E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 text-gray-800"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    autoFocus
                    disabled={sending}
                    required
                  />
                  <p className="text-xs text-gray-500">Entrou com telefone? Use o e-mail informado no seu cadastro.</p>
                </div>

                {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-3 disabled:opacity-70"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  <span>{sending ? 'Enviando…' : 'Enviar link'}</span>
                  {!sending && <ArrowRight className="w-5 h-5" />}
                </button>
              </form>
            )}
          </div>

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
