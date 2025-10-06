import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Hero from '@/components/Home/Hero'
import About from '@/components/Home/About'
import Projects from '@/components/Home/Projects'
import Impact from '@/components/Home/Impact'
import Contact from '@/components/Home/Contact'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'ONG Amigos de Minas - Transformando Vidas no Norte de Minas',
  description: 'Organização dedicada a ajudar famílias carentes do norte de Minas Gerais através de projetos sociais e ações comunitárias.',
  keywords: 'ONG, Minas Gerais, ajuda social, famílias carentes, norte de minas',
}

export default function Home() {
  redirect('/apadrinhamento')
  return (
    <main className="min-h-screen bg-white">
      <Hero />
      <About />
      <Projects />
      <Impact />
      <Contact />
    </main>
  )
}