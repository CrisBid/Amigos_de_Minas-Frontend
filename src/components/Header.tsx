'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import logo from '@/assets/logo.jpg'

export function Header() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href))

  // Roles (garanta no NextAuth session callback algo como: session.user.roles = token.user.roles)
  const roles: string[] = (session as any)?.user?.roles ?? []

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
            priority
          />
          <span className="text-xl font-bold text-[#253243] tracking-tight">
            Amigos de Minas
          </span>
        </Link>

        {/* Menu + Ações */}
        <div className="flex items-center gap-6">
          <nav className="flex gap-5 text-base font-medium">
            <NavLink href="/apadrinhamento" label="Apadrinhamento" active={isActive('/apadrinhamento')} />
            <NavLink href="/cidades" label="Cidades Atendidas" active={isActive('/cidades')} />
            {/* <NavLink href="/construcao-casas" label="Projeto de Moradias" active={isActive('/construcao-casas')} /> */}
          </nav>

          {/* Área de Autenticação */}
          {status === 'loading' && (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
            </div>
          )}

          {status !== 'loading' && !session && (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/signin"
                className="px-4 py-1.5 bg-[#253243] text-white text-sm rounded-md hover:bg-[#375A7F] transition"
              >
                Cadastrar
              </Link>
              <Link
                href="/auth/login"
                className="px-4 py-1.5 bg-[#253243] text-white text-sm rounded-md hover:bg-[#375A7F] transition"
              >
                Login
              </Link>
            </div>
          )}

          {status !== 'loading' && session && (
            <ProfileDropdown
              name={session.user?.name ?? 'Usuário'}
              email={session.user?.email ?? ''}
              image={session.user?.image ?? undefined}
              roles={roles}
            />
          )}
        </div>
      </div>
    </header>
  )
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`text-[#253243] hover:text-[#375A7F] transition-colors duration-200 ${
        active ? 'underline underline-offset-8 decoration-[#253243]/40' : ''
      }`}
    >
      {label}
    </Link>
  )
}

function ProfileDropdown({
  name,
  email,
  image,
  roles = [],
}: {
  name: string
  email?: string
  image?: string
  roles?: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [])

  const initials = getInitials(name)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 group"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#253243]/10">
          {image ? (
            <Image
              src={image}
              alt={name}
              width={36}
              height={36}
              className="w-9 h-9 object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center text-[#253243] text-sm font-semibold">
              {initials}
            </div>
          )}
        </div>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold text-[#253243] group-hover:text-[#375A7F]">
            {name}
          </span>
          {email ? (
            <span className="text-xs text-gray-500 truncate max-w-[160px]">{email}</span>
          ) : null}
        </div>
        <svg
          className={`ml-1 h-4 w-4 text-gray-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.188l3.71-3.957a.75.75 0 111.08 1.04l-4.24 4.525a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Menu */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-64 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-[#253243]">{name}</p>
            {email ? <p className="text-xs text-gray-500 truncate">{email}</p> : null}
          </div>

          <ul className="py-1 text-sm">
            <MenuItem onClick={() => router.push('/perfil')}>Meu perfil</MenuItem>
            <MenuItem onClick={() => router.push('/meus-apadrinhamentos')}>
              Meus apadrinhamentos
            </MenuItem>

            {/* Itens visíveis para ADMIN/STAFF */}
            {(roles.includes('ADMIN') || roles.includes('STAFF')) && (
              <>
                <MenuSeparator />
                <MenuItem onClick={() => router.push('/admin')}>
                  Painel administrativo
                </MenuItem>
                <MenuItem onClick={() => router.push('/admin/criancas')}>
                  Gerir crianças
                </MenuItem>
                <MenuItem onClick={() => router.push('/admin/apadrinhamentos')}>
                  Gerir apadrinhamentos
                </MenuItem>
              </>
            )}

            <MenuSeparator />
            <MenuItem
              danger
              onClick={() =>
                signOut({ callbackUrl: '/' }) // volta para home ao sair
              }
            >
              Sair
            </MenuItem>
          </ul>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition ${
          danger ? 'text-red-600 hover:bg-red-50' : 'text-[#253243]'
        }`}
        role="menuitem"
      >
        {children}
      </button>
    </li>
  )
}

function MenuSeparator() {
  return <div className="my-1 border-t border-gray-100" />
}

function getInitials(name?: string) {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}
