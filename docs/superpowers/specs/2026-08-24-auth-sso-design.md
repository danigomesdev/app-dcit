# Módulo de Autenticação/SSO — Ponto DCIT

**Status:** Aprovado para implementação
**Spec funcional de referência:** [`docs/spec-funcional.md`](../../spec-funcional.md) (v2), seção 5 ("Autenticação: login corporativo (SSO/Active Directory)")
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md), seção 4 (módulo `auth`: "login corporativo via SSO/Active Directory (OIDC), emissão de sessão (JWT) para mobile e web")

## 1. Objetivo e escopo

Hoje nenhum dos três apps tem autenticação real: `POST /time-entries` aceita um `userId` de qualquer string no corpo da requisição, sem validação de quem está chamando; o mobile manda um `userId: "demo-user"` fixo; o `AppShell` do web mostra um bloco de identidade estático ("RH") sem sessão nenhuma por trás. Essa spec implementa o módulo `auth` real: login via OIDC, sessão própria emitida pela API, e proteção de tela nos três apps.

**Provedor de identidade:** ainda não confirmado com a TI da DCIT. Há indício forte de que é Microsoft Entra ID (o usuário Windows desta máquina é `AzureAD+...`), mas isso não está confirmado. Para não bloquear o desenvolvimento, o módulo é construído contra o **protocolo OIDC padrão** (não contra uma API proprietária de um provedor específico), com um IdP mock rodando localmente em desenvolvimento. Trocar pelo provedor real, quando confirmado, é uma mudança de configuração (issuer URL, client ID/secret), não de código.

Fora de escopo desta spec:
- RBAC granular por campo sensível (ex: CID de atestado visível só a RH) — é responsabilidade dos módulos `documents`/`approvals` quando existirem; este módulo só entrega "qual é o papel deste usuário autenticado".
- Papéis além de `colaborador`/`gestor`/`rh` (plantão/campo, novo contratado, administrador de sistema) — entram quando os fluxos que os usam forem implementados.
- Qualquer módulo de negócio downstream (`leave-requests`, `documents`, `approvals`) — só a fundação de autenticação/sessão.

## 2. Decisões de partida

- **Padrão de fluxo: Backend-for-Frontend.** A API é o único componente que fala OIDC diretamente com o provedor. Web e mobile nunca guardam token do IdP — só a sessão própria (JWT) que a API emite. Isso já estava definido na spec de arquitetura; esta spec detalha a implementação.
- **Biblioteca OIDC client (API):** `openid-client` (pacote Node, implementação padrão do protocolo, sem acoplamento a um provedor específico).
- **Todas as telas exigem login**, mesmo as que hoje são só placeholder (`EmptyState`) sem dado real — consistente com o produto final e evita ter que voltar depois pra adicionar proteção tela por tela.
- **Login entra em mobile e web juntos** nesta leva — os dois já têm pontos esperando por isso (AppShell com identidade estática; mobile com `userId` fixo).

## 3. Backend (`apps/api`)

Novo módulo `auth`, seguindo o padrão modular já estabelecido (mesmo estilo de `time-entries`):

- `GET /auth/login` — redireciona para o IdP configurado (Authorization Code flow).
- `GET /auth/callback` — recebe o `code` de volta do IdP, troca por tokens via `openid-client`, valida o ID token, resolve o papel do usuário (mapeamento de claim do IdP → `colaborador`/`gestor`/`rh`, configurável), emite um JWT próprio assinado (claims: `sub`, `role`, `name`, `exp`) e:
  - se a origem da requisição foi o web: seta o JWT como cookie `httpOnly` + `Secure` no domínio do web, redireciona de volta para a app.
  - se foi o mobile: retorna o JWT no corpo da resposta, para o `expo-auth-session` capturar e guardar no `expo-secure-store`.
- `POST /auth/logout` — invalida a sessão (limpa o cookie no caso web; mobile só descarta o token local, já que o JWT é stateless).
- `AuthGuard` (NestJS `CanActivate`) — valida o JWT (assinatura + expiração) em rotas protegidas, popula `request.user` com `{ sub, role, name }`.
- `POST /time-entries` passa a usar o `AuthGuard` e a ler `userId` do `request.user.sub` (JWT), **não mais do corpo da requisição** — o endpoint deixa de confiar no cliente para dizer quem ele é. O `userId` sai do `TimeEntryInputSchema` (`packages/shared-types`); o schema passa a validar só `clockedAt`.

## 4. Web (`apps/web`)

- Nova rota `/login` — uma tela simples com um botão "Entrar", que aponta para `GET {API_URL}/auth/login`.
- `apps/web/src/middleware.ts` (novo) — roda em toda rota sob o `AppShell` (ou seja, todas as rotas exceto `/login`); lê o cookie de sessão, valida o JWT; sem sessão válida, redireciona para `/login`.
- O `AppShell` (`apps/web/src/components/app-shell.tsx`) passa a receber o nome/papel do usuário autenticado (hoje é o texto estático `"RH"`) e ganha um botão/link de logout que chama `POST /auth/logout`.

## 5. Mobile (`apps/mobile`)

- `expo-auth-session` conduz o fluxo OIDC via navegador do sistema (mais seguro que WebView embutida — o app nunca vê a senha do usuário, só o resultado do redirect).
- Nova tela de login (fora do grupo `(tabs)`) — um botão único "Entrar", sem verificação biométrica (consistente com a decisão já registrada na spec funcional).
- Após o retorno do fluxo, o JWT da API é salvo no `expo-secure-store` (armazenamento criptografado do SO — não AsyncStorage puro).
- `apps/mobile/src/app/_layout.tsx` passa a verificar se há sessão salva antes de renderizar o grupo `(tabs)`; sem sessão, renderiza a tela de login.
- A chamada de `POST /time-entries` (tela Ponto) passa a mandar o JWT como header `Authorization: Bearer <token>` e para de mandar `userId` no corpo — alinhado com a mudança de contrato do backend (seção 3).

## 6. Modelo de papéis (RBAC mínimo)

Enum de papel no backend (`packages/shared-types`, para ser o contrato único, mesmo padrão do `TimeEntryInputSchema`): `colaborador | gestor | rh`. O JWT carrega o papel como claim. O mapeamento de claim do IdP (ex: grupo do Entra ID) para esse enum é uma tabela de configuração no módulo `auth`, não lógica espalhada pelo código — trocar o IdP real não deve exigir tocar em nada além dessa tabela.

Este é o conjunto mínimo que já tem UI esperando por ele (mobile = visão de colaborador; sidebar web = visão de gestor/rh). Novos papéis (plantão/campo, novo contratado, administrador de sistema) entram como valores novos do mesmo enum, sem redesenho, quando os fluxos que os usam forem implementados.

## 7. IdP mock para desenvolvimento

Novo serviço `infra/mock-idp/`, ao lado do `infra/docker` já existente — infraestrutura de suporte a dev, não um app de produto. Usa `oidc-provider` (implementação Node do protocolo OIDC real, mesma família de biblioteca do `openid-client` usado na API) rodando numa porta de dev própria (9000), com 3 usuários de teste pré-cadastrados, um por papel:
- `colaborador@dev.local`
- `gestor@dev.local`
- `rh@dev.local`

Senha fixa de desenvolvimento para os três (documentada no README do `infra/mock-idp`, nunca usada fora de dev). A API aponta a config do issuer OIDC para esse mock em desenvolvimento (`.env` local); trocar para o provedor real (Entra ID ou outro, quando a TI confirmar) é mudar a URL do issuer e client ID/secret na config — nenhum código muda.

## 8. Testes

- **API**: Jest cobrindo o módulo `auth` (troca de `code` por tokens, emissão do JWT, resolução de papel a partir da claim do IdP) e o `AuthGuard` protegendo `POST /time-entries`. Os testes sobem o `oidc-provider` mock de `infra/mock-idp` como parte do setup (mesmo padrão que `apps/api/prisma/test.db` já é migrado automaticamente hoje via `pretest`).
- **Web**: Playwright cobrindo o fluxo ponta a ponta — login via mock IdP → cookie de sessão setado → acesso liberado a `/aprovacoes`/`/documentos` → logout → tentativa de acessar rota protegida sem sessão redireciona para `/login`.
- **Mobile**: `@testing-library/react-native` para a tela de login e o gate de sessão em `_layout.tsx` (com o `expo-auth-session` mockado). O fluxo real do `expo-auth-session` (abre o navegador do sistema) não é testável de forma automatizada de forma prática — fica coberto por um roteiro de teste manual documentado no plano de implementação, não por teste automatizado.

## 9. Fora de escopo (referência para o plano de implementação)

- Confirmação do provedor real (Entra ID vs. outro) — decisão da TI, pendente. O módulo é construído para ser agnóstico a isso.
- RBAC granular por campo sensível (CID/médico/CRM) — módulos `documents`/`approvals`, quando existirem.
- Papéis além de `colaborador`/`gestor`/`rh`.
- Refresh token / renovação silenciosa de sessão — o JWT expira e exige novo login; renovação automática é uma melhoria futura, não bloqueante para o MVP.
- Qualquer lógica de negócio dos módulos `leave-requests`, `documents`, `approvals`, `notifications`, `announcements`.
