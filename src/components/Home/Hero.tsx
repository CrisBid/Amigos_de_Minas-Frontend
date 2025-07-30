import Image from 'next/image'

export default function Hero() {
  return (
    <section className="relative bg-white min-h-screen flex items-center overflow-hidden">
      {/* Background gradient circles */}
      <div className="absolute top-20 -right-20 w-96 h-96 bg-gradient-to-br from-blue-400 to-green-400 rounded-full opacity-10 blur-3xl"></div>
      <div className="absolute bottom-20 -left-20 w-80 h-80 bg-gradient-to-tr from-green-400 to-blue-400 rounded-full opacity-10 blur-3xl"></div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <div className="text-left">
              <div className="inline-flex items-center bg-gradient-to-r from-green-100 to-blue-100 px-4 py-2 rounded-full mb-6">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-gray-700">Transformando vidas desde 2019</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                <span className="bg-gradient-to-r from-blue-600 via-green-500 to-blue-600 bg-clip-text text-transparent">
                  Amigos de Minas
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl mb-8 text-gray-600 leading-relaxed">
                Conectando corações através do apadrinhamento de crianças e construindo lares no norte de Minas Gerais
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="group bg-gradient-to-r from-blue-600 to-green-500 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <span className="flex items-center justify-center">
                    🎁 Apadrinhar uma Criança
                  </span>
                </button>
                <button className="bg-white border-2 border-gray-200 text-gray-700 px-8 py-4 rounded-2xl font-semibold text-lg hover:border-blue-300 hover:shadow-lg transition-all duration-300">
                  <span className="flex items-center justify-center">
                    🏠 Casa da Esperança
                  </span>
                </button>
              </div>
              
              {/* Mini stats */}
              <div className="flex items-center gap-8 mt-8 pt-8 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">1000+</div>
                  <div className="text-sm text-gray-500">Crianças Apadrinhadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold bg-gradient-to-r from-green-500 to-blue-600 bg-clip-text text-transparent">5</div>
                  <div className="text-sm text-gray-500">Casas Construídas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">2000+</div>
                  <div className="text-sm text-gray-500">Famílias Impactadas</div>
                </div>
              </div>
            </div>
            
            {/* Visual */}
            <div className="relative">
              <div className="relative bg-gradient-to-br from-blue-50 to-green-50 rounded-3xl p-8 shadow-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-400 rounded-xl flex items-center justify-center text-white text-2xl mb-4">
                      👶
                    </div>
                    <div className="text-2xl font-bold text-gray-800">1000+</div>
                    <div className="text-sm text-gray-500">Apadrinhadas</div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-400 rounded-xl flex items-center justify-center text-white text-2xl mb-4">
                      🏠
                    </div>
                    <div className="text-2xl font-bold text-gray-800">5</div>
                    <div className="text-sm text-gray-500">Casas</div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-red-400 rounded-xl flex items-center justify-center text-white text-2xl mb-4">
                      ❤️
                    </div>
                    <div className="text-2xl font-bold text-gray-800">100%</div>
                    <div className="text-sm text-gray-500">Com Amor</div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-400 to-yellow-400 rounded-xl flex items-center justify-center text-white text-2xl mb-4">
                      🌟
                    </div>
                    <div className="text-2xl font-bold text-gray-800">∞</div>
                    <div className="text-sm text-gray-500">Esperança</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-8 h-12 border-2 border-gray-300 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-gradient-to-b from-blue-400 to-green-400 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  )
}