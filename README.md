# LoveVibe

Rede social de relacionamentos para maiores de 18 anos, com feed, chat direto,
salas de grupo temáticas, match por swipe e uma assinatura PRÓ paga via
Stripe (checkout único, com cartão, boleto e Pix conforme habilitado na
conta Stripe).

## Stack

- **React 19 + Vite** — SPA em `src/`, sem roteador (a navegação entre seções é
  feita por estado local em `App.jsx`)
- **Tailwind CSS v4** — tema claro/escuro via variáveis CSS em `src/index.css`
  (`ThemeContext`)
- **Supabase** — Postgres + Auth + Storage + Edge Functions (`supabase/`)
- **Stripe** — cobrança da assinatura PRÓ via uma única Checkout Session;
  os métodos de pagamento exibidos (cartão, boleto, Pix) são os habilitados
  no Dashboard do Stripe, não fixados no código
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
- **Enquetes** — publicação com pergunta + 2 a 4 opções (`posts.type =
  'poll'`), voto único e anônimo por pessoa (`poll_votes`, um voto por
  usuário via índice único). Ninguém, nem por consulta direta ao banco,
  consegue ver quem votou em quê — os totais só saem da função
  `poll_results()` (agregado, sem expor linha por usuário)
- **Stories** (`stories` table) — foto que expira em 24h (`expires_at`),
  com a audiência escolhida por quem posta: "Todos" ou "Apenas amigos"
  (`visibility`, checado na RLS na hora da leitura, não no momento de
  postar). Respeita bloqueio de usuário como posts/comentários já fazem.
  Marca visualização por usuário (`story_views`) para o anel
  visto/não-visto e a contagem de visualizações de quem postou; sem
  limpeza automática agendada — cada novo story do próprio usuário varre
  e apaga os stories vencidos dele (best-effort, sem cron job)
- **Chat direto** — qualquer pessoa pode receber mensagens, mas só membros
  PRÓ podem iniciar conversas e enviar fotos
- **Salas de Grupo VIP** — bate-papos coletivos com regras de entrada
  (somente casais, somente solteiros, por localização), exclusivas para
  membros PRÓ
- **Match (swipe)** — descoberta de perfis por arrastar/curtir, exclusivo
  para membros PRÓ
- **Amigos & Explorar** — envio/aceite de solicitações de amizade, busca e
  filtros por sexo/idade/distância
- **Assinatura PRÓ** — R$ 24,90/mês, sem renovação automática, um único
  botão que abre o Checkout do Stripe com os métodos de pagamento
  habilitados na conta (`src/components/auth/ProModal.jsx`)
- **Perfis de casal**, avisos de moderação/denúncia e notificações
- **Painel Admin** (`src/components/admin/AdminPanel.jsx`) — aba extra
  visível só para contas na tabela `admins`, com indicadores (usuários
  ativos, VIP, banidos, denúncias pendentes, contas excluídas), lista de
  denúncias com ação de resolver/ignorar, apagar o post denunciado ou
  banir o autor, e busca/banimento de qualquer usuário. A aba escondida é
  só conveniência — toda ação é validada no servidor via `is_admin()`
  (RLS + Edge Functions), nunca só pela UI. Não há tela para se
  autopromover a admin: a única forma de adicionar alguém é inserir
  diretamente na tabela `admins` (por SQL, no Supabase)

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
  salas de grupo, denúncias, pagamentos, rate limiting, etc.), aplicado em
  ordem numérica
- `supabase/functions/_shared/rateLimit.ts` — helper de rate limiting
  (`checkRateLimit`/`clientIdentity`) reusado pelas Edge Functions abaixo,
  apoiado na tabela `rate_limit_hits` e na função `check_rate_limit()`
  (`0028_rate_limiting.sql`)
- `supabase/functions/` — Edge Functions:
  - `request-password-reset` — fluxo de "esqueci minha senha": limita a 3
    e-mails de recuperação por endereço a cada 24h (mais um limite geral
    por IP), e então dispara `supabase.auth.resetPasswordForEmail`, cujo
    e-mail é entregue pelo hook `send-email` (`case 'recovery'`)
  - `stripe-checkout` — cria a Checkout Session do Stripe; os métodos de
    pagamento mostrados vêm do que está habilitado no Dashboard (Settings >
    Payment methods), sem `payment_method_types` fixo no código
  - `stripe-pix-payment` — gera cobrança Pix diretamente via Payment
    Intents (QR Code exibido no app). **Não usada pelo fluxo atual** — o
    `ProModal` só chama `stripe-checkout`, que já cobre Pix
    automaticamente quando habilitado; mantida caso um fluxo de Pix
    dedicado (fora do Checkout) seja necessário no futuro
  - `stripe-webhook` — recebe a confirmação de pagamento do Stripe
    (assinatura verificada via `STRIPE_WEBHOOK_SECRET`) e ativa o PRÓ do
    usuário
  - `cancel-pro-subscription` — cancelamento da assinatura PRÓ com
    reembolso integral via Stripe, disponível até 7 dias após o pagamento
    (direito de arrependimento, CDC art. 49). Busca o pagamento aprovado
    mais recente ainda não reembolsado (`payment_transactions.refunded_at`
    nulo), chama `stripe.refunds.create`, recua `pro_expires_at` em 1 mês e
    envia um e-mail de notificação para `reembolso@lovevibe.com.br` via
    Resend. Acessível por um link discreto dentro do `ProModal` quando a
    assinatura está ativa, que abre um modal de confirmação avisando da
    perda dos benefícios antes de efetivar o cancelamento
  - `send-email` — dispara o e-mail de verificação de cadastro via Resend
  - `delete-post` — exclusão lógica de post: marca `deleted_at` e, se o
    post tiver imagem, move o arquivo no Storage para o prefixo `deleted/`
    do mesmo bucket (fica separado das imagens ativas, para conferência
    manual — veja "Moderação de imagens excluídas" abaixo). Também aceita
    exclusão de post de qualquer usuário quando o chamador é admin
    (`is_admin()`, checado no servidor), usado pelo Painel Admin
  - `report-post` — registra a denúncia em `post_reports` e envia um
    e-mail de notificação (motivo, detalhes, dados de quem denunciou, autor
    e conteúdo da publicação denunciada, e o link) para `REPORT_TO_EMAIL`
  - `admin-ban-user` / `admin-unban-user` — banem/desbanem uma conta via
    Supabase Auth Admin API (`auth.users.banned_until`, o que de fato
    bloqueia login/refresh — não é só um sinalizador de UI), espelhando o
    valor em `profiles.banned_until`. Só funcionam para quem está na
    tabela `admins` (checado no servidor via `is_admin()`, nunca confiando
    só na aba escondida no app)

  `stripe-checkout`, `stripe-pix-payment`, `cancel-pro-subscription`,
  `report-post`, `delete-post` e `request-password-reset` são protegidas
  por rate limit (por usuário logado ou por IP, via `_shared/rateLimit.ts`)
  contra abuso/spam —
  `stripe-webhook` (assinado pelo Stripe) e `send-email` (chamado pelo
  GoTrue) não precisam, pela mesma razão que não têm verificação de JWT.

Segredos necessários nas Edge Functions (`supabase secrets set ...`, veja
`supabase/.env.example`):

```bash
RESEND_API_KEY=...
SEND_EMAIL_HOOK_SECRET=v1,whsec_...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=https://seu-dominio-de-producao
REPORT_TO_EMAIL=denuncias@lovevibe.com.br
```

Configure no Dashboard do Stripe (Webhooks) o endpoint
`https://<seu-projeto>.functions.supabase.co/stripe-webhook`, escutando os
eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed` e `payment_intent.succeeded`, e copie
o signing secret gerado para `STRIPE_WEBHOOK_SECRET`. Os dois eventos
`async_payment_*` são obrigatórios para métodos de pagamento assíncronos
(Boleto, por exemplo): `checkout.session.completed` dispara na hora com o
boleto ainda não pago, e só quando ele é efetivamente pago (dias depois) a
Stripe manda `checkout.session.async_payment_succeeded` — sem esse evento
configurado, o PRO nunca seria liberado para quem paga com boleto. Para
testar localmente, use o Stripe CLI: `stripe listen --forward-to <url-local-da-function>`.

O valor da assinatura PRÓ (`PRO_PRICE_BRL`) está definido em
`stripe-checkout/index.ts` (e replicado em `stripe-pix-payment/index.ts`,
hoje não usada) — ao alterar o preço, depois de editar o código é preciso
reimplantar as funções:

```bash
supabase functions deploy stripe-checkout
supabase functions deploy stripe-pix-payment
supabase functions deploy stripe-webhook
supabase functions deploy cancel-pro-subscription
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
