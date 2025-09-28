'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield, Sparkles } from 'lucide-react';

export default function ModernLoginScreen() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCredentialsLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Informe e-mail e senha.');
      return;
    }

    setSubmitting(true);
    try {
      // Usa o provider "credentials" definido no NextAuth (que chama seu Nest)
      const res = await signIn('credentials', {
        redirect: false,         // controlamos o redirect manualmente
        email,
        password,
        callbackUrl: '/',        // para onde ir ao logar
      });

      if (res?.error) {
        setError(res.error === 'CredentialsSignin' ? 'Credenciais inválidas.' : res.error);
        setSubmitting(false);
        return;
      }

      // sucesso
      router.push(res?.url || '/');
      router.refresh();
    } catch (err) {
      setError('Falha ao entrar. Tente novamente.');
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setSubmitting(true);
    // Dispara o fluxo OAuth do Google
    await signIn('google', { callbackUrl: '/' });
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* BG decorativo */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-blue-100 to-green-100 rounded-full opacity-30 blur-xl"></div>
      <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-yellow-100 to-red-100 rounded-full opacity-25 blur-lg"></div>
      <div className="absolute bottom-20 left-20 w-40 h-40 bg-gradient-to-br from-green-100 to-blue-100 rounded-full opacity-20 blur-2xl"></div>
      <div className="absolute bottom-40 right-10 w-20 h-20 bg-gradient-to-br from-red-100 to-yellow-100 rounded-full opacity-30 blur-md"></div>

      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-green-500 rounded-2xl mb-6 shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-3">
              Bem-vindo
            </h1>
            <p className="text-gray-600 text-lg">Entre na sua conta para continuar</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-50 p-8 backdrop-blur-sm">
            <form className="space-y-6" onSubmit={handleCredentialsLogin}>
              {/* Email */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" />
                  Email
                </div>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-400 transition-all duration-300 text-gray-800"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    disabled={submitting}
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-500" />
                  Senha
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-3 focus:ring-green-100 focus:border-green-400 transition-all duration-300 text-gray-800 pr-12"
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    disabled={submitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    disabled={submitting}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Esqueci a senha */}
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm font-medium bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent hover:from-blue-700 hover:to-green-600 transition-all duration-300"
                  onClick={() => router.push('/forgot-password')}
                >
                  Esqueci minha senha
                </button>
              </div>

              {/* Erro */}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                  {error}
                </div>
              )}

              {/* Botão Entrar (Nest) */}
              <button
                type="submit"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                disabled={submitting}
                className={`w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-green-500 text-white font-semibold rounded-2xl transition-all duration-500 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-200 flex items-center justify-center gap-3 ${
                  isHovered ? 'from-blue-700 to-green-600' : ''
                } ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <span>{submitting ? 'Entrando...' : 'Entrar'}</span>
                <ArrowRight className={`w-5 h-5 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
              </button>
            </form>

            {/* Divisor */}
            <div className="flex items-center my-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
              <span className="px-4 text-sm text-gray-400 font-medium">ou</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
            </div>

            {/* Social */}
            <div className="space-y-3">
              {/* Google */}
              <button
                onClick={handleGoogleLogin}
                disabled
                className="w-full py-4 px-6 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 group disabled:opacity-70"
              >
                <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-yellow-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">G</span>
                </div>
                <span className="text-gray-700 font-medium">Continuar com Google</span>
              </button>

              {/* Facebook (desabilitado, pois não é um provider configurado) */}
              <button
                disabled
                className="w-full py-4 px-6 bg-gray-50 border border-gray-200 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 group opacity-50 cursor-not-allowed"
                title="Indisponível"
              >
                <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">f</span>
                </div>
                <span className="text-gray-700 font-medium">Continuar com Facebook</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-gray-600">
              Não tem uma conta?{' '}
              <button
                onClick={() => router.push('/signup')}
                className="font-semibold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent hover:from-blue-700 hover:to-green-600 transition-all duration-300"
              >
                Criar conta
              </button>
            </p>
          </div>

          {/* Badge */}
          <div className="flex items-center justify-center mt-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-blue-50 border border-green-100 rounded-full">
              <Sparkles className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-700">Login 100% Seguro</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
