# Banco de Horas Real — Ponto DCIT

**Status:** Aprovado para implementação
**Spec funcional de referência:** [`docs/spec-funcional.md`](../../spec-funcional.md) (v2), seção 7 ("CLT — cálculo de horas extras, DSR e banco de horas: as regras de cálculo devem ser parametrizáveis por convenção coletiva/acordo da empresa")
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec da qual esta depende (já implementada):** [`2026-08-29-convencoes-coletivas-design.md`](2026-08-29-convencoes-coletivas-design.md) — entrega `ConvencaoColetiva` e `Employee.salarioMensal`/`.convencaoId`, que esta spec finalmente usa para calcular algo de verdade.

## 1. Objetivo e escopo

Hoje o "banco de horas" só existe no mobile (`apps/mobile/src/lib/banco-de-horas.ts`) e é inteiramente fabricado: jornada esperada fixa em 8h/dia, valor-hora fixo em R$ 35, e — pior — quando um dia não tem nenhuma batida real, o código *inventa* um número plausível de horas trabalhadas (`seededWorkedMinutes`/`pseudoRandom`) só para a tela nunca parecer vazia. Esta spec substitui isso por um cálculo real, no backend, usando dados que já existem: batidas de ponto (`TimeEntry`), a convenção coletiva do colaborador (jornada esperada, percentual de hora extra) e o salário mensal.

Entrega:
- Motor de cálculo no backend (`apps/api/src/banco-de-horas`) que computa, por dia e por período, horas esperadas/trabalhadas/diferença, saldo, DSR estimado e valor de hora extra em R$.
- Endpoint de autoatendimento (`GET /banco-de-horas/minhas`) consumido pela tela mobile já existente, substituindo o cálculo local fabricado.
- Endpoint e página web novos (`GET /banco-de-horas/equipe`, `/banco-de-horas`) para gestor/RH verem o saldo da equipe — mesmo padrão já estabelecido para Alertas.

Mudança de comportamento deliberada: um dia sem nenhuma batida real agora conta como falta total daquele dia (diferença 100% negativa), em vez de receber um valor inventado. Isso é o ponto central de "tornar real" — não existe mais dado fabricado escondendo a ausência de registro.

Fora de escopo (seção 8 tem a lista completa): cálculo oficial de folha de pagamento, feriados regionais, hora extra diferenciada por domingo/feriado, navegação por período na visão de equipe (semana a semana como a Escala tem) — a visão de equipe mostra sempre o mês atual.

## 2. Modelo de dados

Nenhuma mudança. Este recurso é inteiramente derivado, na hora da leitura, a partir de `TimeEntry`, `Employee` (`convencaoId`, `salarioMensal`) e `ConvencaoColetiva` — todos já existentes. Sem nova tabela, sem job agendado (mesmo raciocínio de Alertas de Jornada: esta API não tem infraestrutura de cron, e "derivar na leitura" já é o padrão estabelecido no resto do sistema, incluindo `TimeEntriesService.listTeamToday`, cuja lógica de parear batidas sequenciais esta spec reaproveita).

## 3. `packages/shared-types`

Nenhuma mudança. Os dois endpoints novos são GET, sem payload de cliente para validar — mesmo raciocínio de Alertas de Jornada.

## 4. Backend (`apps/api`)

### 4.1 Novo módulo `apps/api/src/banco-de-horas`

Constantes do módulo (sem convenção atribuída, ou convenção que não resolve — mesmo comportamento "sem convenção" já definido em `2026-08-29-convencoes-coletivas-design.md` §8):

```typescript
const DEFAULT_EXPECTED_DAILY_MINUTES = 480; // 8h — mesma suposição que o mock atual já fazia
const DEFAULT_OVERTIME_PERCENT = 0; // sem convenção, não presumimos nenhum percentual legal de acréscimo
const AVERAGE_BUSINESS_DAYS_PER_MONTH = 22; // aproximação padrão pra converter salário mensal em valor-hora
```

`BancoDeHorasService`:

- `getSummary(userId: string, start: Date, end: Date)`:
  1. Busca o `Employee` (`convencaoId`, `salarioMensal`) e, se `convencaoId` existir, a `ConvencaoColetiva` correspondente (`expectedDailyMinutes`, `overtimePercent`) — se o id não resolver (convenção excluída), trata como se não tivesse convenção, sem lançar erro.
  2. Busca todas as `TimeEntry` do usuário no intervalo `[start, end]`, ordenadas por `clockedAt`.
  3. Agrupa as batidas por dia (usando `dateOnlyInSaoPaulo`, mesma função já usada em `apps/api/src/alertas/alertas.service.ts` e `apps/api/src/common/sao-paulo-time.ts`) e pareia batidas sequenciais como turno (entrada/saída), mesma lógica de `TimeEntriesService.listTeamToday` (par `(0,1)`, `(2,3)`, ...) — soma os minutos trabalhados por dia.
  4. Pra cada dia do intervalo (incluindo dias sem nenhuma batida, que ficam com `workedMinutes: 0`): `expectedMinutes` = 0 se for fim de semana (`isWeekend` de `sao-paulo-time.ts`), senão o `expectedDailyMinutes` da convenção (ou o default). `diffMinutes = workedMinutes - expectedMinutes`. Nenhum fallback fabricado — um dia sem batida é um dia com `workedMinutes: 0`, ponto final.
  5. Agrega: `balanceMinutes` = soma de `diffMinutes` de todos os dias; `overtimeMinutes` = soma de `diffMinutes` positivos; `dsrMinutes` — mesma fórmula proporcional já usada no mock (`workedDays` = dias com `expectedMinutes > 0 && workedMinutes > 0`; `restDays` = dias com `expectedMinutes === 0`; se não houver dias trabalhados ou `overtimeMinutes` for 0, retorna 0; senão `Math.round((overtimeMinutes / workedDays.length) * restDays)`).
  6. `hourlyRateBRL` = `salarioMensal / ((expectedDailyMinutes / 60) * AVERAGE_BUSINESS_DAYS_PER_MONTH)`, ou `null` se `salarioMensal` for `null` (colaborador sem salário cadastrado — RH ainda não preencheu).
  7. `overtimeValueBRL` = `(overtimeMinutes / 60) * hourlyRateBRL * (1 + overtimePercent / 100)`, arredondado a 2 casas — ou `null` se `hourlyRateBRL` for `null` (não fabrica um valor com taxa inventada; a tela mostra "—").
  8. Retorna `{ days: { date, expectedMinutes, workedMinutes, diffMinutes }[], balanceMinutes, dsrMinutes, hourlyRateBRL, overtimeValueBRL }`.

- `getTeamSummary(start: Date, end: Date)`: pra cada `Employee` ativo (`deletedAt: null`), roda o mesmo cálculo de `getSummary` (sem o array `days`, só os agregados) e junta com o nome — retorna `{ userId, userName, balanceMinutes, dsrMinutes, hourlyRateBRL, overtimeValueBRL }[]`, ordenado por nome.

`BancoDeHorasController`:
- `GET /banco-de-horas/minhas?start=YYYY-MM-DD&end=YYYY-MM-DD` — `AuthGuard` apenas. Se `start`/`end` ausentes ou mal formados, usa o padrão: `start` = primeiro dia do mês corrente (São Paulo), `end` = hoje (São Paulo) — mesmo espírito de default gentil que `GET /operacional/escala` já tem, mas aqui sempre até hoje (não faz sentido pedir banco de horas de dias futuros). Retorna `getSummary(req.user.sub, start, end)`.
- `GET /banco-de-horas/equipe?start=YYYY-MM-DD&end=YYYY-MM-DD` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')`. Mesmo default de intervalo. Retorna `getTeamSummary(start, end)`.

`BancoDeHorasModule`: `imports: [AuthModule]`, registrado em `app.module.ts`.

## 5. Web (`apps/web`)

- Novo item em `nav-links.tsx`: `{ href: "/banco-de-horas", label: "Banco de Horas" }`, depois de "Convenções" (última posição).
- Nova rota `/banco-de-horas` (Server Component), gate de RBAC igual ao de Alertas: `session.role === "colaborador"` → `EmptyState` "Sem permissão" (gestor e RH veem).
- Busca `GET /banco-de-horas/equipe` (sem parâmetros — usa o padrão "mês corrente" do backend). Lista simples (mesmo estilo de Alertas/Operacional): nome do colaborador, saldo formatado (`±Xh Ymin`), DSR estimado, valor de hora extra em R$ (ou "—" se `null`).
- Sem navegação por período nesta versão — sempre mostra o mês corrente, mesmo padrão simples da lista de Alertas.

## 6. Mobile (`apps/mobile`)

### 6.1 `apps/mobile/src/lib/banco-de-horas-api.ts` (novo)

`fetchBancoDeHoras(token, start, end): Promise<BancoDeHorasSummary | null>`, mesmo padrão de `fetchOnboardingTasks`/`fetchEscala` (`authedFetch` local + type guard + `catch → null`).

```typescript
export type BancoDeHorasDay = {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  diffMinutes: number;
};

export type BancoDeHorasSummary = {
  days: BancoDeHorasDay[];
  balanceMinutes: number;
  dsrMinutes: number;
  hourlyRateBRL: number | null;
  overtimeValueBRL: number | null;
};
```

### 6.2 `apps/mobile/src/lib/banco-de-horas.ts` (drasticamente reduzido)

Remove: `EXPECTED_MINUTES_WEEKDAY`, `HOURLY_RATE_BRL`, `pseudoRandom`, `seededWorkedMinutes`, `expectedMinutesFor`, `buildDailyRecords`, `cumulativeBalance`, `estimateDsrMinutes`, `estimateOvertimeValueBRL`, o tipo local `DailyRecord` — tudo isso vem da API agora.

Mantém (puras funções de formatação/data, sem nenhuma suposição de jornada/valor): `formatSignedMinutes`, `formatBRL`, `startOfMonth`, `endOfMonth` — `startOfMonth`/`endOfMonth` continuam necessárias porque a tela ainda precisa calcular *qual janela pedir* à API (o filtro "Mês atual"/"Mês passado"/"Últimos 3 meses" continua existindo, só que agora define os parâmetros `start`/`end` de uma chamada à API em vez de filtrar um array local).

### 6.3 `apps/mobile/src/app/(tabs)/banco-de-horas.tsx`

Troca as três chamadas locais a `buildDailyRecords` (gráfico de 30 dias, saldo de 90 dias, período selecionado) por três chamadas a `fetchBancoDeHoras` dentro do `useFocusEffect` já existente (mesmo `useCallback`/cleanup pattern que a tela já usa pra buscar `compensationRequests`). Cada uma vira um `BancoDeHorasSummary | null` em estado local; enquanto a busca do período selecionado não voltou, a lista diária/insights mostram um estado de carregamento simples (texto "Carregando…", sem spinner novo — consistente com a simplicidade das outras telas).

`usePonto()` deixa de ser usado nesta tela (os dados vêm da API, não do contexto local de batidas) — remove o import se não sobrar nenhum outro uso.

O texto de disclaimer atual ("Estimativas ilustrativas com jornada padrão de 8h/dia e valor-hora fixo — não substituem o cálculo oficial da folha.") muda pra refletir que agora é cálculo real: "Cálculo baseado nos seus registros de ponto e nos parâmetros da sua convenção coletiva — não substitui o cálculo oficial da folha."

Quando `overtimeValueBRL`/`hourlyRateBRL` vierem `null` (sem salário cadastrado), o card "Extras em R$" mostra "—" em vez de `formatBRL(0)`.

## 7. Testes

Mesmo padrão já estabelecido nas specs anteriores desta sessão:

- **API**: Jest cobrindo `BancoDeHorasService.getSummary` (dia sem batida = falta total, sem fabricar dado; par de batidas sequenciais soma corretamente; fim de semana tem `expectedMinutes: 0`; sem convenção usa os defaults; convenção com id não resolvível é tratada como sem convenção; `hourlyRateBRL`/`overtimeValueBRL` `null` quando não há salário; DSR e valor de hora extra batem com a fórmula) e `getTeamSummary` (agrega vários colaboradores, ordena por nome). `BancoDeHorasController` (guard metadata: `/minhas` só `AuthGuard`; `/equipe` `AuthGuard`+`RolesGuard` gestor/rh; default de intervalo quando `start`/`end` ausentes).
- **Web**: Playwright via `fake-api-server.mjs` estendido pra servir `GET /banco-de-horas/equipe` — cobre RBAC (colaborador bloqueado) e a listagem pra gestor/rh, incluindo o caso `overtimeValueBRL: null` mostrando "—".
- **Mobile**: `apps/mobile/src/__tests__/lib/banco-de-horas.test.ts` perde os testes das funções removidas, ganha (se sobrar lógica não trivial) testes das funções de formatação que restaram. `apps/mobile/src/__tests__/app/(tabs)/banco-de-horas.test.tsx` passa a mockar `fetchBancoDeHoras` (fetch global, mesmo padrão já usado nos outros testes de tela) em vez de depender do `usePonto()` local.

## 8. Fora de escopo (referência para o plano de implementação)

- Cálculo oficial de folha de pagamento — isso é o item "Integrações avançadas (folha de pagamento...)" da Fase 3 do roadmap original.
- Feriados regionais e hora extra diferenciada por domingo/feriado — mesma simplificação já registrada em Alertas de Jornada e Convenções Coletivas.
- Navegação por período (semana a semana, mês a mês) na visão de equipe do web — sempre mostra o mês corrente; se precisar navegar, é um follow-up natural no estilo da Escala.
- Considerar a data de admissão (`hireDate`) do colaborador ao calcular dias esperados antes da contratação — o mock atual também não considerava isso; mantém a mesma simplificação.
- Persistir qualquer histórico/ledger de banco de horas — tudo é recalculado a cada consulta a partir de `TimeEntry`, sem tabela de saldo acumulado.
- Editar/corrigir o cálculo manualmente (ex: RH ajustar um saldo) — o fluxo de "Ajuste de ponto" já existente em Aprovações cobre correções de ponto em geral; não é redesenhado aqui.
