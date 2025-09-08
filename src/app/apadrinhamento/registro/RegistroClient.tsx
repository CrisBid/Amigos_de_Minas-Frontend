'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn, getSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  Shield,
  Copy,
  Check
} from 'lucide-react';

type MainStep = 1 | 2 | 3 | 4;
type RegSubStep = 'credentials' | 'profile';
type DonationMethod = 'ponto' | 'dinheiro' | '';

type Props = {
  initialChildId: string;
  initialCampaignId: string;
};

export default function RegistroClient({ initialChildId, initialCampaignId }: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const api = process.env.NEXT_PUBLIC_NEST_API_URL;
  const childId = initialChildId || '';
  const campaignId = initialCampaignId || '';

  // token vindo da sessão + fallback local após o login
  const sessionToken = useMemo(
    () => (session as unknown as { accessToken?: string } | null)?.accessToken,
    [session]
  );
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);

  // Wizard state
  const [mainStep, setMainStep] = useState<MainStep>(1);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [regStep, setRegStep] = useState<RegSubStep>('credentials');
  const [donationMethod, setDonationMethod] = useState<DonationMethod>('');

  // Forms
  const [login, setLogin] = useState({ email: '', password: '' });
  const [signup, setSignup] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [profile, setProfile] = useState({ address: '', city: '', profession: '' });

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // ENV de instruções
  const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || '';
  const PIX_FAV = process.env.NEXT_PUBLIC_PIX_FAVORECIDO || 'ONG Amigos de Minas';
  const PIX_CNPJ = process.env.NEXT_PUBLIC_PIX_CNPJ || '';
  const PIX_OBS  = process.env.NEXT_PUBLIC_PIX_OBS || 'Apadrinhamento';
  const DROP_IMG = process.env.NEXT_PUBLIC_DROPPOINTS_IMAGE || '/images/pontos-coleta.png';

  // UX copiar
  const [copied, setCopied] = useState(false);

  // token pós-login
  useEffect(() => {
    (async () => {
      const s = await getSession();
      const t = (s as unknown as { accessToken?: string } | null)?.accessToken;
      if (t) setAuthToken(t);
    })();
  }, [status]);

  /* ----------------- Ações ----------------- */

  async function doLogin() {
    setErr(null);
    try {
      setLoading(true);
      const res = await signIn('credentials', {
        email: login.email,
        password: login.password,
        redirect: false,
      });
      if (res?.error) throw new Error(res.error);
      const s = await getSession();
      setAuthToken((s as unknown as { accessToken?: string } | null)?.accessToken);
      setMainStep(3);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha no login.';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function doRegisterCredentials() {
    if (!api) { setErr('NEXT_PUBLIC_NEST_API_URL ausente.'); return; }
    if (!signup.email || !signup.password || !signup.confirm) {
      setErr('Preencha e confirme a senha.'); return;
    }
    if (signup.password !== signup.confirm) {
      setErr('As senhas não conferem.'); return;
    }
    setErr(null);
    try {
      setLoading(true);
      // 1) cria a conta
      const r = await fetch(`${api}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signup.name || undefined,
          email: signup.email,
          phone: signup.phone,
          password: signup.password,
        }),
      });
      if (!r.ok) throw new Error(await safeErrMsg(r));

      // 2) login automático (sem redirecionar)
      const s = await signIn('credentials', {
        email: signup.email,
        password: signup.password,
        redirect: false,
      });
      if (s?.error) throw new Error(s.error);

      // 3) atualizar token e seguir para os dados pessoais
      const sess = await getSession();
      setAuthToken((sess as unknown as { accessToken?: string } | null)?.accessToken);
      setRegStep('profile'); // continua na Etapa 2
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível criar sua conta.';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfileAndContinue() {
    const token = authToken || sessionToken;
    if (!api) { setErr('NEXT_PUBLIC_NEST_API_URL ausente.'); return; }
    if (!token) { setErr('Sessão inválida após cadastro.'); return; }
    setErr(null);
    try {
      setLoading(true);
      const r = await fetch(`${api}/profiles/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          address: profile.address,
          city: profile.city,
          profession: profile.profession,
        }),
      });
      if (!r.ok) throw new Error(await safeErrMsg(r));
      setMainStep(3);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível salvar seus dados.';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function finishSponsorship() {
    const token = authToken || sessionToken;
    if (!api) { setErr('NEXT_PUBLIC_NEST_API_URL ausente.'); return; }
    if (!token) { setErr('Faça login para concluir.'); return; }
    if (!donationMethod) { setErr('Escolha a forma de doação.'); return; }

    setErr(null);
    try {
      setLoading(true);

      // Mapeia para o que o backend espera (igual ConcluirClient)
      const deliveryMethod = donationMethod === 'ponto' ? 'DROP_OFF' : 'PIX';

      const r = await fetch(`${api}/sponsorships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ childId, campaignId, deliveryMethod }),
      });
      if (!r.ok) throw new Error(await safeErrMsg(r));
      setDone(true);
      setMainStep(4);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível concluir o apadrinhamento.';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  /* ----------------- UI helpers ----------------- */

  const StepBadge = ({ n, active, children }: { n: number; active: boolean; children: React.ReactNode }) => (
    <div className={`px-3 py-1 rounded-full text-sm ${active ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
      {n}. {children}
    </div>
  );

  function BackButton({ onClick }: { onClick: () => void }) {
    return (
      <button onClick={onClick} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
    );
  }

  function PixInstructions() {
    return (
      <div className="space-y-3">
        <p className="text-emerald-800">
          Obrigado por apadrinhar! 💚 Para realizar a contribuição via <b>PIX</b>, use os dados abaixo:
        </p>

        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <div className="text-sm text-gray-700 space-y-2">
            <div><b>Chave PIX:</b> <span className="select-all">{PIX_KEY || '—'}</span></div>
            <div><b>Favorecido:</b> {PIX_FAV}</div>
            {PIX_CNPJ && <div><b>CNPJ:</b> {PIX_CNPJ}</div>}
            {PIX_OBS && <div><b>Observação:</b> {PIX_OBS}</div>}
            <div className="text-xs text-gray-500">
              Informe no comprovante: “Campanha {campaignId} — Criança {childId}”.
            </div>
          </div>

          <div className="mt-3">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(PIX_KEY);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 inline-flex items-center gap-2 disabled:opacity-70"
              disabled={!PIX_KEY}
              title={PIX_KEY ? 'Copiar chave PIX' : 'Nenhuma chave configurada'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar chave'}
            </button>
          </div>
        </div>

        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>Guarde o comprovante. Se necessário, nossa equipe poderá solicitar.</li>
          <li>O presente será providenciado pela ONG conforme a campanha.</li>
        </ul>
      </div>
    );
  }

  function DropOffInstructions() {
    return (
      <div className="space-y-3">
        <p className="text-emerald-800">
          Obrigado por apadrinhar! 💚 Você escolheu <b>entregar o presente em um ponto de coleta</b>.
        </p>

        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            <li>Embale o presente com cuidado.</li>
            <li>
              Identifique o pacote com: <b>Campanha {campaignId}</b> e <b>Criança {childId}</b>.
            </li>
            <li>Entregue em um dos pontos de coleta abaixo.</li>
          </ul>

          <div className="mt-4">
            <img
              src={DROP_IMG}
              alt="Pontos de coleta"
              className="w-full rounded-lg border border-emerald-100"
            />
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Dúvidas? Fale com a equipe pelo WhatsApp da ONG. ✨
        </p>
      </div>
    );
  }

  /* ----------------- Render ----------------- */

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-green-500 text-white flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold text-[#253243]">Apadrinhar — cadastro rápido</h1>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap gap-2 mb-6">
        <StepBadge n={1} active={mainStep === 1}>Você já tem conta?</StepBadge>
        <StepBadge n={2} active={mainStep === 2}>Acesso / Cadastro</StepBadge>
        <StepBadge n={3} active={mainStep === 3}>Forma de doação</StepBadge>
        <StepBadge n={4} active={mainStep === 4}>Confirmação</StepBadge>
      </div>

      {err && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
          <AlertCircle className="w-4 h-4" /> {err}
        </div>
      )}

      {/* Etapa 1 */}
      {mainStep === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-sm text-gray-700">
            Para continuar, diga pra gente se você já possui uma conta nos Amigos de Minas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              className={`flex-1 px-4 py-3 rounded-lg border ${hasAccount === true ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
              onClick={() => { setHasAccount(true); setMainStep(2); }}
            >
              Já tenho conta
            </button>
            <button
              className={`flex-1 px-4 py-3 rounded-lg border ${hasAccount === false ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
              onClick={() => { setHasAccount(false); setMainStep(2); setRegStep('credentials'); }}
            >
              Não tenho conta
            </button>
          </div>
        </div>
      )}

      {/* Etapa 2: Login OU Sub-wizard de cadastro */}
      {mainStep === 2 && hasAccount === true && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <BackButton onClick={() => setMainStep(1)} />
          <h2 className="text-lg font-semibold text-[#253243]">Entrar na sua conta</h2>

          <div className="grid gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">E-mail</label>
              <input
                type="email"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                value={login.email}
                onChange={e => setLogin({ ...login, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Senha</label>
              <input
                type="password"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                value={login.password}
                onChange={e => setLogin({ ...login, password: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={doLogin}
                disabled={loading}
                className="px-4 py-2 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F] inline-flex items-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Entrar e continuar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {mainStep === 2 && hasAccount === false && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-6">
          <BackButton onClick={() => setMainStep(1)} />
          <h2 className="text-lg font-semibold text-[#253243]">Criar conta</h2>

          {/* Sub-stepper */}
          <div className="flex gap-2 text-sm">
            <span className={`px-2 py-1 rounded ${regStep === 'credentials' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>1. Acesso</span>
            <span className={`px-2 py-1 rounded ${regStep === 'profile' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>2. Dados pessoais</span>
          </div>

          {regStep === 'credentials' && (
            <div className="grid gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Nome (opcional)</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  value={signup.name}
                  onChange={e => setSignup({ ...signup, name: e.target.value })}
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">E-mail</label>
                <input
                  type="email"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  value={signup.email}
                  onChange={e => setSignup({ ...signup, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Telefone</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  value={signup.phone}
                  onChange={e => setSignup({ ...signup, phone: e.target.value })}
                  placeholder="(31) 9 9999-9999"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Senha</label>
                  <input
                    type="password"
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    value={signup.password}
                    onChange={e => setSignup({ ...signup, password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Confirmar senha</label>
                  <input
                    type="password"
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    value={signup.confirm}
                    onChange={e => setSignup({ ...signup, confirm: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={doRegisterCredentials}
                  disabled={loading}
                  className="px-4 py-2 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F] inline-flex items-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Criar conta <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {regStep === 'profile' && (
            <div className="grid gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Endereço</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  value={profile.address}
                  onChange={e => setProfile({ ...profile, address: e.target.value })}
                  placeholder="Rua, número, bairro"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Cidade</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  value={profile.city}
                  onChange={e => setProfile({ ...profile, city: e.target.value })}
                  placeholder="Sua cidade"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRegStep('credentials')}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>

                <button
                  onClick={saveProfileAndContinue}
                  disabled={loading}
                  className="px-4 py-2 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F] inline-flex items-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Salvar e continuar <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Etapa 3: Forma de doação */}
      {mainStep === 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <BackButton
            onClick={() => {
              if (hasAccount) setMainStep(2);
              else {
                setMainStep(2);
                setRegStep('profile');
              }
            }}
          />

          <h2 className="text-lg font-semibold text-[#253243]">Como você prefere doar?</h2>

          <div className="grid gap-3">
            <label
              className={`border rounded-lg p-3 cursor-pointer ${
                donationMethod === 'ponto' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              <input
                type="radio"
                className="mr-2"
                checked={donationMethod === 'ponto'}
                onChange={() => setDonationMethod('ponto')}
              />
              Entregar no ponto de coleta
              <p className="text-xs text-gray-500 mt-1">
                Você levará o presente até um dos pontos de coleta da campanha.
              </p>
            </label>

            <label
              className={`border rounded-lg p-3 cursor-pointer ${
                donationMethod === 'dinheiro' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              <input
                type="radio"
                className="mr-2"
                checked={donationMethod === 'dinheiro'}
                onChange={() => setDonationMethod('dinheiro')}
              />
              Doar em dinheiro (PIX)
              <p className="text-xs text-gray-500 mt-1">
                Você fará uma doação via PIX para que a equipe providencie o presente.
              </p>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={finishSponsorship}
              disabled={loading || !donationMethod}
              className="px-4 py-2 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F] inline-flex items-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Concluir apadrinhamento
            </button>
          </div>
        </div>
      )}

      {/* Etapa 4: Confirmação (com instruções detalhadas) */}
      {mainStep === 4 && done && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <CheckCircle className="w-5 h-5" /> Apadrinhamento concluído!
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-700">
            <div><b>Campanha:</b> {campaignId}</div>
            <div><b>Criança:</b> {childId}</div>
          </div>

          {donationMethod === 'dinheiro' ? <PixInstructions /> : <DropOffInstructions />}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => router.push('/meus-apadrinhamentos')}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Ver meus apadrinhamentos
            </button>
            <button
              onClick={() => router.push('/apadrinhamento')}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Voltar à lista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* utils */
async function safeErrMsg(res: Response) {
  try {
    const d = await res.json();
    return (d as { message?: string; error?: string })?.message || (d as any)?.error || res.statusText;
  } catch {
    return res.statusText;
  }
}
