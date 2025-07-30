'use client';

import React, { useEffect, useState } from 'react';
import Stats from '@/components/Apadrinhamento/Stats';
import AddChildForm from '@/components/Apadrinhamento/AddChildForm';
import ChildCard from '@/components/Apadrinhamento/ChildCard';
import { Plus, Filter, Search } from 'lucide-react';
import { getChildren } from '@/lib/data';

interface Child {
  id: number;
  nome: string;
  idade: number;
  cidade: string;
  comunidade: string;
  escola: string;
  categoria: string;
  descricao: string;
  apadrinhado: boolean;
  foto: string;
}

interface Props {
  initialChildren?: Child[];
}

const cidades = [
  "Bonito",
  "Itacarambi",
  "Juvenília",
  "Manga",
  "São João Das Missões"
];
const categorias = [
  "Boneca",
  "Barbie",
  "Pelúcia",
  "Bebê",
  "Kit Cozinha",
  "Maquiagem",
  "Sandalia",
  "Maleta De Médico",
  "Kit Miçangas",
  "Boneco Super Herói",
  "Carrinho",
  "Caminhão",
  "Carreta",
  "Dinossauro",
  "Ônibus",
  "Trator",
  "Bola",
  "Pipa",
  "Jogo",
  "Tênis",
  "Roupas",
  "Brinquedos Bebê",
  "Fraldas",
  "Leite",
  "Cesta De Doces",
  "Material Escolar"
];

const faixasEtarias = ['0-3 anos', '4-6 anos', '7-9 anos', '10-12 anos', '13+ anos'];
const escolar = ["Escola Galho de São Domingos","Escola Francisco Borges-Larga","Escola Municipal TV Croá","Escola Municipal TV Japão","Escola Francisco Borges- Agua Doce","Lourenço Alves- Almescla/Catulé /Lorão","Escola Sumidoro-Barra da Ema","Escola Sumidoro-Cajueiro"]

export default function ClientSideApadrinhamento({ initialChildren = [] }: Props) {
  const [children, setChildren] = useState<Child[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filtros, setFiltros] = useState({
    cidade: '',
    escola: '',
    categoria: '',
    idade: '',
    apadrinhado: ''
  });

  useEffect(() => {
    getChildren().then(setChildren);
  }, []);

  const handleAddChild = (childData: Omit<Child, 'id' | 'apadrinhado' | 'foto'>) => {
    const newChild: Child = {
      id: children.length + 1,
      ...childData,
      idade: parseInt(childData.idade.toString()),
      apadrinhado: false,
      foto: `https://picsum.photos/300?random=${Date.now()}`
    };
    setChildren(prev => [...prev, newChild]);
    setShowForm(false);
  };

  const toggleApadrinhamento = (id: number) => {
    setChildren(prev =>
      prev.map(child =>
        child.id === id ? { ...child, apadrinhado: !child.apadrinhado } : child
      )
    );
  };

  const stats = {
    total: children.length,
    apadrinhadas: children.filter(c => c.apadrinhado).length,
    disponiveis: children.filter(c => !c.apadrinhado).length
  };

  const childrenFiltradas = children.filter(child => {
    const matchesSearch = child.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCidade = !filtros.cidade || child.cidade === filtros.cidade;
    const matchesEscola = !filtros.escola || child.escola === filtros.escola;
    const matchesCategoria = !filtros.categoria || child.categoria === filtros.categoria;
    const matchesApadrinhado =
      !filtros.apadrinhado ||
      (filtros.apadrinhado === 'apadrinhado' && child.apadrinhado) ||
      (filtros.apadrinhado === 'disponivel' && !child.apadrinhado);

    let matchesIdade = true;
    const idade = child.idade;
    switch (filtros.idade) {
      case '0-3 anos':
        matchesIdade = idade <= 3;
        break;
      case '4-6 anos':
        matchesIdade = idade >= 4 && idade <= 6;
        break;
      case '7-9 anos':
        matchesIdade = idade >= 7 && idade <= 9;
        break;
      case '10-12 anos':
        matchesIdade = idade >= 10 && idade <= 12;
        break;
      case '13+ anos':
        matchesIdade = idade >= 13;
        break;
    }

    return matchesSearch && matchesCidade && matchesEscola && matchesCategoria && matchesApadrinhado && matchesIdade;
  });

  return (
    <div className="max-w-6xl mx-auto px-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Crianças Para Apadrinhamento</h2>

        {/* 
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-blue-700 transition"
        >
          <Plus className="inline mr-2 h-4 w-4" /> Cadastrar Criança
        </button>
        */}
      </div>

      <Stats stats={stats} />

      {showForm && (
        <AddChildForm
          onAdd={handleAddChild}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filtros e Busca */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-8">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-600 mr-2" />
          <h2 className="text-lg font-bold text-gray-800">Filtros e Busca</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="sm:col-span-2 xl:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <select
            value={filtros.cidade}
            onChange={(e) => setFiltros({ ...filtros, cidade: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todas as cidades</option>
            {cidades.map(cidade => (
              <option key={cidade} value={cidade}>{cidade}</option>
            ))}
          </select>

          <select
            value={filtros.escola}
            onChange={(e) => setFiltros({ ...filtros, escola: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todas as escolar</option>
            {escolar.map(escola => (
              <option key={escola} value={escola}>{escola}</option>
            ))}
          </select>

          <select
            value={filtros.categoria}
            onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todas as categorias</option>
            {categorias.map(categoria => (
              <option key={categoria} value={categoria}>{categoria}</option>
            ))}
          </select>

          <select
            value={filtros.apadrinhado}
            onChange={(e) => setFiltros({ ...filtros, apadrinhado: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todos os status</option>
            <option value="disponivel">Disponíveis</option>
            <option value="apadrinhado">Apadrinhados</option>
          </select>
        </div>
      </div>

      {/* Grid de Crianças */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {childrenFiltradas.map(child => (
          <ChildCard key={child.id} child={child} onToggle={toggleApadrinhamento} />
        ))}
      </div>

      {childrenFiltradas.length === 0 && (
        <div className="text-center text-gray-500 py-10">Nenhuma criança encontrada com os filtros aplicados.</div>
      )}
    </div>
  );
}
