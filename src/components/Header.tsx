'use client'

import Image from 'next/image'
import Link from 'next/link'
import logo from '@/assets/logo.jpg'

export function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo + Nome */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={logo}
            alt="Logo Amigos de Minas"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="text-xl font-bold text-[#253243] tracking-tight">
            Amigos de Minas
          </span>
        </Link>

        {/* Menu + Login */}
        <div className="flex items-center gap-6">
          <nav className="flex gap-5 text-base font-medium">
            <NavLink href="/apadrinhamento" label="Apadrinhamento" />
            <NavLink href="/construcao-casas" label="Projeto de Moradias" />
          </nav>

          {/* Botão de Login */}
          <Link
            href="/admin/login"
            className="ml-4 px-4 py-1.5 bg-[#253243] text-white text-sm rounded-md hover:bg-[#375A7F] transition"
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-[#253243] hover:text-[#375A7F] transition-colors duration-200"
    >
      {label}
    </Link>
  )
}
