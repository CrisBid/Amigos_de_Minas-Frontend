'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  User, Mail, Phone, MapPin, Heart, CheckCircle, Baby, Lock
} from 'lucide-react';

type FormData = {
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  cep: string;
  profissao: string;
  renda: string;
  estadoCivil: string;
  password: string;
  confirmPassword: string;
};

const estadosCivis = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
const faixasRenda = ['Até R$ 2.000', 'R$ 2.001 - R$ 4.000', 'R$ 4.001 - R$ 6.000', 'R$ 6.001 - R$ 10.000', 'Acima de R$ 10.000'];

export default function CadastroApadrinhamento() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
    cidade: '',
    cep: '',
    profissao: '',
    renda: '',
    estadoCivil: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = process.env.NEXT_PUBLIC_NEST_API_URL; // ex.: http://localhost:3001

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  // Máscaras leves de UX (não são validação real)
  function formatPhone(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
    }
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
  }
  function formatCep(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 8);
    return digits.replace(/(\d{5})(\d{0,3})/, '$1-$2').trim();
  }

  function onPhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData(prev => ({ ...prev, telefone: formatPhone(e.target.value) }));
  }
  function onCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData(prev => ({ ...prev, cep: formatCep(e.target.value) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!api) {
      setError('Configuração ausente: defina NEXT_PUBLIC_NEST_API_URL.');
      return;
    }
    if (!formData.nome || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Preencha nome, e-mail e senha.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (formData.password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      // 1) REGISTRA no Nest
      const res = await fetch(`${api}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // O backend atual exige apenas name/email/password; os demais campos
        // podem ser salvos depois em um perfil (ver notas ao final).
        body: JSON.stringify({
          name: formData.nome,
          email: formData.email,
          password: formData.password,
          // opcional: roles: ['SPONSOR']
        }),
      });

      if (!res.ok) {
        const msg = await safeErrMsg(res);
        throw new Error(msg || 'Falha ao registrar. Verifique os dados.');
      }

      // 2) LOGIN automático via NextAuth (credentials)
      const login = await signIn('credentials', {
        redirect: false,
        email: formData.email,
        password: formData.password,
        callbackUrl: '/',
      });

      if (login?.error) {
        // Se por algum motivo não logar, mostra tela de sucesso básica
        // e deixa o usuário fazer login manualmente
        setSubmitted(true);
        setSubmitting(false);
        return;
      }

      // 3) Redireciona logado
      router.push(login?.url || '/');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao cadastrar.');
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-100 to-green-100 rounded-full opacity-50"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-yellow-100 to-red-100 rounded-full opacity-50"></div>
        </div>
        
        <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-gray-100">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-2">
              Cadastro Realizado!
            </h2>
            <p className="text-gray-600 mb-4">
              Obrigado por querer apadrinhar uma criança pelos <span className="font-semibold text-blue-600">Amigos de Minas</span>!
            </p>
            <p className="text-sm text-gray-500">
              Agora é só acessar sua conta com o e-mail e senha cadastrados.
            </p>
          </div>
          
          <button 
            onClick={() => {
              setSubmitted(false);
              setFormData({
                nome: '', email: '', telefone: '', endereco: '', cidade: '', 
                cep: '', profissao: '', renda: '', estadoCivil: '', password: '', confirmPassword: ''
              });
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-green-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          >
            Novo Cadastro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* BG */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-100 to-green-100 rounded-full opacity-30"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-yellow-100 to-red-100 rounded-full opacity-30"></div>
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-gradient-to-br from-green-200 to-blue-200 rounded-full opacity-20"></div>
        <div className="absolute top-1/4 right-1/3 w-24 h-24 bg-gradient-to-br from-yellow-200 to-red-200 rounded-full opacity-15"></div>
      </div>

      <div className="relative max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-green-400 rounded-full mb-4 shadow-lg">
            <Baby className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-2">
            Amigos de Minas
          </h1>
          <p className="text-gray-600 text-lg mb-2">Programa de Apadrinhamento</p>
          <div className="inline-flex items-center bg-gradient-to-r from-yellow-100 to-red-100 px-4 py-2 rounded-full">
            <Heart className="w-4 h-4 text-red-500 mr-2" />
            <span className="text-sm font-semibold text-gray-700">Transforme uma vida, apadrinhe uma criança</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to.green-500 bg-clip-text text-transparent mb-8">
              Cadastro para Apadrinhamento
            </h2>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                {error}
              </div>
            )}
            
            {/* Dados Pessoais */}
            <div className="grid md:grid-cols-2 gap-6">
              <Field
                label="Nome Completo"
                name="nome"
                icon={<User className="w-4 h-4 mr-2 text-blue-500" />}
                value={formData.nome}
                onChange={handleInputChange}
                placeholder="Digite seu nome completo"
                required
              />
              <Field
                type="email"
                label="E-mail"
                name="email"
                icon={<Mail className="w-4 h-4 mr-2 text-green-500" />}
                value={formData.email}
                onChange={handleInputChange}
                placeholder="seu@email.com"
                required
              />
              <Field
                label="Telefone"
                name="telefone"
                icon={<Phone className="w-4 h-4 mr-2 text-yellow-500" />}
                value={formData.telefone}
                onChange={onPhoneChange}
                placeholder="(31) 99999-9999"
                required
              />
              <Field
                label="CEP"
                name="cep"
                icon={<MapPin className="w-4 h-4 mr-2 text-red-500" />}
                value={formData.cep}
                onChange={onCepChange}
                placeholder="00000-000"
                required
              />
              <Field
                className="md:col-span-2"
                label="Endereço Completo"
                name="endereco"
                icon={<MapPin className="w-4 h-4 mr-2 text-purple-500" />}
                value={formData.endereco}
                onChange={handleInputChange}
                placeholder="Rua, número, bairro"
                required
              />
              <Field
                label="Cidade"
                name="cidade"
                icon={<MapPin className="w-4 h-4 mr-2 text-indigo-500" />}
                value={formData.cidade}
                onChange={handleInputChange}
                placeholder="Sua cidade"
                required
              />

              {/* Profissão / Renda / Estado civil */}
              <Field
                label="Profissão"
                name="profissao"
                icon={<User className="w-4 h-4 mr-2 text-blue-400" />}
                value={formData.profissao}
                onChange={handleInputChange}
                placeholder="Sua profissão"
              />
              <SelectField
                label="Faixa de renda"
                name="renda"
                value={formData.renda}
                onChange={handleInputChange}
                options={faixasRenda}
              />
              <SelectField
                label="Estado civil"
                name="estadoCivil"
                value={formData.estadoCivil}
                onChange={handleInputChange}
                options={estadosCivis}
              />

              {/* Senha */}
              <Field
                type="password"
                label="Senha"
                name="password"
                icon={<Lock className="w-4 h-4 mr-2 text-emerald-500" />}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Crie uma senha"
                required
              />
              <Field
                type="password"
                label="Confirmar senha"
                name="confirmPassword"
                icon={<Lock className="w-4 h-4 mr-2 text-emerald-500" />}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Repita a senha"
                required
              />
            </div>

            {/* Botão */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className={`w-full bg-gradient-to-r from-blue-600 to-green-500 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:from-blue-700 hover:to-green-600 ${
                  submitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {submitting ? 'Cadastrando...' : 'Finalizar Cadastro para Apadrinhamento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
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
}) {
  const { label, icon, className, ...rest } = props;
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <label className="flex items-center text-sm font-semibold text-gray-700">
        {icon}
        {label}
      </label>
      <input
        {...rest}
        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
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
}) {
  const { label, name, value, onChange, options } = props;
  return (
    <div className="space-y-2">
      <label className="flex items-center text-sm font-semibold text-gray-700">
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300 bg-white"
      >
        <option value="">Selecione...</option>
        {options.map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
    </div>
  );
}

async function safeErrMsg(res: Response) {
  try {
    const data = await res.json();
    return data?.message || data?.error || res.statusText;
  } catch {
    return res.statusText;
  }
}
