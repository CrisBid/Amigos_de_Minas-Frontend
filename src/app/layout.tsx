import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { Providers } from './providers'
import { Header } from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Amigos de Minas',
  description: 'ONG que ajuda famílias do Norte de Minas com apadrinhamento e moradia',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col font-sans bg-white text-gray-800"
      >
        <Providers>
          <Header />
          <main className="flex-1 px-6 py-10">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
