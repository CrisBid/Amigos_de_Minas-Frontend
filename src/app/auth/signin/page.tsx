'use client';

import { useState } from 'react';
import { User, Mail, Phone, MapPin, Heart, CheckCircle, Baby } from 'lucide-react';

export default function CadastroApadrinhamento() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
    cidade: '',
    cep: '',
    profissao: '',
    renda: '',
    estadoCivil: ''
  });

  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e:any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const estadosCivis = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
  const faixasRenda = ['Até R$ 2.000', 'R$ 2.001 - R$ 4.000', 'R$ 4.001 - R$ 6.000', 'R$ 6.001 - R$ 10.000', 'Acima de R$ 10.000'];

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
              Obrigado por querer apadrinhar uma criança através dos <span className="font-semibold text-blue-600">Amigos de Minas</span>!
            </p>
            <p className="text-sm text-gray-500">
              Em breve nossa equipe entrará em contato para dar continuidade ao processo de apadrinhamento.
            </p>
          </div>
          
          <button 
            onClick={() => {
              setSubmitted(false);
              setFormData({
                nome: '', email: '', telefone: '', endereco: '', cidade: '', 
                cep: '', profissao: '', renda: '', estadoCivil: ''
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
      {/* Background Decorativo */}
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

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-8">
              Cadastro para Apadrinhamento
            </h2>
            
            {/* Dados Pessoais */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <User className="w-4 h-4 mr-2 text-blue-500" />
                  Nome Completo
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  required
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                  placeholder="Digite seu nome completo"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <Mail className="w-4 h-4 mr-2 text-green-500" />
                  E-mail
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                  placeholder="seu@email.com"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <Phone className="w-4 h-4 mr-2 text-yellow-500" />
                  Telefone
                </label>
                <input
                  type="tel"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  required
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                  placeholder="(31) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <MapPin className="w-4 h-4 mr-2 text-red-500" />
                  CEP
                </label>
                <input
                  type="text"
                  name="cep"
                  value={formData.cep}
                  onChange={handleInputChange}
                  required
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                  placeholder="00000-000"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <MapPin className="w-4 h-4 mr-2 text-purple-500" />
                  Endereço Completo
                </label>
                <input
                  type="text"
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleInputChange}
                  required
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                  placeholder="Rua, número, bairro"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <MapPin className="w-4 h-4 mr-2 text-indigo-500" />
                  Cidade
                </label>
                <input
                  type="text"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleInputChange}
                  required
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                  placeholder="Sua cidade"
                />
              </div>

                {/* 
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Profissão
                </label>
                <input
                  type="text"
                  name="profissao"
                  value={formData.profissao}
                  onChange={handleInputChange}
                  required
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                  placeholder="Sua profissão"
                />
              </div>

              */}

            </div>

            {/* Informações Adicionais */}

            {/* 
            <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700">
                  Estado Civil
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {estadosCivis.map((estado) => (
                    <label key={estado} className="cursor-pointer">
                      <input
                        type="radio"
                        name="estadoCivil"
                        value={estado}
                        checked={formData.estadoCivil === estado}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-xl border-2 text-center text-xs font-medium transition-all duration-300 ${
                        formData.estadoCivil === estado
                          ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-green-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}>
                        {estado}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700">
                  Faixa de Renda Familiar
                </label>
                <div className="space-y-2">
                  {faixasRenda.map((faixa) => (
                    <label key={faixa} className="cursor-pointer flex items-center">
                      <input
                        type="radio"
                        name="renda"
                        value={faixa}
                        checked={formData.renda === faixa}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className={`flex-1 p-3 rounded-xl border-2 text-center text-sm font-medium transition-all duration-300 ${
                        formData.renda === faixa
                          ? 'border-green-500 bg-gradient-to-r from-green-50 to-blue-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}>
                        {faixa}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            */}

            {/* Informações sobre o programa */

            /*
            <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-xl border border-blue-100 mt-8">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <Heart className="w-5 h-5 text-red-500 mr-2" />
                Sobre o Programa de Apadrinhamento
              </h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>• Contribuição mensal para necessidades básicas da criança</p>
                <p>• Acompanhamento do desenvolvimento educacional</p>
                <p>• Relatórios periódicos sobre o progresso</p>
                <p>• Possibilidade de visitas programadas</p>
              </div>
            </div>

            */}

            {/* Submit Button */}
            <div className="pt-6">
              <button
                onClick={handleSubmit}
                className="w-full bg-gradient-to-r from-blue-600 to-green-500 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:from-blue-700 hover:to-green-600"
              >
                Finalizar Cadastro para Apadrinhamento
              </button>
              <p className="text-xs text-gray-500 text-center mt-3">
                {/*Após o cadastro, nossa equipe entrará em contato em até 48 horas.*/}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}