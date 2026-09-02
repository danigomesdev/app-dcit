# Férias — Colaborador — Web

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec anterior (mesmo portal):** [`2026-08-31-banco-de-horas-colaborador-web-design.md`](2026-08-31-banco-de-horas-colaborador-web-design.md)
**Referência mobile (mesma lógica, sem mudança aqui):** `apps/mobile/src/app/(tabs)/ferias.tsx`, `apps/mobile/src/lib/ferias.ts`

## 1. Objetivo e escopo

Quarto sub-projeto do portal de autoatendimento do colaborador na web. O colaborador consegue ver o próprio saldo ilustrativo de dias de férias, o período aquisitivo e a data de vencimento (com alerta quando o vencimento está próximo), solicitar um período de férias, acompanhar o status das próprias solicitações e ver o histórico de férias já tiradas. Mirror de `ferias.tsx` (mobile), sem o calendário visual (decisão desta conversa — ver seção 3.2).

A API já entrega tudo isso pronto: `POST`/`GET /solicitacoes/ferias` (criar e listar as próprias solicitações + perfil de férias do usuário autenticado). **Nenhuma mudança de backend nesta spec.**

Diferente da spec de Banco de Horas, esta página **não ramifica por role**: gestor/RH já aprovam férias em `/aprovacoes` (que já lista todas as solicitações via `GET /solicitacoes/ferias/todas`, sem mudança). `/ferias` é uma página exclusiva do colaborador, seguindo o mesmo padrão de guarda exclusiva de `/historico` e `/folha` — não o padrão de branch-por-role introduzido em Banco de Horas.

Fora de escopo (seção 7 tem a lista completa): Documentos, Mural (sub-projetos seguintes); calendário visual para escolha de datas; navegação livre de período; editar/cancelar uma solicitação já enviada; cálculo real de saldo de dias (motor de acúmulo não existe).

## 2. Modelo de dados e backend

Nenhuma mudança. Reaproveita integralmente:
- `POST /solicitacoes/ferias` (`AuthGuard`, body `{ startDate: string (date), endDate: string (date), days: number }` via `VacationRequestInputSchema`) → cria `VacationRequest` com `status: "pendente"`.
- `GET /solicitacoes/ferias` (`AuthGuard`) → `{ requests: VacationRequest[], hireDate: string | null, history: VacationHistoryEntry[] }`, onde `requests` é `listVacations(userId)` (`orderBy createdAt desc`) e `{ hireDate, history }` vem de `getVacationProfile(userId)` (`history` via `vacationHistoryEntry.findMany({ where: { userId }, orderBy: { year: "desc" } })`).
- Cada `VacationRequest`: `{ id, userId, startDate, endDate, days, status: "pendente" | "aprovado" | "recusado", reviewNote: string | null, createdAt }`.
- Cada `VacationHistoryEntry`: `{ id, userId, year, daysTaken, startDate, endDate }`.
- `hireDate` vem de `Employee.hireDate` (`DateTime`, obrigatório no schema — mas a rota já trata `employee` ausente retornando `null`, mesmo raciocínio do mobile).

## 3. Web (`apps/web`)

### 3.1 `apps/web/src/app/(app)/ferias/page.tsx` — guarda exclusiva (não branch por role)

Mesmo padrão de `historico/page.tsx`:

```typescript
export default async function FeriasPage() {
  const session = await getSession();
  if (!session || session.role !== "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é pessoal, restrita a colaboradores."
      />
    );
  }

  const data = await apiFetchJson<FeriasData>("/solicitacoes/ferias");
  // ... resto do corpo
}
```

Tipos locais ao arquivo (mesmo raciocínio já usado para `TeamSummary`/`MinhaSummary` em `banco-de-horas/page.tsx` — não vale a pena promover para `shared-types`):

```typescript
type VacationRequestRecord = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  status: "pendente" | "aprovado" | "recusado";
  reviewNote: string | null;
};
type VacationHistoryRecord = {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  daysTaken: number;
};
type FeriasData = {
  requests: VacationRequestRecord[];
  hireDate: string | null;
  history: VacationHistoryRecord[];
};
```

### 3.2 Ciclo de férias — funções puras reimplementadas (não portadas do mobile)

Mesmo trade-off já aceito em `banco-de-horas/page.tsx` (duplicar pequenas funções puras em vez de criar uma entrada nova em `shared-types`), mas adaptadas para o padrão São-Paulo-aware do web (`todaySaoPauloDateOnly`, já usado em `banco-de-horas/page.tsx` e no Escala) em vez do `new Date()` local ingênuo do mobile:

```typescript
// CLT gives 12 months to accrue vacation (período aquisitivo), then another
// 12 months to take it (período concessivo) before the employer risks
// paying it in double. Walks forward from hireDate to the cycle whose
// concessive deadline hasn't passed yet — same rule as the mobile lib,
// reimplemented on date-only strings (YYYY-MM-DD) instead of Date objects.
function addYearsToDateOnly(dateStr: string, years: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${(year + years).toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

type VacationCycle = { aquisitivoInicio: string; aquisitivoFim: string; vencimento: string };

function currentVacationCycle(hireDate: string, today: string): VacationCycle {
  let n = 0;
  while (addYearsToDateOnly(hireDate, n + 2) <= today) {
    n++;
  }
  return {
    aquisitivoInicio: addYearsToDateOnly(hireDate, n),
    aquisitivoFim: addYearsToDateOnly(hireDate, n + 1),
    vencimento: addYearsToDateOnly(hireDate, n + 2),
  };
}

function daysUntil(dateStr: string, today: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const target = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  const from = new Date(`${today}T00:00:00.000Z`).getTime();
  return Math.ceil((target - from) / msPerDay);
}

// Illustrative only — no payroll/HR accrual engine exists yet, same caveat
// as apps/mobile/src/lib/ferias.ts AVAILABLE_DAYS. CLT gives 30 days/year;
// this is not computed from real absence/accrual data.
const AVAILABLE_DAYS = 22;

const VENCIMENTO_ALERT_THRESHOLD_DAYS = 90;

// Fallback used only when hireDate is null (no Employee row) — same
// fallback constant as the mobile lib, kept in sync manually since it's a
// throwaway illustrative default, not real data worth sharing.
const FALLBACK_HIRE_DATE = "2024-03-15";
```

`formatDate` reaproveita o padrão já usado em `historico/page.tsx` (`toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })`, sobre `new Date(`${dateStr}T00:00:00.000Z`)` para datas date-only).

### 3.3 Corpo de `FeriasPage`

1. `const today = todaySaoPauloDateOnly();` (função já existente em `banco-de-horas/page.tsx` — duplicada aqui pelo mesmo raciocínio das outras funções puras).
2. `const cycle = currentVacationCycle(data.hireDate ?? FALLBACK_HIRE_DATE, today);`
3. `const diasParaVencimento = daysUntil(cycle.vencimento, today);`
4. Renderiza:
   - `<h1>Férias</h1>`
   - Card de saldo (`.balanceCard`): "`{AVAILABLE_DAYS}` dias disponíveis", "Período aquisitivo: `{formatDate(cycle.aquisitivoInicio)}` — `{formatDate(cycle.aquisitivoFim)}`", "Vencem em `{formatDate(cycle.vencimento)}`".
   - Banner de alerta (`.alertBanner`), só quando `diasParaVencimento <= VENCIMENTO_ALERT_THRESHOLD_DAYS`: "Suas férias vencem em `{diasParaVencimento}` dias. Agende antes do prazo para evitar o pagamento em dobro." (mesmo texto do mobile).
   - Formulário "Solicitar férias" (`<form action={requestVacation}>`): dois `<input type="date" name="startDate" required>` / `name="endDate"`, rotulados "Início" e "Fim", `min` do campo `startDate` = `today` (mesma regra do mobile `minDate={dateKey(new Date())}`); botão "Enviar solicitação".
   - Lista "Minhas solicitações": cada `VacationRequestRecord` — `{formatDate(startDate)} — {formatDate(endDate)} · {days} dia(s)`, badge de status (mesmo padrão `STATUS_LABEL` + `.statusAprovado`/`.statusRecusado` de `banco-de-horas`/`documentos`), `reviewNote` quando presente. Vazio → texto simples "Nenhuma solicitação registrada ainda." (seção dentro de página com conteúdo, não `EmptyState` de página inteira — mesmo padrão do banco-de-horas).
   - Lista "Histórico de férias": cada `VacationHistoryRecord` — ano em destaque, `{formatDate(startDate)} — {formatDate(endDate)} · {daysTaken} dias`. Vazio → "Nenhum período de férias registrado ainda."

### 3.4 `apps/web/src/app/(app)/ferias/actions.ts` (novo)

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / msPerDay) + 1;
}

export async function requestVacation(formData: FormData) {
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  if (typeof startDate !== "string" || typeof endDate !== "string" || !startDate || !endDate) {
    throw new Error("Data de início e fim são obrigatórias.");
  }
  if (endDate < startDate) {
    throw new Error("A data de fim não pode ser anterior à data de início.");
  }
  const res = await apiFetch("/solicitacoes/ferias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, days: daysBetweenInclusive(startDate, endDate) }),
  });
  if (!res.ok) {
    throw new Error(`/solicitacoes/ferias responded with ${res.status}`);
  }
  revalidatePath("/ferias");
}
```

Mesmo padrão de `banco-de-horas/actions.ts`: Server Action lendo `FormData`, `apiFetch` (não `apiFetchJson`), `revalidatePath` para a lista recarregar.

### 3.5 `ferias.module.css` (novo)

Mesmas classes de `banco-de-horas.module.css` que se aplicam aqui (`.page`, `.heading`, `.list`, `.item`, `.status`, `.statusAprovado`, `.statusRecusado`, `.sectionTitle`, `.sectionEmpty`, `.form`, `.submitButton`), copiadas para este módulo (cada página web tem seu próprio CSS module — convenção já estabelecida, não há import cross-page de estilos). Classes novas específicas desta página:

```css
.balanceCard {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  border-radius: 12px;
  background: var(--color-background-element);
}

.balanceValue {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
}

.balanceDetail {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.alertBanner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(248, 113, 113, 0.18);
  color: #f87171;
  font-size: 14px;
}

.dateFields {
  display: flex;
  gap: 12px;
}

.dateField {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dateInput {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-background-selected);
  background: var(--color-background-element);
  color: var(--color-text);
  font: inherit;
}
```

### 3.6 `nav-sections.ts`

`NAV_SECTIONS` ganha uma entrada nova (falta hoje — diferente do `/banco-de-horas`, que já estava lá quando aquela spec foi escrita):

```typescript
{ href: "/ferias", label: "Férias", roles: ["colaborador"] },
```

`COLABORADOR_SIDEBAR` ganha um item de topo novo, irmão de "Ponto" e "Banco de Horas" (mesma estrutura combinada nas conversas anteriores):

```typescript
export const COLABORADOR_SIDEBAR: SidebarEntry[] = [
  {
    href: "/",
    label: "Ponto",
    children: [
      { href: "/historico", label: "Histórico de Pontos" },
      { href: "/folha", label: "Folha de Ponto" },
    ],
  },
  { href: "/banco-de-horas", label: "Banco de Horas" },
  { href: "/ferias", label: "Férias" },
];
```

## 4. Mobile

Nenhuma mudança de código.

## 5. Testes

- **`ferias.spec.ts`** (novo):
  - Colaborador vê saldo ilustrativo, período aquisitivo, vencimento e a lista "Minhas solicitações" (mockando `GET /solicitacoes/ferias` via `mockApi`'s `feriasData`).
  - Quando o vencimento mockado está a ≤ 90 dias, o banner de alerta aparece com o texto esperado; quando está mais longe, o banner não aparece.
  - Enviar o formulário com início/fim faz uma requisição `POST /solicitacoes/ferias` com `{ startDate, endDate, days }` corretos (via `getRecordedRequests`, mesmo padrão de `banco-de-horas.spec.ts`), e a página recarrega mostrando a nova solicitação na lista (resposta mockada via `seedResponse`, lista re-seedada com o novo item).
  - Uma solicitação com `status: "recusado"` mostra o `reviewNote`.
  - Uma entrada de `history` aparece na seção "Histórico de férias" com ano, período e dias.
  - Gestor e RH veem "Sem permissão" ao acessar `/ferias` (mesmo padrão de `historico.spec.ts`/`folha.spec.ts`).
- **`test-session.ts`**: `mockApi`'s typed `data` ganha uma chave nova:
  ```typescript
  feriasData?: unknown;
  ```
  seedando `GET /solicitacoes/ferias`. Nenhuma mudança em `fake-api-server.mjs` — o `POST /solicitacoes/ferias` do formulário é coberto pelo helper genérico `seedResponse` já existente (mesmo raciocínio documentado na spec de Banco de Horas).
- **`app-shell.spec.ts`**: o teste `"colaborador sees a curated, grouped sidebar..."` ganha uma asserção a mais — `page.getByRole("link", { name: "Férias" })` visível como item de topo, sem precisar expandir "Ponto".
- **`search.spec.ts`**: ganha uma asserção — "Férias" aparece nos resultados de busca para colaborador (via `NAV_SECTIONS`, que agora inclui a entrada).
- Os testes existentes de `aprovacoes.spec.ts` para férias (aprovação/recusa pelo gestor/RH) **continuam passando sem alteração** — nenhuma mudança em `/aprovacoes` ou em `solicitacoes.controller.ts`/`.service.ts`.

## 6. Global Constraints (herdadas + novas)

- `hireDate`/`vencimento`/"hoje" devem ser São-Paulo-aware (herdada de Banco de Horas), calculados sobre strings date-only, não `Date` local ingênuo — diferente do mobile, que usa `new Date()` sem fuso explícito.
- Saldo de dias (`AVAILABLE_DAYS = 22`) é ilustrativo, não um cálculo real — decisão explícita desta conversa: replicar o mesmo valor e a mesma ressalva do mobile em vez de esconder o card, até existir motor de acúmulo real.
- Seleção de datas via `<input type="date">` nativo, não um calendário visual — decisão explícita desta conversa, para não introduzir uma dependência de calendário que nenhuma outra página do web usa.
- `COLABORADOR_SIDEBAR`: item novo é irmão do grupo "Ponto" e de "Banco de Horas", não filho — mesma estrutura combinada para os próximos sub-projetos (Documentos, Mural).
- `/ferias` usa guarda exclusiva (como `/historico`, `/folha`), não o padrão de branch-por-role introduzido em Banco de Horas — porque a visão de gestor/RH já existe em `/aprovacoes` e não precisa ser duplicada aqui.

## 7. Fora de escopo

- Documentos, Mural — sub-projetos seguintes, specs próprias.
- Calendário visual para escolha de período (como o mobile) — dois campos de data nativos, decisão já tomada em conversa.
- Navegação livre de período ou filtro de histórico — a página mostra tudo que a API retorna, sem paginação (mesmo escopo do mobile).
- Editar ou cancelar uma solicitação de férias já enviada — não existe no mobile hoje, não é criado aqui.
- Cálculo real de saldo de dias de férias a partir de acúmulo/afastamentos — motor não existe; `AVAILABLE_DAYS` permanece um valor fixo ilustrativo.
- Botão "Pagamento efetuado" (RH) e infraestrutura de notificação — sub-projeto próprio futuro, greenfield (não existe tabela de notificação no sistema hoje).
