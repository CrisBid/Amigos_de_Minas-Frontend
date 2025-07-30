export default function About() {
  return (
    <section className="py-20 bg-white relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-green-100 to-blue-100 rounded-full opacity-30 -translate-y-36 translate-x-36"></div>
      
      <div className="container mx-auto px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-gradient-to-r from-blue-50 to-green-50 px-6 py-3 rounded-full mb-6">
              <span className="text-sm font-medium bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                ✨ Nossa Essência
              </span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                Amor que Transforma
              </span>
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Somos uma família que escolheu estender suas mãos para alcançar outras famílias, 
              criando laços de amor e esperança que transcendem distâncias.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group text-center p-8 rounded-3xl bg-white border border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-r from-red-400 to-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">❤️</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Amor Incondicional</h3>
              <p className="text-gray-600 leading-relaxed">
                Cada criança apadrinhada recebe não apenas presentes, mas carinho genuíno e acompanhamento dedicado.
              </p>
            </div>
            
            <div className="group text-center p-8 rounded-3xl bg-white border border-gray-100 hover:border-green-200 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-green-400 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Conexão Verdadeira</h3>
              <p className="text-gray-600 leading-relaxed">
                Construímos pontes entre padrinhos e crianças, criando relacionamentos duradouros e significativos.
              </p>
            </div>
            
            <div className="group text-center p-8 rounded-3xl bg-white border border-gray-100 hover:border-yellow-200 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🌟</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Futuro Brilhante</h3>
              <p className="text-gray-600 leading-relaxed">
                Através da educação e do apoio contínuo, plantamos sementes de esperança para um amanhã melhor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}