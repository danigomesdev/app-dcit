# Alertas de Jornada (Intrajornada/Interjornada) — Ponto DCIT

**Status:** Aprovado para implementação
**Spec funcional de referência:** [`docs/spec-funcional.md`](../../spec-funcional.md) (v2), seção 7 ("Conformidade Legal (Brasil)": "Intervalo interjornada e intrajornada: o sistema deve identificar e alertar violações automaticamente")
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)

## 1. Objetivo e escopo

Hoje o sistema registra batidas de ponto (`TimeEntry`) mas não avalia se os intervalos de descanso exigidos pela CLT foram respeitados. Esta spec entrega detecção automática de duas violações, no momento em que a batida é registrada (sem job agendado — a API não tem infraestrutura de cron hoje, e detectar na hora é mais simples e mais útil que um scan noturno):

- **Interjornada** (CLT Art. 66): mínimo de 11h de descanso entre o fim de um dia de trabalho e o início do próximo.
- **Intrajornada** (CLT Art. 71): mínimo de 1h de intervalo (almoço) dentro do dia.

Cada violação detectada:
- fica registrada (nova tabela `JornadaAlert`), visível para **gestor/RH** (lista da equipe inteira, nova página web) e para o **colaborador afetado** (só as próprias, na tela mobile de Notificações já existente);
- dispara uma notificação push imediata para o colaborador (reaproveita `ExpoPushService`, mesmo padrão já usado em `SolicitacoesService`).

Simplificação assumida (ver seção 8): a regra de intrajornada usa sempre o mínimo de 1h, sem tratar a exceção legal que dispensa ou reduz esse intervalo em jornadas de até 6h.

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

```prisma
model JornadaAlert {
  id           String   @id @default(uuid())
  userId       String
  type         String   // "intrajornada" | "interjornada"
  date         DateTime // dia (São Paulo, meia-noite UTC) a que a violação se refere
  minutesShort Int      // quantos minutos faltaram pro mínimo exigido
  createdAt    DateTime @default(now())
}
```

Uma linha por violação detectada. Sem update in-place e sem soft delete — é um registro histórico, não um estado editável.

## 3. `packages/shared-types`

Nenhuma mudança. Não há payload submetido pelo cliente para validar aqui — as duas violações são inteiramente derivadas no servidor a partir de `TimeEntry`, não de um formulário. Os endpoints novos são só leitura.

## 4. Backend (`apps/api`)

### 4.1 Novo módulo `apps/api/src/alertas`

`AlertasService`:

- `checkAfterPunch(userId: string, newEntry: { id: string; clockedAt: Date })`, chamado por `TimeEntriesService.create()` logo após persistir a batida:
  - Conta quantas batidas esse usuário já tem hoje (dia São Paulo, mesma janela `startOfDay`/`endOfDay` de `TimeEntriesService.listTeamToday`) **antes** desta nova batida.
  - Se for a **1ª batida do dia** (0 anteriores): busca a batida imediatamente anterior de todo o histórico do usuário (`clockedAt < newEntry.clockedAt`, `orderBy: desc`, `take: 1`). Se existir e o intervalo for menor que 660 minutos (11h), cria `JornadaAlert` (`type: "interjornada"`, `date` = hoje, `minutesShort` = `660 - intervalo`).
  - Se for a **3ª batida do dia** (2 anteriores — volta do almoço): compara com a 2ª batida do dia (saída pro almoço). Se o intervalo for menor que 60 minutos, cria `JornadaAlert` (`type: "intrajornada"`, `date` = hoje, `minutesShort` = `60 - intervalo`).
  - Batidas 2ª e 4ª do dia: nenhuma checagem (2ª é a própria saída pro almoço, nada pra comparar ainda; 4ª fecha o dia e já foi coberta pela checagem da 3ª).
  - Sempre que uma violação é criada, `void this.push.sendToUser(userId, { title, body })` — título/corpo diferentes por tipo (ex: "Intervalo entre turnos" / "Intervalo de almoço").
- `listForUser(userId: string)`: todas as violações do usuário, `orderBy: { createdAt: 'desc' }`.
- `listAll()`: todas as violações de todos os usuários, juntadas com nome do `Employee` (mesmo padrão `nameByUserId` já usado em `SolicitacoesService.withRequesterNames`/`OperacionalService.listAllDeslocamentos`), `orderBy: { createdAt: 'desc' }`.

`AlertasController`:
- `GET /alertas/minhas` — `AuthGuard` apenas. Retorna `listForUser(req.user.sub)`.
- `GET /alertas` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')`. Retorna `listAll()`.

`AlertasModule`: `imports: [AuthModule, PushModule]`, `exports: [AlertasService]` (precisa ser injetável em `TimeEntriesModule`).

### 4.2 `apps/api/src/time-entries` (estende o módulo existente)

- `TimeEntriesModule` passa a importar `AlertasModule`.
- `TimeEntriesService` ganha `private readonly alertas: AlertasService` no construtor.
- `create()` passa a `await this.alertas.checkAfterPunch(input.userId, created)` logo após `prisma.timeEntry.create(...)`, antes de retornar. A marcação de ponto em si nunca falha por causa disso — `checkAfterPunch` só lê e opcionalmente grava um alerta, não lança exceção que bloqueie a resposta do punch.

## 5. Web (`apps/web`)

- Novo item em `apps/web/src/components/nav-links.tsx`: `{ href: "/alertas", label: "Alertas" }`, depois de "Operacional".
- Nova rota `/alertas` (Server Component), mesmo gate de RBAC das outras páginas administrativas: `session.role === "colaborador"` → `EmptyState` "Sem permissão".
- Busca `GET /alertas`. Lista simples (mesmo estilo visual de Aprovações/Operacional): nome do colaborador, tipo (rótulo amigável: "Intervalo entre turnos" / "Intervalo de almoço"), data formatada (`toLocaleDateString("pt-BR")`, UTC — mesma convenção das outras páginas de data-only), minutos que faltaram.
- Lista vazia: `EmptyState` "Nenhum alerta de intervalo registrado."

## 6. Mobile (`apps/mobile`)

- Novo `apps/mobile/src/lib/alertas-api.ts`: `fetchJornadaAlerts(token): Promise<JornadaAlertRecord[] | null>`, mesmo padrão de `fetchOnboardingTasks`/`fetchEscala` (`authedFetch` + type guard + `catch → null`).
- `apps/mobile/src/app/notificacoes.tsx`: o `useFocusEffect` existente passa a também chamar `fetchJornadaAlerts`; cada alerta retornado vira um `Notice` na lista já existente (tone `"accent"`, ícone de aviso), com título conforme o tipo e descrição citando a data e quantos minutos faltaram.
- A notificação push em si não precisa de nenhum código novo no mobile — já é entregue pela infraestrutura de push existente (mesmo canal usado hoje pelas solicitações aprovadas/recusadas).

## 7. Testes

Mesmo padrão já estabelecido nas specs anteriores (Escala de Plantão, Cadastro de Colaborador):

- **API**: Jest cobrindo `AlertasService.checkAfterPunch` (cria interjornada quando o intervalo desde a última batida é menor que 11h na 1ª batida do dia; não cria quando ≥11h; cria intrajornada quando a volta do almoço é menor que 1h na 3ª batida do dia; não cria quando ≥1h; não cria nada nas batidas 2ª/4ª; dispara push quando cria), `listForUser`/`listAll` (junta nome, ordena por mais recente), `AlertasController` (guard metadata: `/alertas/minhas` só `AuthGuard`; `/alertas` `AuthGuard`+`RolesGuard` gestor/rh), e `TimeEntriesService.create` (integração: chama `alertas.checkAfterPunch` com o `userId`/entry certos — via mock, mesmo padrão de `pushMock` já usado em `solicitacoes.service.spec.ts`).
- **Web**: Playwright via `fake-api-server.mjs` estendido pra servir `GET /alertas` — cobre RBAC (colaborador bloqueado) e a listagem para gestor/rh.
- **Mobile**: `notificacoes.test.tsx` passa a mockar `fetchJornadaAlerts` e verifica que o aviso aparece na lista de notificações.

## 8. Fora de escopo (referência para o plano de implementação)

- Exceção legal de jornadas ≤6h que dispensa ou reduz o intervalo intrajornada — assume-se sempre o mínimo de 1h.
- Configuração dos limites (11h/1h) por convenção coletiva/CNPJ — é o próximo dos três itens pendentes da spec funcional, tratado em spec separada.
- Qualquer bloqueio da batida de ponto por causa de uma violação — bater ponto nunca falha ou é condicionado a isso, consistente com o princípio "nunca bloqueante" da spec funcional (seção 2).
- Justificativa/correção da violação pelo colaborador — o fluxo de "Ajuste de ponto" já existente em Aprovações cobre correções de ponto em geral; não é redesenhado aqui.
- Recomputar violações retroativamente para batidas já existentes antes desta feature — só passa a detectar a partir de quando o código entrar em produção.
- Geração de AFD e regras de hora extra/DSR/banco de horas parametrizáveis — os outros dois itens pendentes, cada um com sua própria spec.
