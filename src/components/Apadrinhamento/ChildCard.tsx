'use client';

import { Heart, Calendar, MapPin, Gift } from 'lucide-react';
import React from 'react';

export default function ChildCard({ child }:any) {
  return (
    <div className="bg-white shadow-md rounded-xl overflow-hidden">
      <img src={child.foto} alt={child.nome} className="w-full h-56 object-cover" />
      <div className="p-4">
        <h3 className="font-bold text-lg">{child.nome}</h3>
        <p>{child.idade} anos</p>
        <p>{child.cidade}</p>
        <p>{child.categoria}</p>
        <p className="mt-2 text-sm text-gray-700">{child.descricao}</p>
        <button className="mt-4 w-full bg-blue-500 text-white rounded-md p-2">
          {child.apadrinhado ? 'Remover Apadrinhamento' : 'Apadrinhar'}
        </button>
      </div>
    </div>
  );
}
