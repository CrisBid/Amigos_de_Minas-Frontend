export async function getChildren() {
  // Aqui futuramente você pode integrar com banco de dados ou API
  return [
    {
      id: 1,
      nome: 'Ana Clara',
      idade: 8,
      cidade: 'Montes Claros',
      categoria: 'Bonecas',
      foto: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=300&h=300&fit=crop&crop=face',
      apadrinhado: false,
      descricao: 'Ama brincar de casinha e desenhar'
    },
    // ...restante dos dados
  ];
}
