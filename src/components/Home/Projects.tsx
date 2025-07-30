export default function Projects() {
  const projects = [
    {
      title: "Apadrinhamento de Crianças",
      description: "Programa que conecta padrinhos e madrinhas com crianças do norte de Minas, proporcionando presentes, carinho e acompanhamento do desenvolvimento.",
      impact: "1000+ crianças apadrinhadas",
      gradient: "from-blue-500 via-blue-400 to-green-400",
      icon: "🎁",
      accentColor: "yellow"
    },
    {
      title: "Casa da Esperança",
      description: "Construção anual de uma moradia completa para uma família selecionada em situação de extrema vulnerabilidade no norte de Minas.",
      impact: "5 famílias com casa própria",
      gradient: "from-green-500 via-green-400 to-blue-400",
      icon: "🏠",
      accentColor: "red"
    },
  ]

  return (
    <section className="py-20 bg-gray-50 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-100 to-green-100 rounded-full opacity-20 -translate-x-48 translate-y-48"></div>
      
      <div className="container mx-auto px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-white px-6 py-3 rounded-full shadow-sm mb-6">
              <span className="text-sm font-medium bg-gradient-to-r from-green-600 to-blue-500 bg-clip-text text-transparent">
                🚀 Nossos Projetos
              </span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-green-600 to-blue-500 bg-clip-text text-transparent">
                Transformando Vidas
              </span>
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Cada projeto carrega nossa paixão por fazer a diferença, criando impacto real 
              e duradouro na vida das famílias do norte de Minas.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {projects.map((project, index) => (
              <div key={index} className="group relative">
                <div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-16 h-16 bg-gradient-to-r ${project.gradient} rounded-2xl flex items-center justify-center text-2xl shadow-lg`}>
                      {project.icon}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      project.accentColor === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                      project.accentColor === 'red' ? 'bg-red-100 text-red-700' :
                      project.accentColor === 'green' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      ATIVO
                    </div>
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">{project.title}</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">{project.description}</p>
                  
                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        project.accentColor === 'yellow' ? 'bg-yellow-400' :
                        project.accentColor === 'red' ? 'bg-red-400' :
                        project.accentColor === 'green' ? 'bg-green-400' :
                        'bg-blue-400'
                      }`}></div>
                      <span className="text-sm font-semibold text-gray-500">{project.impact}</span>
                    </div>
                    <button className={`px-6 py-2 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      project.accentColor === 'yellow' ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' :
                      project.accentColor === 'red' ? 'bg-red-50 text-red-700 hover:bg-red-100' :
                      project.accentColor === 'green' ? 'bg-green-50 text-green-700 hover:bg-green-100' :
                      'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}>
                      Participar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}