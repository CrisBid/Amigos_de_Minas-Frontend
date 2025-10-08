import NextAuth, { NextAuthOptions } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

const NEST_AUTH_BASE_URL = process.env.NEST_AUTH_BASE_URL!

// ---- refresh no Nest
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
    signIn: "/signin",
  },
  providers: [
    // ---- Credentials -> Nest (agora com identifier)
    Credentials({
      name: "Login",
      credentials: {
        identifier: { label: "E-mail ou Telefone", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null
        const res = await fetch(`${NEST_AUTH_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: credentials.identifier, // <- e-mail OU telefone
            password: credentials.password,
          }),
        })
        if (!res.ok) return null
        const data = await res.json()
        // Esperado do Nest:
        // { user: { id, name, email, phone?, roles? }, access_token, refresh_token, expires_in }
        const { user, access_token, refresh_token, expires_in } = data
        if (!user || !access_token) return null

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          phone: user.phone ?? null,
          roles: user.roles ?? [],
          accessToken: access_token,
          refreshToken: refresh_token,
          accessTokenExpires: Date.now() + expires_in * 1000,
          provider: "nest",
          rawUser: user,
        } as any
      },
    }),

    // ---- Google (inalterado)
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { prompt: "consent", access_type: "offline", response_type: "code" },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // Primeiro login (Nest via Credentials)
      if (user && (user as any).provider === "nest") {
        const u = user as any
        token.provider = "nest"
        token.accessToken = u.accessToken
        token.refreshToken = u.refreshToken
        token.accessTokenExpires = u.accessTokenExpires
        token.user = u.rawUser
        token.roles = u.roles ?? u.rawUser?.roles ?? token.roles ?? []
        token.phone = u.phone ?? u.rawUser?.phone ?? null
        return token
      }

      // Primeiro login (Google)
      if (account?.provider === "google") {
        token.provider = "google"
        token.googleAccessToken = account.access_token
        token.googleRefreshToken = account.refresh_token
        token.googleAccessTokenExpires = Date.now() + (Number(account.expires_in ?? 3600)) * 1000
        token.roles = token.roles ?? ["SPONSOR"]
        return token
      }

      // Renovação quando expirar (Nest)
      if (token.provider === "nest") {
        if (token.accessToken && token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
          return token
        }
        try {
          const data = await refreshNestToken(String(token.refreshToken))
          token.accessToken = data.access_token
          token.accessTokenExpires = Date.now() + data.expires_in * 1000
          if (data.refresh_token) token.refreshToken = data.refresh_token
          token.roles = token.roles ?? []
          return token
        } catch {
          // preserve roles e dados mínimos para cair no re-login sem perder estado
          return {
            name: token.name,
            email: token.email,
            roles: (token as any).roles ?? [],
            phone: (token as any).phone ?? null,
          } as any
        }
      }

      if (token.provider === "google") {
        if (token.googleAccessTokenExpires && Date.now() < (token.googleAccessTokenExpires as number)) {
          return token
        }
        return {
          name: token.name,
          email: token.email,
          roles: (token as any).roles ?? ["SPONSOR"],
        } as any
      }

      return token
    },

    async session({ session, token }) {
      session.user = session.user || {}
      ;(session.user as any).id = (token.sub ?? (token.user as any)?.id) as string | undefined
      ;(session.user as any).provider = token.provider
      ;(session.user as any).roles = (token as any).roles ?? []
      ;(session.user as any).phone = (token as any).phone ?? (token.user as any)?.phone ?? null

      if (token.provider === "nest") {
        ;(session as any).accessToken = (token as any).accessToken
        ;(session as any).refreshToken = (token as any).refreshToken
        ;(session as any).accessTokenExpires = (token as any).accessTokenExpires
      }

      if (token.provider === "google") {
        ;(session as any).googleAccessToken = (token as any).googleAccessToken
        ;(session as any).googleAccessTokenExpires = (token as any).googleAccessTokenExpires
      }

      return session
    },
  },
}
