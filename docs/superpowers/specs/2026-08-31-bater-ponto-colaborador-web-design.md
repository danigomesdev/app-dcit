# Bater ponto — colaborador — Web

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)

## 1. Objetivo e escopo

Hoje toda página do web bloqueia quem tem `role: "colaborador"` — inclusive a home (`/`), que é só o painel de presença da equipe (`PresencePanel`, restrito a gestor/RH). Um colaborador logado no web não consegue fazer nada, nem bater o próprio ponto, apesar de o endpoint (`POST /time-entries`) e a lógica de negócio já existirem e já serem usados pelo mobile.

Esta spec é o primeiro sub-projeto de um portal de autoatendimento do colaborador na web (decisão tomada em conversa: trazer pro web o que hoje só existe no mobile, um pedaço por vez). Fecha o pedaço mais fundamental: bater ponto e ver o resultado imediato — último registro e horas trabalhadas no dia.

Fora de escopo (seção 8 tem a lista completa): histórico de pontos, folha de ponto em PDF, ajuste de ponto, solicitações — cada um vira seu próprio sub-projeto depois.

## 2. Modelo de dados

Nenhuma mudança. `TimeEntry` e os endpoints `POST /time-entries` / `GET /time-entries` já existem e já são usados pelo mobile sem alteração de contrato.

## 3. Backend

Nenhuma mudança. `POST /time-entries` e `GET /time-entries` (`apps/api/src/time-entries/time-entries.controller.ts`) já aceitam qualquer usuário autenticado (`AuthGuard`, sem `RolesGuard`) — nunca foram o motivo do bloqueio, o bloqueio é só do lado do web.

## 4. Web (`apps/web`)

### 4.1 `/` passa a ramificar por role

`apps/web/src/app/(app)/page.tsx`: hoje redireciona `colaborador` para `EmptyState`. Passa a ser:

- `colaborador` → novo `<MeuPontoCard>` (autoatendimento pessoal).
- `gestor` / `rh` → `<PresencePanel>` (painel de equipe), sem nenhuma mudança de comportamento.

Isso espelha o mobile, onde a tela inicial (`(tabs)/index.tsx`) é universal — todo mundo bate o próprio ponto ali, independente da role.

### 4.2 Busca de dados (server component)

`page.tsx`, no branch `colaborador`, busca `GET /time-entries` (retorna todas as entradas do usuário autenticado, ordenadas por `clockedAt` asc — endpoint já existe, não filtra por dia). Filtra as entradas de hoje usando o mesmo critério São Paulo-aware já usado em `escala/page.tsx` e `banco-de-horas/page.tsx` (`todaySaoPauloDateOnly`, copiado localmente no novo arquivo, mesmo padrão de duplicação já estabelecido nesses dois — não em `Date().toISOString().slice(0,10)`, que é UTC-naive e diverge em torno da meia-noite).

Passa as entradas de hoje (e o nome do usuário, via `session.name`) pro client component.

### 4.3 `meu-ponto-card.tsx` (client component)

Mirror do card "Meu ponto" do mobile (`(tabs)/index.tsx`), sem os elementos que não fazem sentido num navegador de mesa (ver seção 8):

- Saudação com o nome do colaborador.
- Botão "Bater Ponto" — chama a server action `punchTimeEntry()` (`actions.ts`, `"use server"`, mesmo padrão de `getAtestadoPhoto` em `documentos/actions.ts`: chamada direta a partir do `onClick`, não via `<form action>`). A action faz `POST /time-entries` e `revalidatePath("/")`; o client component atualiza a lista local com o retorno.
- "Último ponto: HH:mm" (ou "--:--" se não houver registro hoje).
- "Horas trabalhadas hoje: Xh YYmin" — mesmo algoritmo de pareamento sequencial do mobile (`summarizeDay`/`formatMinutes` em `context/ponto-context.tsx`), reimplementado localmente (é ~15 linhas, sem estado — não vale importar entre os dois apps).
- Localização: `navigator.geolocation.getCurrentPosition()` no `useEffect`, não-bloqueante. Sucesso → `"Localização: {lat.toFixed(2)}, {long.toFixed(2)}"`. Erro/negado/API indisponível → `"Localização não disponível"`. Sem geocodificação reversa (decisão tomada em conversa: sem serviço externo, só coordenadas cruas) e sem envio ao servidor — é só um retorno visual pro colaborador, igual ao mobile.

### 4.4 Sem mudança em `nav-links.tsx` / `nav-sections.ts`

O item "Ponto" já existe e já aponta pra `/` — só o conteúdo por trás muda por role, a navegação não muda. `NAV_SECTIONS` (usado pela busca — ver spec anterior desta sessão) continua listando "Ponto" com `roles: ["gestor", "rh"]`; passa a incluir `"colaborador"` também, já que a rota agora serve conteúdo útil pra essa role.

## 5. Mobile

Nenhuma mudança de código.

## 6. Testes

Só e2e (web não tem test runner de unidade, só Playwright, confirmado em `apps/web/package.json`):

- Novo `meu-ponto.spec.ts`: colaborador visita `/`, vê o card (não "Sem permissão"); clica "Bater Ponto"; "Último ponto" atualiza. Duas batidas seguidas fazem "Horas trabalhadas hoje" refletir o intervalo entre elas (mock do relógio via `page.clock` do Playwright, ou duas chamadas reais com uma pequena espera — decisão de implementação, não de design).
- `home.spec.ts` existente não muda — cobre gestor/rh vendo o `PresencePanel`, comportamento inalterado.
- `search.spec.ts` ganha um caso: colaborador buscando "ponto" encontra o resultado (antes, `NAV_SECTIONS` não incluía `colaborador` pra essa entrada).

## 7. Fora de escopo

- Fila offline (mobile guarda batidas localmente quando sem rede e sincroniza depois) — sessão web assume conexão; uma falha de rede no clique mostra erro e deixa o colaborador tentar de novo, sem fila.
- Lembrete push de esquecimento de ponto — mecanismo é Expo push, não existe canal equivalente no web nesta spec.
- Geocodificação reversa (endereço legível) — só coordenadas cruas, decisão tomada em conversa (ver 4.3).
- Histórico de pontos, folha de ponto em PDF, ajustar ponto, solicitações de ajuste — cada um é um sub-projeto próprio do portal do colaborador, com seu próprio ciclo de design.
- Qualquer mudança em como gestor/RH usam `/` — o `PresencePanel` continua exatamente como está.
