export default function Contact() {
  return (
    <section className="py-20 bg-gray-50 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-green-100 to-blue-100 rounded-full opacity-20 translate-x-40 -translate-y-40"></div>
      
      <div className="container mx-auto px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-white px-6 py-3 rounded-full shadow-sm mb-6">
              <span className="text-sm font-medium bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                🤝 Junte-se a Nós
              </span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                Seja Parte da Mudança
              </span>
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Sua participação, seja através do apadrinhamento, doação ou divulgação, 
              multiplica nossa capacidade de transformar vidas.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Ways to Help */}
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-8">Como Você Pode Ajudar</h3>
              <div className="space-y-6">
                <div className="group flex items-start space-x-4 p-6 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
                  <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-green-400 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <span className="text-white text-xl">🎁</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-800 mb-2">Apadrinhe uma Criança</h4>
                    <p className="text-gray-600">Torne-se padrinho/madrinha e transforme a vida de uma criança com presentes, carinho e acompanhamento.</p>
                    <div className="mt-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Mais procurado
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="group flex items-start space-x-4 p-6 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
                  <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-blue-400 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <span className="text-white text-xl">🏠</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-800 mb-2">Projeto Casa da Esperança</h4>
                    <p className="text-gray-600">Contribua para a construção anual de uma casa para uma família em extrema necessidade.</p>
                    <div className="mt-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Alto impacto
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="group flex items-start space-x-4 p-6 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
                  <div className="w-14 h-14 bg-gradient-to-r from-yellow-400 to-red-400 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <span className="text-white text-xl">💰</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-800 mb-2">Doações Gerais</h4>
                    <p className="text-gray-600">Qualquer quantia ajuda a manter nossos projetos funcionando e alcançar mais famílias necessitadas.</p>
                    <div className="mt-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        Flexível
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Contact Info */}
            <div>
              <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100 to-green-100 rounded-full opacity-50 translate-x-16 -translate-y-16"></div>
                
                <div className="relative">
                  <h3 className="text-2xl font-bold text-gray-800 mb-8">Fale Conosco</h3>
                  
                  <div className="space-y-6 mb-8">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-400 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Email</div>
                        <div className="font-semibold text-gray-800">contato@amigosminas.org</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-400 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">WhatsApp</div>
                        <div className="font-semibold text-gray-800">(38) 99999-9999</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-red-400 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Localização</div>
                        <div className="font-semibold text-gray-800">Norte de Minas Gerais</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <button className="w-full bg-gradient-to-r from-blue-600 to-green-500 text-white py-4 px-6 rounded-2xl font-semibold text-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                      🎁 Quero Apadrinhar uma Criança
                    </button>
                    <button className="w-full bg-white text-gray-700 border-2 border-gray-200 py-3 px-6 rounded-2xl font-semibold hover:border-green-300 hover:shadow-lg transition-all duration-300">
                      🏠 Contribuir com Casa da Esperança
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}