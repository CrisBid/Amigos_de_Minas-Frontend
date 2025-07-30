'use client'

import React, { useState } from 'react';
import { MapPin, Users, Heart, Award, Calendar, TrendingUp, Phone, Mail, Globe, ChevronDown } from 'lucide-react';

export default function BonitoDeMinasPage() {
  const [activeSection, setActiveSection] = useState(null);
  const [selectedCity, setSelectedCity] = useState("Bonito");
  
  const cidades = [
    "Bonito",
    "Itacarambi", 
    "Juvenília",
    "Manga",
    "São João Das Missões"
  ];

  const cityStats = [
    { icon: Users, label: "População", value: "~8.500", color: "from-blue-500 to-purple-500" },
    { icon: MapPin, label: "Região", value: "Norte de MG", color: "from-green-500 to-blue-500" },
    { icon: TrendingUp, label: "Economia", value: "Agropecuária", color: "from-yellow-500 to-orange-500" },
    { icon: Globe, label: "Área", value: "3.901 km²", color: "from-purple-500 to-pink-500" }
  ];

  const projectHighlights = [
    {
      icon: Heart,
      title: "Assistência Social",
      description: "Apoio às famílias em vulnerabilidade social com distribuição de cestas básicas e atendimento psicossocial.",
      color: "from-red-500 to-pink-500",
      bgColor: "bg-red-50"
    },
    {
      icon: Users,
      title: "Educação Comunitária",
      description: "Programas de alfabetização de adultos e reforço escolar para crianças e adolescentes.",
      color: "from-blue-500 to-indigo-500",
      bgColor: "bg-blue-50"
    },
    {
      icon: Award,
      title: "Capacitação Profissional",
      description: "Cursos de artesanato, informática básica e empreendedorismo para geração de renda.",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-50"
    },
    {
      icon: Calendar,
      title: "Eventos Culturais",
      description: "Organização de festivais e ações culturais que fortalecem a identidade local.",
      color: "from-yellow-500 to-amber-500",
      bgColor: "bg-yellow-50"
    }
  ];

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-green-400/20 rounded-full blur-3xl"></div>
      <div className="absolute top-60 right-20 w-40 h-40 bg-gradient-to-br from-yellow-400/20 to-orange-400/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 left-20 w-36 h-36 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl"></div>

      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-20">
          
          {/* Sub Header - Cities Navigation */}
          <div className="border-t border-gray-100 bg-white/90 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-600 font-medium">Nossas Cidades:</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {cidades.map((cidade, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedCity(cidade)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 ${
                        selectedCity === cidade
                          ? 'bg-gradient-to-r from-blue-600 to-green-500 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-800'
                      }`}
                    >
                      {cidade}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Mobile Cities Dropdown */}
              <div className="md:hidden mt-3">
                <div className="relative">
                  <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors duration-300">
                    <span className="font-medium">{selectedCity}</span>
                    <ChevronDown className="w-5 h-5" />
                  </button>
                  {/* Note: In a real implementation, you'd add dropdown functionality here */}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-yellow-100 to-orange-100 px-4 py-2 rounded-full mb-6">
              <MapPin className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-700 font-medium">{selectedCity} de Minas, MG</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                Transformando
              </span>
              <br />
              <span className="text-gray-800">Vidas no Sertão</span>
            </h1>
            
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
              Conheça como a ONG Amigos de Minas atua em {selectedCity} de Minas, uma cidade histórica 
              do Norte de Minas Gerais, levando esperança e oportunidades para comunidades em vulnerabilidade social.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-green-500 text-white rounded-2xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-300">
                Conheça Nossos Projetos
              </button>
              <button className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-2xl font-semibold hover:border-blue-300 hover:text-blue-600 transition-all duration-300">
                Saiba Como Ajudar
              </button>
            </div>
          </div>
        </section>

        {/* City Info Section */}
        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">
                <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                  {selectedCity} de Minas
                </span>
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Uma cidade com rica história e potencial imenso, situada no coração do sertão mineiro
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all duration-300">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">História e Localização</h3>
                  <p className="text-gray-600 leading-relaxed mb-4">
                    {selectedCity} de Minas está localizada na região Norte de Minas Gerais, fazendo divisa com a Bahia. 
                    A cidade possui uma rica história ligada à pecuária e agricultura, sendo um importante centro 
                    regional de desenvolvimento rural.
                  </p>
                  <p className="text-gray-600 leading-relaxed">
                    Com paisagens típicas do cerrado e caatinga, a cidade enfrenta desafios socioeconômicos comuns 
                    à região, mas possui grande potencial de crescimento sustentável.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {cityStats.map((stat, index) => (
                  <div key={index} className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                    <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-2xl font-bold text-gray-800 mb-1">{stat.value}</div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Características da Região</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2">Clima Semiárido</h4>
                  <p className="text-gray-600 text-sm">Região de transição entre cerrado e caatinga, com períodos de seca prolongados</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2">Economia Rural</h4>
                  <p className="text-gray-600 text-sm">Base econômica centrada na pecuária bovina e agricultura de subsistência</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2">Comunidade Forte</h4>
                  <p className="text-gray-600 text-sm">População acolhedora com fortes tradições culturais e vínculos familiares</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Project Section */}
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-100 to-green-100 px-4 py-2 rounded-full mb-6">
                <Heart className="w-5 h-5 text-blue-600" />
                <span className="text-blue-700 font-medium">Nosso Impacto</span>
              </div>
              
              <h2 className="text-4xl font-bold mb-6">
                <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                  Amigos de Minas
                </span>
                <br />
                <span className="text-gray-800">em {selectedCity} de Minas</span>
              </h2>
              
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Desde 2018, nossa ONG atua de forma contínua na cidade, desenvolvendo projetos que atendem 
                mais de 200 famílias em situação de vulnerabilidade social.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {projectHighlights.map((project, index) => (
                <div 
                  key={index}
                  className={`${project.bgColor} rounded-3xl p-8 hover:shadow-xl transition-all duration-300 cursor-pointer`}
                  onMouseEnter={() => setActiveSection(index)}
                  onMouseLeave={() => setActiveSection(null)}
                >
                  <div className={`w-16 h-16 bg-gradient-to-br ${project.color} rounded-2xl flex items-center justify-center mb-6 ${activeSection === index ? 'scale-110' : ''} transition-transform duration-300`}>
                    <project.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">{project.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{project.description}</p>
                  
                  <div className="mt-6 flex items-center text-sm font-medium">
                    <span className={`bg-gradient-to-r ${project.color} bg-clip-text text-transparent`}>
                      Saiba mais →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Impact Stats */}
            <div className="bg-gradient-to-r from-blue-600 to-green-500 rounded-3xl p-12 text-white text-center">
              <h3 className="text-3xl font-bold mb-8">Nossos Números em {selectedCity} de Minas</h3>
              <div className="grid md:grid-cols-4 gap-8">
                <div>
                  <div className="text-4xl font-bold mb-2">200+</div>
                  <div className="text-blue-100">Famílias Atendidas</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-2">150</div>
                  <div className="text-blue-100">Crianças no Projeto</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-2">6</div>
                  <div className="text-blue-100">Anos de Atuação</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-2">12</div>
                  <div className="text-blue-100">Voluntários Locais</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                Faça Parte da Transformação
              </span>
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Quer conhecer mais sobre nosso trabalho em {selectedCity} de Minas ou contribuir com nossos projetos?
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-green-500 text-white rounded-2xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-300">
                <Mail className="w-5 h-5" />
                <span>Entrar em Contato</span>
              </button>
              <button className="flex items-center justify-center space-x-2 px-8 py-4 bg-yellow-400 text-yellow-900 rounded-2xl font-semibold hover:bg-yellow-500 hover:scale-105 transition-all duration-300">
                <Heart className="w-5 h-5" />
                <span>Quero Ajudar</span>
              </button>
            </div>
          </div>
        </section>

        {/* Footer Badge */}
        <div className="fixed bottom-6 right-6 z-30">
          <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 hover:scale-105 transition-transform duration-300">
            <Award className="w-4 h-4" />
            <span className="text-sm font-medium">ONG Certificada</span>
          </div>
        </div>
      </div>
    </div>
  );
}