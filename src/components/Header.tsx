'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Heart, LayoutDashboard, LogIn, LogOut, Menu, User, UserPlus, X } from 'lucide-react'
import logo from '@/assets/logo.jpg'

const NAV = [
  { href: '/apadrinhamento', label: 'Apadrinhamento' },
]

export function Header() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href))

  // Roles (garanta no NextAuth session callback algo como: session.user.roles = token.user.roles)
  const roles: string[] = (session as any)?.user?.roles ?? []
  const isStaff = roles.includes('ADMIN') || roles.includes('STAFF')

  // fecha o menu do celular ao trocar de página
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // trava a rolagem da página com o menu aberto
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mobileOpen])

  return (
    <header className="bg-white/95 backdrop-blur shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Logo + Nome */}
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <Image
            src={logo}
            alt="Logo Amigos de Minas"
            width={40}
            height={40}
            className="rounded-full shrink-0 w-9 h-9 sm:w-10 sm:h-10"
            priority
          />
          <span className="text-lg sm:text-xl font-bold text-[#253243] tracking-tight truncate">
            Amigos de Minas
          </span>
        </Link>

        {/* Desktop: menu + ações */}
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex gap-5 text-base font-medium">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href} label={n.label} active={isActive(n.href)} />
            ))}
          </nav>

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
                className="px-4 py-1.5 border border-[#253243] text-[#253243] text-sm rounded-md hover:bg-[#253243]/5 transition"
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
              isStaff={isStaff}
            />
          )}
        </div>

        {/* Celular: avatar + botão do menu */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          {status !== 'loading' && session && (
            <Avatar name={session.user?.name ?? 'Usuário'} image={session.user?.image ?? undefined} size={32} />
          )}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 -mr-2 rounded-lg text-[#253243] hover:bg-gray-100"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Celular: painel do menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="relative bg-white border-b border-gray-200 shadow-lg max-h-full overflow-y-auto">
            {session && (
              <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
                <Avatar name={session.user?.name ?? 'Usuário'} image={session.user?.image ?? undefined} size={40} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#253243] truncate">{session.user?.name ?? 'Usuário'}</p>
                  {session.user?.email && <p className="text-xs text-gray-500 truncate">{session.user.email}</p>}
                </div>
              </div>
            )}

            <nav className="py-2">
              {NAV.map((n) => (
                <MobileLink key={n.href} href={n.href} active={isActive(n.href)} icon={<Heart className="w-5 h-5" />}>
                  {n.label}
                </MobileLink>
              ))}
              {session && (
                <>
                  <MobileLink href="/meus-apadrinhamentos" active={isActive('/meus-apadrinhamentos')} icon={<Heart className="w-5 h-5 fill-current" />}>
                    Meus apadrinhamentos
                  </MobileLink>
                  <MobileLink href="/perfil" active={isActive('/perfil')} icon={<User className="w-5 h-5" />}>
                    Meu perfil
                  </MobileLink>
                  {isStaff && (
                    <MobileLink href="/admin" active={isActive('/admin')} icon={<LayoutDashboard className="w-5 h-5" />}>
                      Painel administrativo
                    </MobileLink>
                  )}
                </>
              )}
            </nav>

            <div className="px-4 py-4 border-t border-gray-100">
              {session ? (
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50"
                >
                  <LogOut className="w-5 h-5" /> Sair
                </button>
              ) : status !== 'loading' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/auth/signin" className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#253243] text-[#253243] font-medium">
                    <UserPlus className="w-5 h-5" /> Cadastrar
                  </Link>
                  <Link href="/auth/login" className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#253243] text-white font-medium">
                    <LogIn className="w-5 h-5" /> Login
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
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

function MobileLink({ href, active, icon, children }: { href: string; active?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 text-base font-medium ${
        active ? 'bg-[#253243]/5 text-[#253243] border-l-4 border-[#253243]' : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'
      }`}
    >
      <span className="text-[#253243]/70">{icon}</span>
      {children}
    </Link>
  )
}

function Avatar({ name, image, size }: { name: string; image?: string; size: number }) {
  return (
    <div className="rounded-full overflow-hidden ring-2 ring-[#253243]/10 shrink-0" style={{ width: size, height: size }}>
      {image ? (
        <Image src={image} alt={name} width={size} height={size} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center text-[#253243] text-xs font-semibold">
          {getInitials(name)}
        </div>
      )}
    </div>
  )
}

function ProfileDropdown({
  name,
  email,
  image,
  isStaff,
}: {
  name: string
  email?: string
  image?: string
  isStaff?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  // Fecha ao clicar fora ou com Esc
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey) }
  }, [])

  const go = (href: string) => { setOpen(false); router.push(href) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 group"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={name} image={image} size={36} />
        <div className="flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold text-[#253243] group-hover:text-[#375A7F] truncate max-w-[160px]">
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

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-64 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-[#253243] truncate">{name}</p>
            {email ? <p className="text-xs text-gray-500 truncate">{email}</p> : null}
          </div>

          <ul className="py-1 text-sm">
            <MenuItem onClick={() => go('/perfil')}>Meu perfil</MenuItem>
            <MenuItem onClick={() => go('/meus-apadrinhamentos')}>
              Meus apadrinhamentos
            </MenuItem>

            {isStaff && (
              <>
                <MenuSeparator />
                <MenuItem onClick={() => go('/admin')}>
                  Painel administrativo
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
