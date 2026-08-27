# Escala de Plantão — Ponto DCIT

**Status:** Aprovado para implementação
**Spec funcional de referência:** [`docs/spec-funcional.md`](../../spec-funcional.md) (v2), seção 4.5 ("Escalas de plantão e escala rotativa com calendário claro de quem está de plantão")
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)

## 1. Objetivo e escopo

Substitui o mock hardcoded `PLANTAO_SEMANA` (`apps/mobile/src/lib/operacional.ts`) por uma escala real, persistida e editável. Hoje a tela mobile "Operacional / TI" mostra uma lista fixa de 7 dias, um nome por dia, sem nenhum backend por trás — RH não tem como atualizar isso sem editar código.

Esta spec entrega:
- Persistência real da escala (`PlantaoShift`), com suporte a múltiplos turnos rotulados por dia (ex: "Manhã", "Backup").
- Autoria pelo RH/gestor via web, com navegação entre semanas.
- Consumo real-only pelo mobile (colaborador vê a semana atual, sem editar).

Fora de escopo (ver seção 8 para a lista completa): sobreaviso/deslocamento continuam como estão hoje, independentes da escala; nenhuma automação liga "estar na escala" a "sobreaviso ativo".

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

```prisma
model PlantaoShift {
  id        String   @id @default(uuid())
  date      DateTime // dia (sem hora), armazenado como meia-noite UTC — mesma convenção de VacationRequest.startDate
  label     String   // rótulo livre digitado pelo RH, ex: "Manhã", "Noite", "Backup"
  userId    String
  createdAt DateTime @default(now())
}
```

Uma linha por (dia, turno, pessoa). Editar quem está em um turno é remover a linha e criar outra — não há update in-place, consistente com a interação que a tela web oferece (botão "Remover" + formulário "Adicionar").

## 3. `packages/shared-types`

Novo arquivo `escala.ts`:

```typescript
export const EscalaShiftInputSchema = z.object({
  date: z.string().date(),   // "YYYY-MM-DD", mesma validação de VacationRequestInputSchema
  label: z.string().min(1),
  userId: z.string().min(1),
});
export type EscalaShiftInput = z.infer<typeof EscalaShiftInputSchema>;
```

Exportado de `index.ts` junto com os demais schemas de `solicitacoes`/`atestado-submission`.

## 4. Backend (`apps/api`)

### 4.1 `apps/api/src/operacional` (estende o módulo existente)

`OperacionalService`:
- `listShifts(start: Date, end: Date)`: busca `PlantaoShift` com `date` entre `start` e `end` (inclusive), `orderBy: [{ date: 'asc' }, { label: 'asc' }]`, junta com `Employee` pro nome (reaproveita o padrão `withRequesterNames`-like já usado em `SolicitacoesService` — aqui como um helper local equivalente, já que são módulos diferentes). Retorna `{ id, date, label, userId, userName, createdAt }[]`.
- `createShift(input: EscalaShiftInput)`: `prisma.plantaoShift.create({ data: { date: new Date(input.date), label: input.label, userId: input.userId } })`.
- `deleteShift(id: string)`: `prisma.plantaoShift.delete({ where: { id } })`.

`OperacionalController` ganha:
- `GET /operacional/escala?start=YYYY-MM-DD&end=YYYY-MM-DD` — `AuthGuard` apenas (informação de equipe visível a todo colaborador autenticado, não é dado sensível). Se `start`/`end` vierem ausentes ou inválidos, o controller calcula o padrão: `start` = segunda-feira da semana atual (UTC), `end` = `start + 6 dias`. Nunca retorna 400 por falta desses params — só valida formato quando presentes (se presente e mal formado, aí sim 400 via um schema de query simples).
- `POST /operacional/escala` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')`. Body validado por `EscalaShiftInputSchema`.
- `DELETE /operacional/escala/:id` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')`. `HttpCode(204)`.

### 4.2 `apps/api/src/employees` (novo módulo)

Módulo mínimo, só leitura — expõe o roster de `Employee` pra qualquer tela gestor/RH que precise "escolher uma pessoa" (hoje só a escala, mas é dado mestre reutilizável, não deveria morar dentro de `operacional`).

`EmployeesService.list()`: `prisma.employee.findMany({ orderBy: { name: 'asc' }, select: { userId: true, name: true } })`.

`EmployeesController`: `GET /employees` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')`.

Registrado em `app.module.ts` (`EmployeesModule` nos `imports`).

## 5. Web (`apps/web`)

- Novo item de sidebar em `app-shell.tsx`: `{ href: "/escala", label: "Escala" }`, entre "Ponto" e "Aprovações".
- Nova rota `/escala` (Server Component, mesmo gate de RBAC das outras páginas — `session.role === "colaborador"` → `EmptyState` "Sem permissão").
- Navegação por semana via query string: `/escala?start=2026-08-31` (segunda-feira daquela semana). Sem `start` na URL, usa a segunda-feira da semana atual. Botões "← Semana anterior" / "Próxima semana →" linkam pra `start ± 7 dias`. Cabeçalho mostra o intervalo formatado, ex: "01/09 a 07/09/2026".
- Busca `GET /operacional/escala?start=...&end=...` (a semana calculada) e `GET /employees` em paralelo.
- 7 seções (Segunda a Domingo), cada uma:
  - lista os turnos já atribuídos naquele dia (`{label}: {userName}`), cada um com um botão "Remover" (Server Action, `DELETE /operacional/escala/:id`, `revalidatePath` na página).
  - formulário "Adicionar turno": campo de texto pro rótulo + `<select>` com os funcionários (de `GET /employees`) + botão "Adicionar" (Server Action, `POST /operacional/escala` com o `date` daquele dia fixo, `revalidatePath`).
- Dia sem nenhum turno mostra só o formulário de adicionar, sem lista.

## 6. Mobile (`apps/mobile`)

- `apps/mobile/src/lib/operacional-api.ts` ganha `fetchEscala(token, start, end): Promise<EscalaShift[] | null>`, mesmo padrão de `fetchDeslocamentos` (`authedFetch` + type guard + `catch → null`). `EscalaShift = { id, date, label, userId, userName }`.
- `apps/mobile/src/lib/operacional.ts` perde `PLANTAO_SEMANA` (mock removido); mantém `formatElapsed`.
- `operacional.tsx`: calcula segunda a domingo da semana atual (`Date` local do dispositivo), busca via `fetchEscala` no mesmo `useFocusEffect` que já busca sobreaviso/deslocamentos, agrupa os turnos retornados por `date`. Card "Escala de plantão desta semana" passa a iterar os 7 dias e, pra cada um, listar `{label}: {userName}` de cada turno (ou nada, se o dia não tiver turno — sem texto de estado vazio por dia, pra não poluir a tela com 7 "sem turno" repetidos).

## 7. Testes

Segue exatamente o padrão já estabelecido nesta sessão para os módulos anteriores (Aprovações, Ponto dos funcionários, Documentos):

- **`shared-types`**: teste do `EscalaShiftInputSchema` (aceita data válida, rejeita datetime completo, rejeita label/userId vazio) — mesmo estilo de `solicitacoes.test.ts`.
- **API**: Jest cobrindo `OperacionalService` (listShifts filtra por intervalo e junta nome; createShift; deleteShift) e `OperacionalController`/`EmployeesController` (guard metadata AuthGuard+RolesGuard gestor/rh nos endpoints de escrita e no roster; AuthGuard-only no GET de escala).
- **Web**: Playwright via `fake-api-server.mjs` estendido pra servir `/operacional/escala` e `/employees` — cobre RBAC, navegação de semana (troca a URL, refaz a busca), adicionar e remover turno.
- **Mobile**: atualiza `apps/mobile/src/__tests__/app/operacional.test.tsx` pra mockar `fetchEscala` em vez de depender do mock estático.

## 8. Fora de escopo (referência para o plano de implementação)

- Sobreaviso e deslocamento — continuam exatamente como estão, sem nenhuma ligação com a escala.
- Qualquer automação que ative sobreaviso automaticamente com base em estar escalado.
- Edição in-place de um turno (trocar só o nome sem remover/recriar) — a interação é sempre remover + adicionar.
- Múltiplas unidades/filiais ou parametrização por CNPJ (mencionado na spec funcional seção 5, mas não é o gap identificado aqui).
- Notificação push quando uma escala é publicada ou alterada — pode ser um follow-up natural, mas não foi pedido.
