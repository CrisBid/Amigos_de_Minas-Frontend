export default function Impact() {
  const stats = [
    { 
      number: "1000+", 
      label: "Crianças Apadrinhadas", 
      icon: "👶",
      gradient: "from-blue-400 to-green-400",
      bgColor: "bg-blue-50"
    },
    { 
      number: "5", 
      label: "Casas Construídas", 
      icon: "🏠",
      gradient: "from-green-400 to-blue-400",
      bgColor: "bg-green-50"
    },
    { 
      number: "5", 
      label: "Anos Transformando", 
      icon: "📅",
      gradient: "from-yellow-400 to-red-400",
      bgColor: "bg-yellow-50"
    },
    { 
      number: "2000+", 
      label: "Famílias Beneficiadas", 
      icon: "👨‍👩‍👧‍👦",
      gradient: "from-red-400 to-yellow-400",
      bgColor: "bg-red-50"
    }
  ]

  return (
    <section className="py-20 bg-white relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-green-50 opacity-50"></div>
      
      <div className="container mx-auto px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-gradient-to-r from-green-100 to-blue-100 px-6 py-3 rounded-full mb-6">
              <span className="text-sm font-medium bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                📊 Nosso Impacto
              </span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Números que Inspiram
              </span>
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Cada número representa uma vida tocada, um sonho realizado, uma família transformada 
              através do amor e da dedicação.
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8 mb-16">
            {stats.map((stat, index) => (
              <div key={index} className={`group text-center p-8 rounded-3xl ${stat.bgColor} border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2`}>
                <div className={`w-20 h-20 bg-gradient-to-r ${stat.gradient} rounded-3xl flex items-center justify-center mx-auto mb-6 text-3xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  {stat.icon}
                </div>
                <div className={`text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                  {stat.number}
                </div>
                <div className="text-lg text-gray-600 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          
          {/* Testimonial */}
          <div className="text-center">
            <div className="bg-white rounded-3xl p-8 md:p-12 max-w-4xl mx-auto shadow-xl border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">💬</span>
              </div>
              <blockquote className="text-xl md:text-2xl text-gray-700 mb-6 leading-relaxed italic">
                "Graças aos Amigos de Minas, minha filha tem uma madrinha especial que a ama de verdade, 
                e nós ganhamos nossa casa própria. Hoje vivemos com dignidade e esperança no coração."
              </blockquote>
              <div className="flex items-center justify-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-green-400 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold text-lg">JC</span>
                </div>
                <div className="text-left">
                  <cite className="text-gray-800 font-semibold block">João Carlos</cite>
                  <span className="text-gray-500 text-sm">Pai beneficiário do projeto Casa da Esperança</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}