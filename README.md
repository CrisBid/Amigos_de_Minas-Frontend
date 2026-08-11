# Amigos de Minas — Frontend

Frontend do sistema de gestão de apadrinhamento da **ONG Amigos de Minas**: área pública de apadrinhamento (catálogo de crianças, registro, Pix) e painel administrativo completo para a equipe da ONG operar campanhas, cadastros e relatórios.

Construído com **Next.js 15 (App Router)** e **React 19**, consome a [API backend em NestJS](../Amigos_de_Minas-Backend-master).

## Sumário

- [Sobre o projeto](#sobre-o-projeto)
- [Stack técnica](#stack-técnica)
- [Rotas da aplicação](#rotas-da-aplicação)
- [Autenticação](#autenticação)
- [Funcionalidades de destaque](#funcionalidades-de-destaque)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts disponíveis](#scripts-disponíveis)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Roadmap / pontos de atenção](#roadmap--pontos-de-atenção)

## Sobre o projeto

O frontend oferece dois grandes fluxos:

- **Área pública**: catálogo de crianças disponíveis para apadrinhar, registro de apadrinhamento, pagamento/doação via Pix e acompanhamento dos apadrinhamentos pelo próprio padrinho/madrinha.
- **Painel administrativo** (`/admin`): gestão completa da operação da ONG — crianças, campanhas, apadrinhamentos, cidades/comunidades/escolas, pontos de coleta, usuários, conferência e exportação de relatórios — permitindo à equipe acompanhar em tempo real toda a evolução da campanha.

## Stack técnica

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Turbopack em dev)
- **UI**: React 19 + [Tailwind CSS 4](https://tailwindcss.com/) (sem biblioteca de componentes — UI construída sob medida), ícones via `lucide-react`
- **Autenticação**: [NextAuth v4](https://next-auth.js.org/) (Credentials + Google OAuth), delegando a validação real ao backend NestJS
- **HTTP**: `fetch` nativo, encapsulado em um client próprio (`src/lib/api.ts`)
- **Relatórios**: [`exceljs`](https://github.com/exceljs/exceljs) (exportação Excel) e [`jspdf`](https://github.com/parallax/jsPDF) (exportação PDF)
- **Pix**: geração própria de QR Code (payload BR Code/EMV com CRC16), sem gateway de pagamento terceirizado
- **Linguagem**: TypeScript 5 (modo `strict`)

## Rotas da aplicação

### Área pública

| Rota | Função |
|---|---|
| `/apadrinhamento` | Catálogo de crianças disponíveis, com filtros por cidade/comunidade/escola/status e leitura de QR Code |
| `/apadrinhamento/registro` | Formulário de registro/confirmação de um apadrinhamento |
| `/apadrinhamento/concluir` | Conclusão do apadrinhamento (Pix/instruções) |
| `/auth/login` | Login (e-mail ou telefone) |
| `/auth/signin` | Cadastro de novo padrinho/madrinha |
| `/cidades` | Página institucional sobre as cidades atendidas no Norte de Minas |
| `/meus-apadrinhamentos` | Área logada do padrinho: apadrinhamentos ativos, com exportação em PDF |
| `/perfil` | Edição de dados pessoais |

### Painel administrativo (`/admin/*`)

| Rota | Função |
|---|---|
| `/admin` | Dashboard com KPIs (crianças, campanhas, apadrinhamentos, cidades) e atividade recente |
| `/admin/children` | CRUD e listagem de crianças |
| `/admin/children/[id]` | Edição de uma criança, incluindo composição de imagem com moldura |
| `/admin/children/bulk` | Importação em massa de crianças (migração de dados legados) |
| `/admin/campaigns` | CRUD de campanhas e associação de molduras/layouts |
| `/admin/sponsorships` | Gestão de apadrinhamentos, transferência entre padrinhos, exportação |
| `/admin/conferencia` | Painel de conferência/reconciliação da operação |
| `/admin/geral` | Hub de cadastros gerais (atalhos de teclado 1–6) |
| `/admin/cities` `/admin/communities` `/admin/schools` | CRUDs hierárquicos (cidade → comunidade → escola) |
| `/admin/collection-points` | CRUD de pontos de coleta/entrega |
| `/admin/users` | Gestão de usuários e papéis |
| `/admin/exports/children` | Exportação Excel de crianças |
| `/admin/exports/sponsorships` | Exportação Excel de apadrinhamentos |

Além disso, `src/app/api/admin/*` funciona como uma camada BFF (Backend for Frontend) em Next.js API Routes, fazendo proxy autenticado para o backend NestJS.

## Autenticação

- **NextAuth v4** com sessão em JWT.
- **Credentials**: login por e-mail ou telefone, validado contra o backend NestJS (`/auth/login`), com refresh automático de token (`/auth/refresh`).
- **Google OAuth**: usuários que entram via Google recebem o papel padrão `SPONSOR`.
- `session.user` carrega `id`, `roles` e `phone`; `session.accessToken`/`refreshToken` ficam disponíveis para chamadas autenticadas ao backend.

> ⚠️ Não há `middleware.ts` no projeto — a proteção das rotas `/admin/*` hoje é feita por verificação de sessão em cada página (client-side). A validação de autorização "de verdade" ocorre no backend, mas vale considerar um middleware de rota para reforçar a proteção no próprio Next.js.

## Funcionalidades de destaque

- **Composição de imagens no navegador** (`ComposedImage.tsx`): monta, via canvas, a foto da criança + moldura da campanha + textos dinâmicos (nome, presente desejado, cidade), refletindo o mesmo pipeline de composição do backend.
- **Importação em massa** (`/admin/children/bulk`): tela dedicada para migrar rapidamente os cadastros que já existiam em planilhas da ONG, com preview antes de confirmar o envio.
- **Exportação de relatórios**: geração de planilhas Excel (por cidade, comunidade, padrinho ou seleção livre) e PDFs de comprovante, direto no navegador.
- **Pix nativo**: geração de QR Code Pix estático (chave, favorecido, CNPJ) sem depender de gateway de pagamento externo.
- **Fluxo logístico de apadrinhamento**: acompanhamento do status do presente (pendente → em compra → embalado → encaixotado → aguardando entrega → concluído), com badges e agrupamentos padronizados em `src/lib/sponsorship-status.ts`.

## Como rodar localmente

Pré-requisitos: Node.js 18+, e o [backend](../Amigos_de_Minas-Backend-master) rodando (ou uma URL de API acessível).

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente (ver seção abaixo)
cp .env.example .env.local

# 3. Subir em modo desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

Não há `.env.example` versionado — recomenda-se criar um com as variáveis abaixo, identificadas no código:

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_NEST_API_URL` | URL pública da API NestJS (usada no client) |
| `NEST_API_URL` | URL da API NestJS usada nas API Routes (server-side) |
| `NEST_AUTH_BASE_URL` | URL do serviço de autenticação (`/auth/login`, `/auth/refresh`) |
| `NEXTAUTH_SECRET` | Segredo do NextAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciais do provider Google OAuth |
| `NEXT_PUBLIC_PIX_KEY` | Chave Pix usada na geração do QR Code |
| `NEXT_PUBLIC_PIX_FAVORECIDO` | Nome do favorecido exibido no Pix |
| `NEXT_PUBLIC_PIX_CNPJ` | CNPJ exibido no Pix |
| `NEXT_PUBLIC_PIX_OBS` | Observação padrão incluída no Pix |
| `NEXT_PUBLIC_DROPPOINTS_IMAGE` | Imagem/mapa dos pontos de coleta |

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento (Turbopack) |
| `npm run build` | Gera o build de produção |
| `npm run start` | Sobe o servidor a partir do build |
| `npm run lint` | Lint com ESLint (flat config, `next/core-web-vitals` + `next/typescript`) |

> Erros de lint não bloqueiam o build de produção (`eslint.ignoreDuringBuilds: true` em `next.config.ts`); rodar `npm run lint` manualmente é recomendado antes de subir alterações.

## Estrutura de pastas

```
src/
├── app/
│   ├── apadrinhamento/       # Catálogo, registro e conclusão do apadrinhamento
│   ├── auth/                  # Login e cadastro
│   ├── cidades/                 # Página institucional
│   ├── meus-apadrinhamentos/     # Área logada do padrinho
│   ├── perfil/                    # Edição de perfil
│   ├── (admin)/admin/               # Painel administrativo completo
│   └── api/                           # API Routes (BFF/proxy para o backend + NextAuth)
├── components/
│   ├── Admin/           # Navegação do painel administrativo
│   ├── Apadrinhamento/    # Catálogo e formulário de apadrinhamento
│   ├── Home/                # Seções institucionais
│   ├── Pix/                   # Geração de QR Code Pix
│   ├── Sponsorship/             # Status do apadrinhamento
│   └── media/                     # Composição de imagem (foto + moldura)
├── lib/
│   ├── api.ts             # Cliente HTTP central
│   ├── auth.ts               # Configuração do NextAuth
│   ├── auth-fetch.ts            # Fetch autenticado server-side
│   ├── sponsorship-status.ts       # Fonte única de verdade dos status
│   └── export/ pdf/                   # Geração de relatórios Excel/PDF
└── config/
    └── adminNav.ts         # Rotas de navegação do painel administrativo
```

## Roadmap / pontos de atenção

- Adicionar `middleware.ts` para reforçar a proteção das rotas `/admin/*` no próprio Next.js.
- Versionar um `.env.example` com as variáveis documentadas acima.
- A landing institucional (`Home/*`) hoje não é acessada — `/` redireciona direto para `/apadrinhamento`.
