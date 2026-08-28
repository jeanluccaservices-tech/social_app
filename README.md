# LoveVibe

Rede social de relacionamentos para maiores de 18 anos, com feed, chat direto,
salas de grupo temáticas, match por swipe e uma assinatura PRÓ paga via
Mercado Pago (Pix, cartão ou boleto).

## Stack

- **React 19 + Vite** — SPA em `src/`, sem roteador (a navegação entre seções é
  feita por estado local em `App.jsx`)
- **Tailwind CSS v4** — tema claro/escuro via variáveis CSS em `src/index.css`
  (`ThemeContext`)
- **Supabase** — Postgres + Auth + Storage + Edge Functions (`supabase/`)
- **Mercado Pago** — cobrança da assinatura PRÓ (Checkout Pro para
  cartão/boleto, API de Pix para QR Code)
- **Resend** — envio do e-mail com código de verificação no cadastro
- **lucide-react** — ícones

## Funcionalidades

- **Age Gate** — confirmação de 18+ obrigatória antes de qualquer conteúdo
  (`src/components/auth/AgeGate.jsx`), guardada em `localStorage`
- **Tela inicial (landing)** — apresentação do produto para visitantes não
  autenticados, com CTA para login/cadastro e para conhecer o plano PRÓ
  (`src/components/layout/LoginGate.jsx`)
- **Cadastro/login** com verificação de e-mail por código, perfis de
  solteiro(a) ou casal, preferências de match (idade, sexo, raio de distância)
- **Feed** de publicações com fotos, sugestões de perfis
- **Chat direto** — qualquer pessoa pode receber mensagens, mas só membros
  PRÓ podem iniciar conversas e enviar fotos
- **Salas de Grupo VIP** — bate-papos coletivos com regras de entrada
  (somente casais, somente solteiros, por localização), exclusivas para
  membros PRÓ
- **Match (swipe)** — descoberta de perfis por arrastar/curtir, exclusivo
  para membros PRÓ
- **Amigos & Explorar** — envio/aceite de solicitações de amizade, busca e
  filtros por sexo/idade/distância
- **Assinatura PRÓ** — R$ 24,90/mês, sem renovação automática, pagável via
  Pix, cartão ou boleto (`src/components/auth/ProModal.jsx`)
- **Perfis de casal**, avisos de moderação/denúncia e notificações

## Rodando localmente

```bash
npm install
npm run dev      # servidor de desenvolvimento (Vite)
npm run build    # build de produção
npm run preview  # serve o build de produção localmente
npm run lint     # oxlint
```

Crie um `.env.local` na raiz com as credenciais do seu projeto Supabase:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxx
```

## Backend (Supabase)

- `supabase/migrations/` — schema do banco (perfis, amizades, mensagens,
  salas de grupo, denúncias, pagamentos, etc.), aplicado em ordem numérica
- `supabase/functions/` — Edge Functions:
  - `mp-checkout` — cria a preferência de Checkout Pro (cartão/boleto)
  - `mp-pix-payment` — gera cobrança Pix (QR Code)
  - `mp-webhook` — recebe a confirmação de pagamento do Mercado Pago e
    ativa o PRÓ do usuário
  - `send-email` — dispara o e-mail de verificação de cadastro via Resend
  - `delete-post` — exclusão lógica de post: marca `deleted_at` e, se o
    post tiver imagem, move o arquivo no Storage para o prefixo `deleted/`
    do mesmo bucket (fica separado das imagens ativas, para conferência
    manual — veja "Moderação de imagens excluídas" abaixo)

Segredos necessários nas Edge Functions (`supabase secrets set ...`, veja
`supabase/.env.example`):

```bash
RESEND_API_KEY=...
SEND_EMAIL_HOOK_SECRET=v1,whsec_...
MERCADOPAGO_ACCESS_TOKEN=...
SITE_URL=https://seu-dominio-de-producao
```

O valor da assinatura PRÓ (`PRO_PRICE_BRL`) está definido em
`mp-checkout/index.ts` e `mp-pix-payment/index.ts` — ao alterar o preço,
depois de editar o código é preciso reimplantar as funções:

```bash
supabase functions deploy mp-checkout
supabase functions deploy mp-pix-payment
```

### Moderação de imagens excluídas

Ao excluir uma publicação com imagem, o post fica com `deleted_at` marcado
(some do app para sempre) e a imagem correspondente é movida, dentro do
mesmo bucket (`media`), para um prefixo `deleted/` — por exemplo
`media/{userId}/foto.jpg` vira `media/deleted/{userId}/foto.jpg`. Assim,
no painel do Supabase (Storage → bucket `media`), a pasta `deleted/`
reúne só o que já foi excluído, separado das pastas por usuário com
conteúdo ativo — sem precisar cruzar com a tabela `posts` para saber o
que é o quê.

## Estrutura de pastas

```
src/
  components/
    auth/       # AgeGate, AuthModal, ProModal
    chat/       # Chat direto
    common/     # Avatar, seletor de cidade, lightbox, botão de suporte
    feed/       # Feed, criação de post, sugestões de perfil
    friends/    # Amigos, explorar, match (swipe)
    groups/     # Salas de grupo VIP
    layout/     # Navbar, Sidebar, LoginGate, notificações
    profile/    # Visualização/edição de perfil
  context/      # AuthContext, SocialContext, ThemeContext
  lib/          # cliente Supabase, cidades, geolocalização, upload
  utils/        # formatação de texto e datas
supabase/
  migrations/   # schema do banco
  functions/    # Edge Functions (pagamento e e-mail)
```
