# Férias Colaborador Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the colaborador a `/ferias` page on the web portal — illustrative saldo, período aquisitivo/vencimento with an alert when close, a request form, and lists of the colaborador's own requests and history — mirroring `apps/mobile/src/app/(tabs)/ferias.tsx`.

**Architecture:** A single Server Component (`apps/web/src/app/(app)/ferias/page.tsx`) guarded to `role === "colaborador"` (same pattern as `/historico`), fetching `GET /solicitacoes/ferias` once and rendering everything from that one payload. A Server Action (`actions.ts`) handles the request form via `POST /solicitacoes/ferias` + `revalidatePath`. No backend changes — every endpoint already exists and is already exercised by the mobile app and by `/aprovacoes` (gestor/RH approval, untouched by this plan).

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), CSS Modules, Playwright for e2e tests (the only test layer this app has — there is no unit-test runner in `apps/web`).

**Spec:** `docs/superpowers/specs/2026-09-01-ferias-colaborador-web-design.md`

## Global Constraints

- No backend changes. Every request in this plan hits an endpoint that already exists (`POST`/`GET /solicitacoes/ferias`).
- `/ferias` uses an exclusive guard (`session.role !== "colaborador"` → `EmptyState`), not the branch-per-role pattern from Banco de Horas — gestor/RH already approve férias via `/aprovacoes`.
- `hireDate`/`vencimento`/"hoje" are computed on date-only strings (`YYYY-MM-DD`), São-Paulo-aware via `Intl.DateTimeFormat` with `timeZone: "America/Sao_Paulo"` — never a timezone-naive `new Date()`.
- `AVAILABLE_DAYS = 22` is an illustrative constant, not a real computation — no accrual engine exists. Replicate the mobile app's caveat comment verbatim in code.
- Date selection uses native `<input type="date">` — no calendar widget dependency.
- `COLABORADOR_SIDEBAR`: the new `Férias` entry is a sibling of "Ponto" and "Banco de Horas", not nested under either.
- Every new/changed behavior gets a Playwright e2e test in `apps/web/e2e/ferias.spec.ts` (or the existing `app-shell.spec.ts`/`search.spec.ts` for nav-only changes) — this codebase has no other test layer for `apps/web`.

---

## Task 1: Wire `/ferias` into navigation

**Files:**
- Modify: `apps/web/src/lib/nav-sections.ts`
- Modify: `apps/web/e2e/app-shell.spec.ts`
- Modify: `apps/web/e2e/search.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `/ferias` entry in `NAV_SECTIONS` (role: `colaborador`) and in `COLABORADOR_SIDEBAR` (top-level, sibling of "Banco de Horas") that later tasks' page will resolve to.

The page these links point to doesn't exist yet (it lands in Task 2) — that's fine here because neither test clicks through to `/ferias`, they only assert the link/search-result is visible.

- [ ] **Step 1: Write the failing tests**

In `apps/web/e2e/app-shell.spec.ts`, inside the existing test `"colaborador sees a curated, grouped sidebar instead of the gestor/rh menu"` (starts at line 45), add this assertion right after the existing `Banco de Horas` check on line 54:

```typescript
  await expect(page.getByRole("link", { name: "Banco de Horas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Férias" })).toBeVisible();
```

In `apps/web/e2e/search.spec.ts`, add a new test at the end of the file (after the existing `"colaborador can find Banco de Horas via search"` test):

```typescript
test("colaborador can find Férias via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("férias");

  await expect(page.getByRole("button", { name: "Férias" })).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test app-shell.spec.ts search.spec.ts`
Expected: FAIL — `page.getByRole('link', { name: 'Férias' })` and the search test's `getByRole('button', { name: 'Férias' })` are not found (no such nav entry exists yet).

- [ ] **Step 3: Add the nav entries**

In `apps/web/src/lib/nav-sections.ts`, change the `NAV_SECTIONS` array (currently lines 11-27) so the `/banco-de-horas` line is followed by a new `/ferias` line:

```typescript
export const NAV_SECTIONS: NavSection[] = [
  { href: "/", label: "Ponto", roles: ["gestor", "rh", "colaborador"] },
  { href: "/historico", label: "Histórico de Pontos", roles: ["colaborador"] },
  { href: "/folha", label: "Folha de Ponto", roles: ["colaborador"] },
  { href: "/colaboradores", label: "Colaboradores", roles: ["gestor", "rh"] },
  { href: "/escala", label: "Plantão", roles: ["gestor", "rh"] },
  { href: "/aprovacoes", label: "Aprovações", roles: ["gestor", "rh"] },
  { href: "/documentos", label: "Documentos", roles: ["gestor", "rh"] },
  { href: "/mural", label: "Mural", roles: ["gestor", "rh"] },
  { href: "/beneficios", label: "Benefícios", roles: ["gestor", "rh"] },
  { href: "/onboarding", label: "Onboarding", roles: ["gestor", "rh"] },
  { href: "/operacional", label: "Operacional", roles: ["gestor", "rh"] },
  { href: "/alertas", label: "Alertas", roles: ["gestor", "rh"] },
  { href: "/convencoes", label: "Convenções", roles: ["rh"] },
  { href: "/banco-de-horas", label: "Banco de Horas", roles: ["gestor", "rh", "colaborador"] },
  { href: "/ferias", label: "Férias", roles: ["colaborador"] },
  { href: "/holerites", label: "Holerites", roles: ["gestor", "rh"] },
];
```

And change `COLABORADOR_SIDEBAR` (currently lines 47-57) to add `Férias` as a sibling of `Banco de Horas`:

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test app-shell.spec.ts search.spec.ts`
Expected: PASS (the two new assertions and the new test succeed; every pre-existing test in both files still passes unchanged).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/nav-sections.ts apps/web/e2e/app-shell.spec.ts apps/web/e2e/search.spec.ts
git commit -m "feat(web): add Férias to colaborador navigation and search"
```

---

## Task 2: `/ferias` page skeleton — guard, saldo, período aquisitivo/vencimento, alerta

**Files:**
- Create: `apps/web/src/app/(app)/ferias/page.tsx`
- Create: `apps/web/src/app/(app)/ferias/ferias.module.css`
- Modify: `apps/web/e2e/test-session.ts`
- Create: `apps/web/e2e/ferias.spec.ts`

**Interfaces:**
- Consumes: `apiFetchJson<T>(path): Promise<T>` and `apiFetch` from `@/lib/api`; `getSession()` from `@/lib/session`; `EmptyState` from `@/components/empty-state`.
- Produces: `FeriasPage` (default export). Types `VacationRequestRecord`, `VacationHistoryRecord`, `FeriasData` and functions `todaySaoPauloDateOnly`, `currentVacationCycle`, `daysUntil`, `formatDate`, plus constants `AVAILABLE_DAYS`, `VENCIMENTO_ALERT_THRESHOLD_DAYS`, `FALLBACK_HIRE_DATE` — all module-scoped in `page.tsx`, reused unchanged by Tasks 3-5 (which only add JSX/CSS, never touch these).
- `mockApi`'s `data` parameter gains `feriasData?: unknown`, seeding `GET /solicitacoes/ferias` — reused by every test in `ferias.spec.ts` across this and later tasks.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/e2e/ferias.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

// Local helpers mirroring apps/web/src/app/(app)/ferias/page.tsx's own
// date-only cycle math, used to compute the expected período
// aquisitivo/vencimento from a hireDate without hardcoding "today" — the
// page always shows the real current cycle, so the test derives its
// expectation from the actual run date instead of a fixed calendar date.
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addYearsToDateOnly(dateStr: string, years: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${(year + years).toString().padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function currentCycle(hireDate: string, today: string) {
  let n = 0;
  while (addYearsToDateOnly(hireDate, n + 2) <= today) n++;
  return {
    aquisitivoInicio: addYearsToDateOnly(hireDate, n),
    aquisitivoFim: addYearsToDateOnly(hireDate, n + 1),
    vencimento: addYearsToDateOnly(hireDate, n + 2),
  };
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// A fixed, always-in-the-past hireDate — stable regardless of when the
// test suite runs, since currentCycle() walks it forward to whichever
// cycle contains "today".
const HIRE_DATE = "2020-03-10";

test("gestor and rh see a permission message instead of the vacation page", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/ferias");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await page.goto("/ferias");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("colaborador sees the illustrative saldo, período aquisitivo and vencimento", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: { requests: [], hireDate: HIRE_DATE, history: [] },
  });

  await page.goto("/ferias");

  const today = toDateOnly(new Date());
  const cycle = currentCycle(HIRE_DATE, today);

  await expect(page.getByRole("heading", { name: "Férias" })).toBeVisible();
  await expect(page.getByText("22 dias disponíveis")).toBeVisible();
  await expect(
    page.getByText(
      `Período aquisitivo: ${formatDateBR(cycle.aquisitivoInicio)} — ${formatDateBR(cycle.aquisitivoFim)}`,
    ),
  ).toBeVisible();
  await expect(page.getByText(`Vencem em ${formatDateBR(cycle.vencimento)}`)).toBeVisible();
});

test("shows the vencimento alert when it's within 90 days", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const target = new Date();
  target.setDate(target.getDate() + 30);
  const hireDate = `${target.getFullYear() - 2}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  await mockApi(request, {
    feriasData: { requests: [], hireDate, history: [] },
  });

  await page.goto("/ferias");

  await expect(page.getByText(/Suas férias vencem em \d+ dias\./)).toBeVisible();
});

test("does not show the vencimento alert when it's far away", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const target = new Date();
  target.setDate(target.getDate() + 400);
  const hireDate = `${target.getFullYear() - 2}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  await mockApi(request, {
    feriasData: { requests: [], hireDate, history: [] },
  });

  await page.goto("/ferias");

  await expect(page.getByText(/Suas férias vencem em \d+ dias\./)).toHaveCount(0);
});
```

In `apps/web/e2e/test-session.ts`, add `feriasData?: unknown;` to the `data` parameter's type (right after `myCompensations?: unknown[];` on line 67):

```typescript
    bancoDeHorasMinhas?: unknown;
    myCompensations?: unknown[];
    feriasData?: unknown;
  } = {}
```

And add the seeding block right after the `bancoDeHorasMinhas`/`myCompensations` blocks (after line 185, before the closing `}` of `mockApi`):

```typescript
  if (data.feriasData) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/ferias", response: data.feriasData },
    });
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test ferias.spec.ts`
Expected: FAIL — `/ferias` doesn't resolve to a page yet (404), so none of the four tests find their expected content.

- [ ] **Step 3: Create the page and its styles**

Create `apps/web/src/app/(app)/ferias/ferias.module.css`:

```css
.page {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.heading {
  font-size: 24px;
  font-weight: 600;
}

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

.alertBanner svg {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}
```

Create `apps/web/src/app/(app)/ferias/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./ferias.module.css";

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

// Illustrative only — no payroll/HR accrual engine exists yet, same caveat
// as apps/mobile/src/lib/ferias.ts AVAILABLE_DAYS. CLT gives 30 days/year;
// this is not computed from real absence/accrual data.
const AVAILABLE_DAYS = 22;

const VENCIMENTO_ALERT_THRESHOLD_DAYS = 90;

// Fallback used only when hireDate is null (no Employee row) — same
// fallback constant as apps/mobile/src/lib/ferias.ts HIRE_DATE.
const FALLBACK_HIRE_DATE = "2024-03-15";

// Same "explicit America/Sao_Paulo" reasoning as banco-de-horas/page.tsx's
// todaySaoPauloDateOnly: "which day is it right now" must follow the
// company's timezone, not the server's ambient one.
function todaySaoPauloDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addYearsToDateOnly(dateStr: string, years: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${(year + years).toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

type VacationCycle = { aquisitivoInicio: string; aquisitivoFim: string; vencimento: string };

// CLT gives 12 months to accrue vacation (período aquisitivo), then another
// 12 months to take it (período concessivo) before the employer risks
// paying it in double. Walks forward from hireDate to the cycle whose
// concessive deadline hasn't passed yet — same rule as
// apps/mobile/src/lib/ferias.ts currentVacationCycle, reimplemented on
// date-only strings instead of Date objects.
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

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

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
  const today = todaySaoPauloDateOnly();
  const cycle = currentVacationCycle(data.hireDate ?? FALLBACK_HIRE_DATE, today);
  const diasParaVencimento = daysUntil(cycle.vencimento, today);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Férias</h1>

      <div className={styles.balanceCard}>
        <span className={styles.balanceValue}>{AVAILABLE_DAYS} dias disponíveis</span>
        <span className={styles.balanceDetail}>
          Período aquisitivo: {formatDate(cycle.aquisitivoInicio)} — {formatDate(cycle.aquisitivoFim)}
        </span>
        <span className={styles.balanceDetail}>Vencem em {formatDate(cycle.vencimento)}</span>
      </div>

      {diasParaVencimento <= VENCIMENTO_ALERT_THRESHOLD_DAYS ? (
        <div className={styles.alertBanner}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 9v4M12 17h.01M10.29 3.86l-8.18 14.18A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-2.96L13.71 3.86a2 2 0 0 0-3.42 0z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            Suas férias vencem em {diasParaVencimento} dias. Agende antes do prazo para evitar o
            pagamento em dobro.
          </span>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test ferias.spec.ts`
Expected: PASS for all four tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/ferias/page.tsx apps/web/src/app/\(app\)/ferias/ferias.module.css apps/web/e2e/test-session.ts apps/web/e2e/ferias.spec.ts
git commit -m "feat(web): colaborador sees their vacation saldo, cycle and vencimento alert"
```

---

## Task 3: "Minhas solicitações" list

**Files:**
- Modify: `apps/web/src/app/(app)/ferias/page.tsx`
- Modify: `apps/web/src/app/(app)/ferias/ferias.module.css`
- Modify: `apps/web/e2e/ferias.spec.ts`

**Interfaces:**
- Consumes: `VacationRequestRecord`, `FeriasData`, `formatDate` from Task 2 (unchanged).
- Produces: `STATUS_LABEL: Record<VacationRequestRecord["status"], string>`, rendered `data.requests` list — Task 4 adds a sibling list below this one; Task 5's form sits above it, between the alert banner and this section's `<h2>`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/e2e/ferias.spec.ts`:

```typescript
test("colaborador sees their own vacation requests, including the reviewer's note on a recusado one", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: {
      requests: [
        {
          id: "vr-1",
          startDate: "2026-07-10",
          endDate: "2026-07-24",
          days: 15,
          status: "aprovado",
          reviewNote: null,
        },
        {
          id: "vr-2",
          startDate: "2026-01-05",
          endDate: "2026-01-09",
          days: 5,
          status: "recusado",
          reviewNote: "Período coincide com o fechamento mensal do financeiro.",
        },
      ],
      hireDate: HIRE_DATE,
      history: [],
    },
  });

  await page.goto("/ferias");

  await expect(page.getByText("10/07/2026 — 24/07/2026")).toBeVisible();
  await expect(page.getByText("15 dia(s)")).toBeVisible();
  await expect(page.getByText("Aprovado")).toBeVisible();

  await expect(page.getByText("05/01/2026 — 09/01/2026")).toBeVisible();
  await expect(page.getByText("Recusado")).toBeVisible();
  await expect(
    page.getByText("Período coincide com o fechamento mensal do financeiro."),
  ).toBeVisible();
});

test("shows a message when there are no vacation requests yet", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: { requests: [], hireDate: HIRE_DATE, history: [] },
  });

  await page.goto("/ferias");

  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test ferias.spec.ts`
Expected: FAIL — the two new tests can't find "Minhas solicitações" content (the section doesn't exist yet). The four Task 2 tests still pass.

- [ ] **Step 3: Add the list**

In `apps/web/src/app/(app)/ferias/ferias.module.css`, append:

```css
.sectionTitle {
  font-size: 18px;
  font-weight: 600;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--color-background-element);
}

.itemInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.itemName {
  font-weight: 600;
  color: var(--color-text);
}

.itemDetail {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.itemNote {
  font-size: 13px;
  color: #f87171;
}

.status {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-background-selected);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.statusAprovado {
  background: rgba(74, 222, 128, 0.18);
  color: #4ade80;
}

.statusRecusado {
  background: rgba(248, 113, 113, 0.18);
  color: #f87171;
}

.sectionEmpty {
  color: var(--color-text-secondary);
  font-size: 14px;
}
```

In `apps/web/src/app/(app)/ferias/page.tsx`, add `STATUS_LABEL` right after the `VacationCycle` type / before `currentVacationCycle`:

```typescript
const STATUS_LABEL: Record<VacationRequestRecord["status"], string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};
```

Then add the list JSX at the end of the returned `<div className={styles.page}>`, right after the alert banner's closing `) : null}`:

```tsx
      <h2 className={styles.sectionTitle}>Minhas solicitações</h2>
      {data.requests.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhuma solicitação registrada ainda.</p>
      ) : (
        <ul className={styles.list}>
          {data.requests.map((request) => (
            <li key={request.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>
                  {formatDate(request.startDate)} — {formatDate(request.endDate)}
                </span>
                <span className={styles.itemDetail}>{request.days} dia(s)</span>
                {request.reviewNote ? (
                  <span className={styles.itemNote}>{request.reviewNote}</span>
                ) : null}
              </div>
              <span
                className={`${styles.status} ${
                  request.status === "aprovado" ? styles.statusAprovado : ""
                } ${request.status === "recusado" ? styles.statusRecusado : ""}`}
              >
                {STATUS_LABEL[request.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test ferias.spec.ts`
Expected: PASS for all six tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/ferias/page.tsx apps/web/src/app/\(app\)/ferias/ferias.module.css apps/web/e2e/ferias.spec.ts
git commit -m "feat(web): colaborador sees their own vacation requests and status"
```

---

## Task 4: "Histórico de férias" list

**Files:**
- Modify: `apps/web/src/app/(app)/ferias/page.tsx`
- Modify: `apps/web/src/app/(app)/ferias/ferias.module.css`
- Modify: `apps/web/e2e/ferias.spec.ts`

**Interfaces:**
- Consumes: `VacationHistoryRecord`, `FeriasData`, `formatDate` from Task 2 (unchanged).
- Produces: rendered `data.history` list, placed after the "Minhas solicitações" list from Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/e2e/ferias.spec.ts`:

```typescript
test("colaborador sees their vacation history", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: {
      requests: [],
      hireDate: HIRE_DATE,
      history: [
        { id: "vh-1", year: 2025, startDate: "2025-06-15", endDate: "2025-06-29", daysTaken: 15 },
        { id: "vh-2", year: 2024, startDate: "2024-01-10", endDate: "2024-02-09", daysTaken: 30 },
      ],
    },
  });

  await page.goto("/ferias");

  await expect(page.getByText("2025")).toBeVisible();
  await expect(page.getByText("15/06/2025 — 29/06/2025 · 15 dias")).toBeVisible();
  await expect(page.getByText("2024")).toBeVisible();
  await expect(page.getByText("10/01/2024 — 09/02/2024 · 30 dias")).toBeVisible();
});

test("shows a message when there's no vacation history yet", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: { requests: [], hireDate: HIRE_DATE, history: [] },
  });

  await page.goto("/ferias");

  await expect(page.getByText("Nenhum período de férias registrado ainda.")).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test ferias.spec.ts`
Expected: FAIL — the two new tests can't find "Histórico de férias" content. The six prior tests still pass.

- [ ] **Step 3: Add the list**

In `apps/web/src/app/(app)/ferias/ferias.module.css`, append:

```css
.historyYear {
  font-weight: 700;
  color: var(--color-text);
  min-width: 44px;
}
```

In `apps/web/src/app/(app)/ferias/page.tsx`, add this JSX right after the "Minhas solicitações" section's closing `)}` (the very end of the returned `<div className={styles.page}>`, before its closing `</div>`):

```tsx
      <h2 className={styles.sectionTitle}>Histórico de férias</h2>
      {data.history.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhum período de férias registrado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {data.history.map((entry) => (
            <li key={entry.id} className={styles.item}>
              <span className={styles.historyYear}>{entry.year}</span>
              <span className={styles.itemDetail}>
                {formatDate(entry.startDate)} — {formatDate(entry.endDate)} · {entry.daysTaken} dias
              </span>
            </li>
          ))}
        </ul>
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test ferias.spec.ts`
Expected: PASS for all eight tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/ferias/page.tsx apps/web/src/app/\(app\)/ferias/ferias.module.css apps/web/e2e/ferias.spec.ts
git commit -m "feat(web): colaborador sees their vacation history"
```

---

## Task 5: Request form (Server Action)

**Files:**
- Create: `apps/web/src/app/(app)/ferias/actions.ts`
- Modify: `apps/web/src/app/(app)/ferias/page.tsx`
- Modify: `apps/web/src/app/(app)/ferias/ferias.module.css`
- Modify: `apps/web/e2e/ferias.spec.ts`

**Interfaces:**
- Consumes: `apiFetch` from `@/lib/api`; `today` (already computed in `FeriasPage`) for the `startDate` input's `min`.
- Produces: `requestVacation(formData: FormData): Promise<void>` — a `"use server"` action, imported by `page.tsx` and wired to the new `<form>`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/e2e/ferias.spec.ts`:

```typescript
test("submitting the vacation form posts start/end/days to the API and refreshes Minhas solicitações with the new item", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    feriasData: { requests: [], hireDate: HIRE_DATE, history: [] },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/solicitacoes/ferias",
    status: 201,
    response: {
      id: "vr-new",
      startDate: "2026-12-15",
      endDate: "2027-01-05",
      days: 22,
      status: "pendente",
      reviewNote: null,
    },
  });

  await page.goto("/ferias");
  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toBeVisible();

  // Re-seed the GET *before* submitting, so it's already in place when the
  // form's server action (requestVacation) calls revalidatePath and the
  // page re-fetches as part of that same round trip — this is what proves
  // revalidatePath actually refreshes the list, not just that the POST
  // body was correct.
  await seedResponse(request, {
    method: "GET",
    path: "/solicitacoes/ferias",
    response: {
      requests: [
        {
          id: "vr-new",
          startDate: "2026-12-15",
          endDate: "2027-01-05",
          days: 22,
          status: "pendente",
          reviewNote: null,
        },
      ],
      hireDate: HIRE_DATE,
      history: [],
    },
  });

  await page.getByLabel("Início").fill("2026-12-15");
  await page.getByLabel("Fim").fill("2027-01-05");
  await page.getByRole("button", { name: "Enviar solicitação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/solicitacoes/ferias")?.body;
    })
    .toEqual({ startDate: "2026-12-15", endDate: "2027-01-05", days: 22 });

  await expect(page.getByText("15/12/2026 — 05/01/2027")).toBeVisible();
  await expect(page.getByText("22 dia(s)")).toBeVisible();
  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toHaveCount(0);
});
```

This test needs `getRecordedRequests` and `seedResponse`, so update the import at the top of `apps/web/e2e/ferias.spec.ts`:

```typescript
import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx playwright test ferias.spec.ts`
Expected: FAIL — there's no "Início"/"Fim" labeled input or "Enviar solicitação" button yet. The eight prior tests still pass.

- [ ] **Step 3: Add the action and the form**

Create `apps/web/src/app/(app)/ferias/actions.ts`:

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

In `apps/web/src/app/(app)/ferias/ferias.module.css`, append:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dateFields {
  display: flex;
  gap: 12px;
}

.dateField {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.dateFieldLabel {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.dateInput {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-background-selected);
  background: var(--color-background-element);
  color: var(--color-text);
  font: inherit;
}

.submitButton {
  align-self: flex-start;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: var(--color-text);
  color: var(--color-background);
  font-weight: 600;
  cursor: pointer;
}
```

In `apps/web/src/app/(app)/ferias/page.tsx`:

1. Add the import, right after the `EmptyState` import:

```typescript
import { requestVacation } from "./actions";
```

2. Insert the form JSX between the alert banner's closing `) : null}` and the "Minhas solicitações" `<h2>` added in Task 3:

```tsx
      <h2 className={styles.sectionTitle}>Solicitar férias</h2>
      <form className={styles.form} action={requestVacation}>
        <div className={styles.dateFields}>
          <div className={styles.dateField}>
            <label className={styles.dateFieldLabel} htmlFor="startDate">
              Início
            </label>
            <input
              className={styles.dateInput}
              type="date"
              id="startDate"
              name="startDate"
              min={today}
              required
            />
          </div>
          <div className={styles.dateField}>
            <label className={styles.dateFieldLabel} htmlFor="endDate">
              Fim
            </label>
            <input className={styles.dateInput} type="date" id="endDate" name="endDate" required />
          </div>
        </div>
        <button type="submit" className={styles.submitButton}>
          Enviar solicitação
        </button>
      </form>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx playwright test ferias.spec.ts`
Expected: PASS for all nine tests.

- [ ] **Step 5: Run the full web e2e suite**

Run: `cd apps/web && npx playwright test`
Expected: PASS — every pre-existing spec file (`banco-de-horas.spec.ts`, `app-shell.spec.ts`, `search.spec.ts`, `aprovacoes.spec.ts`, etc.) still passes unchanged, alongside the new `ferias.spec.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/ferias/actions.ts apps/web/src/app/\(app\)/ferias/page.tsx apps/web/src/app/\(app\)/ferias/ferias.module.css apps/web/e2e/ferias.spec.ts
git commit -m "feat(web): colaborador can request férias"
```
