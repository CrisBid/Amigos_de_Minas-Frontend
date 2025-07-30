'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';

const cidades = ['Montes Claros', 'Januária', 'Pirapora', 'Bocaiúva', 'Janaúba', 'Espinosa'];
const categorias = ['Bonecas', 'Carrinhos', 'Educativos', 'Esportivos', 'Eletrônicos', 'Livros'];

interface Child {
  nome: string;
  idade: string;
  cidade: string;
  categoria: string;
  descricao: string;
}

interface Props {
  onAdd: (child: Child) => void;
  onCancel: () => void;
}

export default function AddChildForm({ onAdd, onCancel }: Props) {
  const [newChild, setNewChild] = useState<Child>({
    nome: '',
    idade: '',
    cidade: '',
    categoria: '',
    descricao: '',
  });

  const handleSubmit = () => {
    if (newChild.nome && newChild.idade && newChild.cidade && newChild.categoria) {
      onAdd(newChild);
      setNewChild({ nome: '', idade: '', cidade: '', categoria: '', descricao: '' });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border-t-4 border-green-500">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <Plus className="h-6 w-6 mr-2 text-green-500" />
        Cadastrar Nova Criança
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
          <input
            type="text"
            value={newChild.nome}
            onChange={(e) => setNewChild({ ...newChild, nome: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Idade</label>
          <input
            type="number"
            value={newChild.idade}
            onChange={(e) => setNewChild({ ...newChild, idade: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
          <select
            value={newChild.cidade}
            onChange={(e) => setNewChild({ ...newChild, cidade: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="">Selecione a cidade</option>
            {cidades.map((cidade) => (
              <option key={cidade} value={cidade}>{cidade}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
          <select
            value={newChild.categoria}
            onChange={(e) => setNewChild({ ...newChild, categoria: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="">Selecione a categoria</option>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>{categoria}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 xl:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
          <textarea
            value={newChild.descricao}
            onChange={(e) => setNewChild({ ...newChild, descricao: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
            rows={3}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg hover:from-green-600 hover:to-blue-700 text-sm"
        >
          Cadastrar
        </button>
      </div>
    </div>
  );
}
