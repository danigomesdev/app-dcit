# Mapa de Presença (Painel do Gestor) — Ponto DCIT

**Status:** Aprovado para implementação
**Spec funcional de referência:** [`docs/spec-funcional.md`](../../spec-funcional.md) (v2), seção 4.2 ("Mapa de presença ao vivo: quem está trabalhando, em pausa, de folga ou atrasado")
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)

## 1. Objetivo e escopo

Hoje a home do portal gestor/RH (`apps/web/src/app/(app)/page.tsx`) já mostra uma lista de colaboradores com três estados derivados de `TimeEntry`: "Presente" (marcações ímpares), "Não presente" (marcações pares) e "Sem registro hoje". Esta spec evolui essa lista para o painel de presença descrito na spec funcional, com sete estados:

- **Trabalhando** — dentro do expediente (marcações ímpares).
- **Em pausa** — no intervalo de almoço (exatamente 2 marcações).
- **Atrasado** — sem nenhuma marcação, e já passou do horário esperado de entrada + tolerância.
- **De folga** — hoje é sábado ou domingo.
- **Férias** — férias aprovadas cobrindo hoje, com data de início e retorno.
- **Atestado** — atestado aprovado cobrindo hoje, com data de início e retorno.
- **Não presente** — 4+ marcações (dia encerrado) ou nenhuma marcação sem horário esperado definido/sem ter passado da tolerância (mesmo rótulo neutro que "Sem registro" usa hoje).

O painel se atualiza sozinho a cada 60s (client-side), sem exigir reload manual.

Isto é a primeira de duas entregas do módulo "Portal do gestor" da spec funcional (seção 4.2); **alertas preventivos automáticos** (violação de interjornada, excesso de horas extras, férias vencendo, divergência de geolocalização) ficam para uma spec separada — ver seção 7.

Pré-requisito novo: cadastro de horário esperado de entrada por colaborador, que hoje não existe em lugar nenhum do sistema.

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

```prisma
model Employee {
  userId            String   @id
  name              String
  role              String
  hireDate          DateTime
  expectedStartTime String?  // "HH:mm", 24h, fuso do servidor. null = colaborador nunca aparece como "Atrasado".
}
```

Migração Prisma adiciona a coluna `expectedStartTime` (nullable, sem default) — colaboradores existentes ficam `null` até RH preencher.

Nenhuma outra tabela muda. `VacationRequest` (`startDate`, `endDate`, `status`) e `Atestado` (`createdAt`, `dias`, `status`) já têm o necessário — ver seção 4.2 para como o período do atestado é derivado.

## 3. `packages/shared-types`

Novo arquivo `employee-schedule.ts`:

```typescript
export const EmployeeScheduleUpdateSchema = z.object({
  expectedStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable(),
});
export type EmployeeScheduleUpdate = z.infer<typeof EmployeeScheduleUpdateSchema>;
```

Exportado de `index.ts` junto com os demais schemas.

## 4. Backend (`apps/api`)

### 4.1 `apps/api/src/employees` (estende o módulo existente)

`EmployeesService` ganha:
- `list()` — passa a `select` incluir `expectedStartTime`.
- `updateSchedule(userId: string, input: EmployeeScheduleUpdate)`: `prisma.employee.update({ where: { userId }, data: { expectedStartTime: input.expectedStartTime } })`.

`EmployeesController` ganha:
- `PATCH /employees/:userId` — `AuthGuard, RolesGuard`, `@Roles('rh')` (só RH edita dado cadastral; gestor continua só leitura, mesmo padrão de `GET /employees`). Body validado por `EmployeeScheduleUpdateSchema`, 400 em `ParseError`.

### 4.2 `apps/api/src/time-entries` (estende `listTeamToday`)

`TimeEntriesService.listTeamToday()` passa a:

1. Buscar, além dos `employees` e `entries` de hoje que já busca: `VacationRequest` com `status: 'aprovado'` e `startDate <= hoje <= endDate`; `Atestado` com `status: 'aprovado'` e `createdAt <= hoje` (filtro fino de "cobre hoje" é feito em memória, ver abaixo, já que `dias` não é uma coluna de data).
2. Calcular `todayKey`/`startOfDay`/`endOfDay` como já faz hoje (UTC, mesma convenção do resto do arquivo).
3. Para cada colaborador, aplicar esta ordem de prioridade (primeira que casar decide o status):
   1. `new Date(startOfDay).getUTCDay()` é 0 (domingo) ou 6 (sábado) → `status: 'folga'`.
   2. Existe `VacationRequest` aprovada com `startDate <= startOfDay <= endDate` → `status: 'ferias'`, `periodStart: startDate`, `periodEnd: endDate`.
   3. Existe `Atestado` aprovado onde `createdAt` (truncado pro dia) `<= startOfDay` e `startOfDay < createdAt + dias dias` → `status: 'atestado'`, `periodStart` = `createdAt` truncado, `periodEnd` = `periodStart + dias` (primeiro dia de volta ao trabalho).
   4. `dayEntries.length >= 4` → `status: 'nao_presente'`.
   5. `dayEntries.length` ímpar (1 ou 3) → `status: 'trabalhando'`.
   6. `dayEntries.length === 2` → `status: 'pausa'`.
   7. `dayEntries.length === 0`:
      - Se `employee.expectedStartTime` definido e `agora > startOfDay + expectedStartTime + 10min` → `status: 'atrasado'`.
      - Senão → `status: 'sem_registro'`.
4. Resposta por colaborador: `{ userId, name, entries, workedMinutes, status, periodStart?, periodEnd? }` (`periodStart`/`periodEnd` só presentes para `ferias`/`atestado`; `isOpen` sai do payload, substituído por `status`).

`workedMinutes` continua exatamente como hoje (soma de pares de marcações).

Sem mudança na rota — continua `GET /time-entries/team`, `AuthGuard + RolesGuard('gestor', 'rh')`.

## 5. Web (`apps/web`)

### 5.1 Nova rota `/colaboradores` (RH)

- Novo item de sidebar em `nav-links.tsx`: `{ href: "/colaboradores", label: "Colaboradores" }`, entre "Ponto" e "Escala".
- Server Component, gate `session.role !== "rh"` → `EmptyState` "Sem permissão" (mais restrito que o padrão `=== "colaborador"` das outras páginas — aqui é dado cadastral, só RH edita).
- Busca `GET /employees` (agora traz `expectedStartTime`).
- Lista de colaboradores, cada linha com um `<input type="time">` (valor atual ou vazio) + botão "Salvar", num `<form>` por linha.
- `actions.ts` (`"use server"`), padrão idêntico a `escala/actions.ts`: `updateSchedule(formData)` lê `userId`/`expectedStartTime`, valida formato antes de chamar `apiFetch(PATCH /employees/:userId)`; erro de validação (400 da API) é capturado e devolvido como mensagem inline via `useActionState` (primeira vez que a tela usa esse padrão no app — as telas existentes de Server Action só fazem `throw` porque não precisam mostrar erro inline; aqui precisamos, já que o formato `HH:mm` pode ser digitado errado). Em sucesso, `revalidatePath("/colaboradores")` e `revalidatePath("/")` (pro painel de presença refletir o novo horário na próxima leitura).

### 5.2 Painel de presença (home)

A home (`apps/web/src/app/(app)/page.tsx`) deixa de renderizar a lista diretamente e passa a:
- Continuar Server Component, buscando `GET /time-entries/team` só para o **primeiro render** (evita tela vazia até o primeiro poll do cliente).
- Delegar a renderização pra um novo Client Component, `presence-panel.tsx`, recebendo os dados iniciais via prop.

`presence-panel.tsx` (`"use client"`):
- Mantém o array de colaboradores em `useState`, inicializado com a prop do servidor.
- `useEffect` com `setInterval(60000)` chamando `fetch("/api/team-presence")`; em sucesso, `setState` com o novo array; em falha (rede ou status não-2xx), **não** atualiza o estado — o painel continua mostrando os últimos dados válidos, sem indicador de erro bloqueante (silencioso, mesmo espírito do padrão já usado em `expo-push.service.ts` no backend para push best-effort).
- Renderiza cada colaborador com rótulo + cor por `status`. Mesma cor cinza/neutra para `folga`, `sem_registro` e `nao_presente`, mas com textos distintos — cor não implica texto compartilhado:

  | `status` | Cor | Texto exibido |
  |---|---|---|
  | `trabalhando` | verde | "Trabalhando" |
  | `pausa` | amarelo | "Em pausa" |
  | `atrasado` | vermelho | "Atrasado" |
  | `folga` | cinza | "De folga" |
  | `sem_registro` | cinza | "Sem registro" |
  | `nao_presente` | cinza | "Não presente" |
  | `ferias` | azul | "Férias" + `periodStart`–`periodEnd` formatados |
  | `atestado` | roxo | "Atestado" + `periodStart`–`periodEnd` formatados |

Novo arquivo `apps/web/src/app/api/team-presence/route.ts` — primeira Route Handler do app. Necessário porque o Client Component não pode chamar a API do NestJS diretamente: o JWT vive num cookie `httpOnly` (só o servidor Next.js lê, via `apiFetch` em `lib/api.ts`), então o proxy precisa rodar no servidor Next.js. `GET` handler: chama `apiFetch("/time-entries/team")` (reaproveita a função existente, mesmo forward de `Authorization: Bearer`) e repassa o JSON/status. Sem lógica própria além do repasse.

`ponto.module.css` ganha as classes de status novas (`statusPausa`, `statusAtrasado`, `statusFolga`, `statusFerias`, `statusAtestado`), ao lado das três que já existem.

## 6. Testes

- **`shared-types`**: teste do `EmployeeScheduleUpdateSchema` (aceita `"09:00"`, rejeita `"9:00"`, `"24:00"`, string vazia; aceita `null`).
- **API**:
  - `EmployeesService`/`EmployeesController`: `updateSchedule` persiste o campo; `PATCH` exige role `rh` (403 pra `gestor` e `colaborador`); 400 em corpo inválido.
  - `TimeEntriesService.listTeamToday`: um teste por ramo de prioridade (fim de semana, férias cobrindo hoje, férias não aprovada não conta, atestado cobrindo hoje, atestado no último dia do período ainda conta/no dia seguinte não conta mais, 4 marcações, 1/3 marcações, 2 marcações, 0 marcações com atraso, 0 marcações sem `expectedStartTime`, 0 marcações dentro da tolerância de 10min).
- **Web**: Playwright via `fake-api-server.mjs`, estendido pra servir `/employees` (com `expectedStartTime`), `PATCH /employees/:userId`, e `/api/team-presence` (a nova Route Handler é testada como qualquer outra rota — a suíte já sobe o Next.js app):
  - `/colaboradores`: RBAC (403 visual pra gestor/colaborador), salvar horário válido, erro inline em horário inválido.
  - Home: cada status renderiza rótulo/cor esperados a partir de fixtures do `fake-api-server`; teste de polling usa fixture que muda de resposta entre a primeira chamada e a segunda, avança o tempo (`page.clock` do Playwright) 60s, confirma que o painel atualiza; um teste separado faz a segunda chamada falhar (500) e confirma que os dados da primeira chamada continuam na tela.

## 7. Fora de escopo (referência para o plano de implementação)

- Os quatro alertas preventivos automáticos (interjornada, excesso de horas extras, férias vencendo, divergência de geolocalização) — spec própria, a ser escrita depois desta.
- Captura de geolocalização na marcação de ponto — pré-requisito de um dos alertas acima, não desta entrega.
- Qualquer tratamento especial para mais de 4 marcações num dia (ajuste manual gerando uma 5ª+ marcação) — mantém o comportamento par/ímpar de hoje, sem novo estado.
- Edição em massa de horário esperado (import CSV, etc.) — só edição individual via `/colaboradores`.
- Notificação push quando um colaborador é marcado como atrasado — pode ser um follow-up natural do trabalho de alertas (seção acima), não desta spec.
- Múltiplas unidades/filiais ou parametrização de tolerância por CNPJ/convenção coletiva (spec funcional seção 5) — tolerância de 10min fica fixa no código por enquanto.
