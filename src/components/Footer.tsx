import Link from 'next/link'
import { Heart, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'

const EMAIL = 'ongamigosdeminas@gmail.com'
const PHONE = '(31) 99549-2237'
const WHATSAPP = 'https://wa.me/5531995492237'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center mb-4">
              <div className="w-11 h-11 bg-gradient-to-r from-blue-500 to-green-400 rounded-2xl flex items-center justify-center mr-3 shrink-0">
                <Heart className="w-5 h-5 text-white fill-white" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                  Amigos de Minas
                </h3>
                <p className="text-sm text-gray-500">Transformando vidas desde 2001</p>
              </div>
            </div>

            <p className="text-gray-600 leading-relaxed mb-5 max-w-md text-sm sm:text-base">
              Conectando corações através do apadrinhamento de crianças e construindo lares
              de esperança no norte de Minas Gerais.
            </p>

            <Link
              href="/apadrinhamento"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-green-500 text-white text-sm font-semibold shadow-sm hover:shadow-md transition"
            >
              <Heart className="w-4 h-4" /> Apadrinhe uma criança
            </Link>
          </div>

          <div>
            <h4 className="text-base font-semibold text-gray-800 mb-4">Links rápidos</h4>
            <ul className="space-y-1">
              <FooterLink href="/">Início</FooterLink>
              <FooterLink href="/apadrinhamento">Apadrinhamento</FooterLink>
              <FooterLink href="/meus-apadrinhamentos">Meus apadrinhamentos</FooterLink>
              <FooterLink href="/perfil">Meu perfil</FooterLink>
            </ul>
          </div>

          <div>
            <h4 className="text-base font-semibold text-gray-800 mb-4">Contato</h4>
            <ul className="space-y-1">
              <li>
                <a href={`mailto:${EMAIL}`} className="flex items-center gap-3 py-1.5 text-gray-600 hover:text-blue-600 break-all">
                  <Mail className="w-4 h-4 text-blue-500 shrink-0" /> {EMAIL}
                </a>
              </li>
              <li>
                <a href={`tel:+5531995492237`} className="flex items-center gap-3 py-1.5 text-gray-600 hover:text-blue-600">
                  <Phone className="w-4 h-4 text-blue-500 shrink-0" /> {PHONE}
                </a>
              </li>
              <li>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-1.5 text-gray-600 hover:text-green-600">
                  <MessageCircle className="w-4 h-4 text-green-500 shrink-0" /> WhatsApp
                </a>
              </li>
              <li className="flex items-center gap-3 py-1.5 text-gray-600">
                <MapPin className="w-4 h-4 text-amber-500 shrink-0" /> Belo Horizonte
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-8 sm:mt-10 pt-6">
          <p className="text-gray-500 text-sm text-center md:text-left">
            &copy; {new Date().getFullYear()} ONG Amigos de Minas. Feito com ❤️ para transformar vidas.
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center py-1.5 text-gray-600 hover:text-blue-600 transition-colors">
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-3" />
        {children}
      </Link>
    </li>
  )
}
