import NextAuth, { NextAuthOptions } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

const NEST_AUTH_BASE_URL = process.env.NEST_AUTH_BASE_URL!

// Função para renovar o token do Nest
async function refreshNestToken(refreshToken: string) {
  const res = await fetch(`${NEST_AUTH_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error("Falha ao renovar token")
  return res.json() as Promise<{
    access_token: string
    refresh_token?: string
    expires_in: number // segundos
  }>
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    // opcional: use sua página de login
    signIn: "/signin",
  },
  providers: [
    // Provider principal: seu Nest via Credentials
    Credentials({
      name: "Email e Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const res = await fetch(`${NEST_AUTH_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        })
        if (!res.ok) return null
        const data = await res.json()
        // Esperado do Nest:
        // { user: { id, name, email, ... }, access_token, refresh_token, expires_in }
        const { user, access_token, refresh_token, expires_in } = data
        if (!user || !access_token) return null
        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          // guardamos tokens no JWT via callback
          accessToken: access_token,
          refreshToken: refresh_token,
          accessTokenExpires: Date.now() + expires_in * 1000,
          provider: "nest",
          rawUser: user,
        } as any
      },
    }),

    // Provider alternativo: Google
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Para tentar obter refresh_token do Google:
      authorization: {
        params: { prompt: "consent", access_type: "offline", response_type: "code" },
      },
    }),
  ],

  callbacks: {
    // Executa em cada atualização do JWT
    async jwt({ token, user, account }) {
      // Primeiro login (Nest via Credentials)
      if (user && (user as any).provider === "nest") {
        const u = user as any
        token.provider = "nest"
        token.accessToken = u.accessToken
        token.refreshToken = u.refreshToken
        token.accessTokenExpires = u.accessTokenExpires
        token.user = u.rawUser
        return token
      }

      // Primeiro login (Google)
      if (account?.provider === "google") {
        token.provider = "google"
        token.googleAccessToken = account.access_token
        token.googleRefreshToken = account.refresh_token // pode vir vazio se o usuário já consentiu antes
        token.googleAccessTokenExpires = Date.now() + (Number(account.expires_in ?? 3600)) * 1000
        return token
      }

      // Renovação quando expirar
      if (token.provider === "nest") {
        // Se o access token ainda é válido, retorna como está
        if (token.accessToken && token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
          return token
        }
        // Tenta renovar no Nest
        try {
          const data = await refreshNestToken(String(token.refreshToken))
          token.accessToken = data.access_token
          token.accessTokenExpires = Date.now() + data.expires_in * 1000
          if (data.refresh_token) token.refreshToken = data.refresh_token
          return token
        } catch {
          // falhou: força re-login
          return { name: token.name, email: token.email } as any
        }
      }

      if (token.provider === "google") {
        // regra simples: se expirou, apenas force re-login do Google
        if (token.googleAccessTokenExpires && Date.now() < (token.googleAccessTokenExpires as number)) {
          return token
        }
        // Aqui você poderia implementar refresh via Google OAuth (opcional).
        // Se não fizer, força re-login:
        return { name: token.name, email: token.email } as any
      }

      return token
    },

    // Sessão enviada ao client
    async session({ session, token }) {
      session.user = session.user || {}
      ;(session.user as any).id = (token.sub ?? (token.user as any)?.id) as string | undefined
      ;(session.user as any).provider = token.provider

      if (token.provider === "nest") {
        ;(session as any).accessToken = token.accessToken
        ;(session as any).refreshToken = token.refreshToken
        ;(session as any).accessTokenExpires = token.accessTokenExpires
      }

      if (token.provider === "google") {
        ;(session as any).googleAccessToken = token.googleAccessToken
        ;(session as any).googleAccessTokenExpires = token.googleAccessTokenExpires
      }

      return session
    },
  },
}
