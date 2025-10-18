export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-400 rounded-2xl flex items-center justify-center mr-4">
                  <span className="text-white text-xl">❤️</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                    Amigos de Minas
                  </h3>
                  <p className="text-sm text-gray-500">Transformando vidas desde 2001</p>
                </div>
              </div>
              
              <p className="text-gray-600 leading-relaxed mb-6 max-w-md">
                Conectando corações através do apadrinhamento de crianças e construindo lares 
                de esperança no norte de Minas Gerais.
              </p>
              
              <div className="flex space-x-4">
                <a href="#" className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white hover:shadow-lg transition-all duration-300 transform hover:scale-110">
                  <span className="text-sm font-bold">f</span>
                </a>
                <a href="#" className="w-10 h-10 bg-gradient-to-r from-pink-500 to-red-500 rounded-xl flex items-center justify-center text-white hover:shadow-lg transition-all duration-300 transform hover:scale-110">
                  <span className="text-sm font-bold">ig</span>
                </a>
                <a href="#" className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white hover:shadow-lg transition-all duration-300 transform hover:scale-110">
                  <span className="text-sm font-bold">wa</span>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-6">Links Rápidos</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors duration-300 flex items-center">
                  <span className="w-1 h-1 bg-blue-400 rounded-full mr-3"></span>
                  Sobre Nós
                </a></li>
                <li><a href="#" className="text-gray-600 hover:text-green-600 transition-colors duration-300 flex items-center">
                  <span className="w-1 h-1 bg-green-400 rounded-full mr-3"></span>
                  Nossos Projetos
                </a></li>
                <li><a href="#" className="text-gray-600 hover:text-yellow-600 transition-colors duration-300 flex items-center">
                  <span className="w-1 h-1 bg-yellow-400 rounded-full mr-3"></span>
                  Como Ajudar
                </a></li>
                <li><a href="#" className="text-gray-600 hover:text-red-600 transition-colors duration-300 flex items-center">
                  <span className="w-1 h-1 bg-red-400 rounded-full mr-3"></span>
                  Transparência
                </a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-6">Contato</h4>
              <ul className="space-y-3">
                <li className="flex items-center text-gray-600">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                  ongamigosdeminas@gmail.com
                </li>
                <li className="flex items-center text-gray-600">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                  (31) 99549-2237
                </li>
                <li className="flex items-center text-gray-600">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                  Belo Horizonte
                </li>
              </ul>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl">
                <p className="text-sm text-gray-600 mb-2">Receba nossas novidades</p>
                <div className="flex">
                  <input 
                    type="email" 
                    placeholder="Seu email" 
                    className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-l-xl focus:outline-none focus:border-blue-300"
                  />
                  <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-green-400 text-white text-sm font-semibold rounded-r-xl hover:shadow-lg transition-all duration-300">
                    ✓
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-100 mt-12 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-500 text-sm mb-4 md:mb-0">
                &copy; 2024 ONG Amigos de Minas. Feito com ❤️ para transformar vidas.
              </p>
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <a href="#" className="hover:text-blue-600 transition-colors">Política de Privacidade</a>
                <a href="#" className="hover:text-green-600 transition-colors">Termos de Uso</a>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  <span>Site seguro</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}