# Banco de Horas — Colaborador — Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `colaborador` see their own banco de horas (saldo, DSR, tabela diária previsto×trabalhado×diferença) and request/track compensação, on the same `/banco-de-horas` route gestor/RH already use for the team view.

**Architecture:** `apps/web/src/app/(app)/banco-de-horas/page.tsx` starts branching by role instead of gating exclusively: the existing gestor/RH body is extracted unchanged into a `TeamView` function, and a new `ColaboradorView` function is added alongside it, reusing the file's existing date helpers (`todaySaoPauloDateOnly`, `firstDayOfMonth`, `lastDayOfMonth`, `addMonths`, `formatSignedMinutes`, `formatBRL`). No backend changes — `GET /banco-de-horas/minhas` and `POST`/`GET /solicitacoes/compensacoes` already exist and already default to calendar-month-aligned periods.

**Tech Stack:** Next.js App Router (Server Component page + one `"use server"` action file), Playwright e2e (this app has no unit test runner).

**Spec:** [`docs/superpowers/specs/2026-08-31-banco-de-horas-colaborador-web-design.md`](../specs/2026-08-31-banco-de-horas-colaborador-web-design.md)

## Global Constraints

- Saldo e tabela diária sempre alinhados ao calendário civil (mês tem 30 ou 31 dias) — nunca uma janela rolante de N dias. Já satisfeito pelo default do backend (`GET /banco-de-horas/minhas` sem `start`/`end` = dia 1 do mês corrente até hoje).
- "Hoje" e limites de mês são sempre São-Paulo-aware (`timeZone: "America/Sao_Paulo"`), nunca UTC-ingênuo — reaproveita os helpers já existentes no arquivo, não duplica.
- Sem gráfico de 30 dias, sem cards de insight fabricados — só saldo, DSR, valor-hora, extras, tabela diária, e o fluxo de solicitar/acompanhar compensação.
- `TeamView` (gestor/RH) não muda de comportamento nesta feature — é extraída, não reescrita. Todos os testes existentes de `banco-de-horas.spec.ts` para gestor/RH continuam passando sem edição.
- `COLABORADOR_SIDEBAR` (`apps/web/src/lib/nav-sections.ts`): o item novo é irmão do grupo "Ponto", não filho — mesma estrutura já usada para os próximos sub-projetos (Férias, Documentos, Mural).
- Sem editar/cancelar uma solicitação já enviada — não existe no mobile hoje, não é criado aqui.

---

### Task 1: Extract `TeamView` — pure refactor, no behavior change

**Files:**
- Modify: `apps/web/src/app/(app)/banco-de-horas/page.tsx`

**Interfaces:**
- Produces: `function TeamView({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Promise<JSX.Element>` — the exact body of today's `BancoDeHorasPage`, renamed. `searchParams` keeps the same shape `PageProps<"/banco-de-horas">` already resolves to (`Record<string, string | string[] | undefined>`, once the outer `Promise` is awaited) — narrowing it to `{ start?: string }` would be a type error, since a `string[]` value at that key can't assign to `string | undefined`; read individual keys with a `typeof x === "string"` guard, exactly like the pre-existing `startParam` handling already does. `BancoDeHorasPage` becomes a thin dispatcher. Task 2 consumes this same `searchParams` shape (adds the `role === "colaborador"` branch next to it).

This is a behavior-preserving refactor: no new test is written (there's no new behavior to specify), the existing suite is the regression check.

- [ ] **Step 1: Run the existing suite to confirm a clean baseline**

Run: `cd apps/web && npx playwright test banco-de-horas.spec.ts`
Expected: PASS (6 tests) — this is the baseline the refactor must not break.

- [ ] **Step 2: Extract the gestor/RH body into `TeamView`**

In `apps/web/src/app/(app)/banco-de-horas/page.tsx`, replace the `export default async function BancoDeHorasPage({ searchParams }: PageProps<"/banco-de-horas">) { ... }` function (the whole current body, from the session/role guard through the closing `}`) with:

```typescript
export default async function BancoDeHorasPage({ searchParams }: PageProps<"/banco-de-horas">) {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <ColaboradorView searchParams={await searchParams} />;
  }
  return <TeamView searchParams={await searchParams} />;
}

async function TeamView({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { start: startParam } = searchParams;
  const today = todaySaoPauloDateOnly();
  const currentMonthStart = firstDayOfMonth(today);
  const requestedStart =
    typeof startParam === "string" && isValidDateOnly(startParam)
      ? firstDayOfMonth(startParam)
      : currentMonthStart;
  // Never navigate into a future month — clamp forward requests back to the
  // current month, matching the API's own "never a future date" rule.
  const start = requestedStart > currentMonthStart ? currentMonthStart : requestedStart;
  const isCurrentMonth = start === currentMonthStart;
  const end = isCurrentMonth ? today : lastDayOfMonth(start);
  const prevMonthStart = addMonths(start, -1);
  const nextMonthStart = addMonths(start, 1);

  const team = await apiFetchJson<TeamSummary[]>(
    `/banco-de-horas/equipe?start=${start}&end=${end}`,
  );

  if (team.length === 0) {
    return (
      <EmptyState
        title="Banco de Horas"
        description="O saldo de banco de horas da equipe vai aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Banco de Horas</h1>

      <nav className={styles.periodNav}>
        <a className={styles.periodNavLink} href={`/banco-de-horas?start=${prevMonthStart}`}>
          ← Mês anterior
        </a>
        <span className={styles.periodRange}>Saldo de {formatMonthLabel(start)}</span>
        {isCurrentMonth ? null : (
          <a className={styles.periodNavLink} href={`/banco-de-horas?start=${nextMonthStart}`}>
            Próximo mês →
          </a>
        )}
      </nav>

      <ul className={styles.list}>
        {team.map((entry) => (
          <li key={entry.userId} className={styles.item}>
            <span className={styles.itemName}>{entry.userName}</span>
            <span className={styles.itemDetail}>
              Valor-hora:{" "}
              {entry.hourlyRateBRL === null ? "—" : formatBRL(entry.hourlyRateBRL)} · Saldo:{" "}
              {formatSignedMinutes(entry.balanceMinutes)} · DSR:{" "}
              {formatSignedMinutes(entry.dsrMinutes)} · Extras:{" "}
              {entry.overtimeValueBRL === null ? "—" : formatBRL(entry.overtimeValueBRL)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Note the signature change: `TeamView` takes an already-resolved `searchParams: { start?: string }` (not the `PageProps` promise type) — the `await searchParams` now happens once, in `BancoDeHorasPage`, before dispatching to either view.

Add a minimal `ColaboradorView` stub just below `TeamView` so the file compiles — Task 2, Step 4 replaces its body with the real implementation:

```typescript
async function ColaboradorView({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  void searchParams;
  return <div className={styles.page} />;
}
```

- [ ] **Step 3: Run the suite to confirm no regression**

Run: `cd apps/web && npx playwright test banco-de-horas.spec.ts`
Expected: PASS (6 tests) — identical to Step 1's baseline.

- [ ] **Step 4: Typecheck and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint "src/app/(app)/banco-de-horas/page.tsx"`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/banco-de-horas/page.tsx"
git commit -m "refactor(web): extract TeamView out of BancoDeHorasPage, no behavior change"
```

---

### Task 2: `ColaboradorView` — período fixo, saldo e tabela diária

**Files:**
- Modify: `apps/web/src/app/(app)/banco-de-horas/page.tsx`
- Modify: `apps/web/src/app/(app)/banco-de-horas/banco-de-horas.module.css`
- Modify: `apps/web/e2e/test-session.ts`
- Modify: `apps/web/e2e/banco-de-horas.spec.ts`

**Interfaces:**
- Consumes: `TeamView`, module-scoped helpers (`todaySaoPauloDateOnly`, `firstDayOfMonth`, `lastDayOfMonth`, `addMonths`, `formatSignedMinutes`, `formatBRL`) from Task 1 — all already in this file.
- Produces: `type MinhaSummary`, `type DailySummary`, `type Periodo`, `formatMinutes(totalMinutes: number): string`, `formatDayLabel(dateStr: string): string`, `resolvePeriodo`, `periodoRange` — all module-scoped in `page.tsx`, consumed by Task 3 (which adds the compensation form/list to the same `ColaboradorView`).

- [ ] **Step 1: Write the failing e2e tests**

The existing test `"colaborador sees a permission message instead of the team's banco de horas"` in `apps/web/e2e/banco-de-horas.spec.ts` is no longer true (colaborador now gets a real page) — replace it and add new tests. Replace that one test with:

```typescript
test("colaborador sees their own saldo, DSR, and daily breakdown for the current month", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [
        { date: "2026-08-01", expectedMinutes: 480, workedMinutes: 480, diffMinutes: 0 },
        { date: "2026-08-02", expectedMinutes: 480, workedMinutes: 420, diffMinutes: -60 },
      ],
      // -75 (summary) deliberately differs from any per-day diffMinutes
      // (0, -60) so the two "-1h Xmin"-shaped strings can't collide under
      // Playwright's strict-mode text matching.
      balanceMinutes: -75,
      dsrMinutes: 0,
      hourlyRateBRL: 45.45,
      overtimeValueBRL: null,
    },
    myCompensations: [],
  });

  await page.goto("/banco-de-horas");

  await expect(page.getByRole("heading", { name: "Banco de Horas" })).toBeVisible();
  await expect(page.getByText("-1h 15min")).toBeVisible();
  await expect(page.getByText(/R\$\s?45,45/)).toBeVisible();

  // Both days share "Previsto: 8h 00min" (same expectedMinutes) — scope to
  // one row via its unique date label instead of asserting on page-wide text.
  const row = page.locator("li", { hasText: "02/08" });
  await expect(row).toContainText("Previsto: 8h 00min");
  await expect(row).toContainText("Trabalhado: 7h 00min");
  await expect(row).toContainText("Diferença: -1h 00min");
});

test("colaborador's period tabs switch between mês atual, anterior and últimos 3 meses", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [],
      balanceMinutes: 0,
      dsrMinutes: 0,
      hourlyRateBRL: null,
      overtimeValueBRL: null,
    },
    myCompensations: [],
  });

  await page.goto("/banco-de-horas");

  const atual = page.getByRole("link", { name: "Mês atual" });
  const anterior = page.getByRole("link", { name: "Mês anterior" });
  const tresMeses = page.getByRole("link", { name: "Últimos 3 meses" });
  await expect(atual).toBeVisible();
  await expect(anterior).toBeVisible();
  await expect(tresMeses).toBeVisible();

  await tresMeses.click();
  await expect(page).toHaveURL(/periodo=3meses/);

  await anterior.click();
  await expect(page).toHaveURL(/periodo=anterior/);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && npx playwright test banco-de-horas.spec.ts`
Expected: FAIL — `mockApi` doesn't accept `bancoDeHorasMinhas`/`myCompensations` yet, and `ColaboradorView` is still the Task 1 stub.

- [ ] **Step 3: Extend `mockApi` in `test-session.ts`**

In `apps/web/e2e/test-session.ts`, add two keys to `mockApi`'s `data` parameter type, right after `holerites?: unknown[];`:

```typescript
    bancoDeHorasMinhas?: unknown;
    myCompensations?: unknown[];
```

And two seed blocks in the function body, right after the `if (data.holerites) { ... }` block:

```typescript
  if (data.bancoDeHorasMinhas) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/banco-de-horas/minhas", response: data.bancoDeHorasMinhas },
    });
  }
  if (data.myCompensations) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/compensacoes", response: data.myCompensations },
    });
  }
```

- [ ] **Step 4: Replace the `ColaboradorView` stub with the real implementation**

In `apps/web/src/app/(app)/banco-de-horas/page.tsx`, add these types near the existing `TeamSummary` type:

```typescript
type DailySummary = { date: string; expectedMinutes: number; workedMinutes: number; diffMinutes: number };
type MinhaSummary = {
  days: DailySummary[];
  balanceMinutes: number;
  dsrMinutes: number;
  hourlyRateBRL: number | null;
  overtimeValueBRL: number | null;
};
type Periodo = "atual" | "anterior" | "3meses";
```

Add these pure functions near the other date helpers:

```typescript
function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function resolvePeriodo(value: string | undefined): Periodo {
  return value === "anterior" || value === "3meses" ? value : "atual";
}

function periodoRange(periodo: Periodo): { start: string; end: string } {
  const today = todaySaoPauloDateOnly();
  const currentMonthStart = firstDayOfMonth(today);
  if (periodo === "atual") {
    return { start: currentMonthStart, end: today };
  }
  if (periodo === "anterior") {
    const start = addMonths(currentMonthStart, -1);
    return { start, end: lastDayOfMonth(start) };
  }
  return { start: addMonths(currentMonthStart, -2), end: today };
}

const PERIODO_LABEL: Record<Periodo, string> = {
  atual: "Mês atual",
  anterior: "Mês anterior",
  "3meses": "Últimos 3 meses",
};
```

Replace the Task 1 stub with:

```typescript
async function ColaboradorView({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const periodoParam = searchParams.periodo;
  const periodo = resolvePeriodo(typeof periodoParam === "string" ? periodoParam : undefined);
  const { start, end } = periodoRange(periodo);

  const summary = await apiFetchJson<MinhaSummary>(
    `/banco-de-horas/minhas?start=${start}&end=${end}`,
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Banco de Horas</h1>

      <div className={styles.periodTabs}>
        {(["atual", "anterior", "3meses"] as const).map((option) => (
          <a
            key={option}
            className={
              periodo === option ? `${styles.periodTab} ${styles.periodTabActive}` : styles.periodTab
            }
            href={`/banco-de-horas?periodo=${option}`}
          >
            {PERIODO_LABEL[option]}
          </a>
        ))}
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Saldo</span>
          <span className={styles.summaryValue}>{formatSignedMinutes(summary.balanceMinutes)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>DSR estimado</span>
          <span className={styles.summaryValue}>{formatSignedMinutes(summary.dsrMinutes)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Valor-hora</span>
          <span className={styles.summaryValue}>
            {summary.hourlyRateBRL === null ? "—" : formatBRL(summary.hourlyRateBRL)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Extras em R$</span>
          <span className={styles.summaryValue}>
            {summary.overtimeValueBRL === null ? "—" : formatBRL(summary.overtimeValueBRL)}
          </span>
        </div>
      </div>

      <ul className={styles.list}>
        {summary.days.map((day) => (
          <li key={day.date} className={styles.item}>
            <span className={styles.itemName}>{formatDayLabel(day.date)}</span>
            <span className={styles.itemDetail}>
              Previsto: {formatMinutes(day.expectedMinutes)} · Trabalhado:{" "}
              {formatMinutes(day.workedMinutes)} · Diferença: {formatSignedMinutes(day.diffMinutes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Add the new CSS classes**

Append to `apps/web/src/app/(app)/banco-de-horas/banco-de-horas.module.css`:

```css
.periodTabs {
  display: flex;
  gap: 8px;
}

.periodTab {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-background-element);
}

.periodTab:hover {
  color: var(--color-text);
}

.periodTabActive,
.periodTabActive:hover {
  background: var(--color-text);
  color: var(--color-background);
}

.summaryCard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  padding: 20px;
  border-radius: 12px;
  background: var(--color-background-element);
}

.summaryItem {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summaryLabel {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.summaryValue {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
}
```

- [ ] **Step 6: Run the e2e tests to confirm they pass**

Run: `cd apps/web && npx playwright test banco-de-horas.spec.ts`
Expected: PASS (7 tests — the 5 pre-existing gestor/RH tests plus the 2 new colaborador tests)

- [ ] **Step 7: Typecheck and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint "src/app/(app)/banco-de-horas/page.tsx" e2e/test-session.ts e2e/banco-de-horas.spec.ts`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(app)/banco-de-horas/page.tsx" "apps/web/src/app/(app)/banco-de-horas/banco-de-horas.module.css" apps/web/e2e/test-session.ts apps/web/e2e/banco-de-horas.spec.ts
git commit -m "feat(web): colaborador sees their own banco de horas saldo and daily breakdown"
```

---

### Task 3: Solicitar e acompanhar compensação de banco de horas

**Files:**
- Create: `apps/web/src/app/(app)/banco-de-horas/actions.ts`
- Modify: `apps/web/src/app/(app)/banco-de-horas/page.tsx`
- Modify: `apps/web/src/app/(app)/banco-de-horas/banco-de-horas.module.css`
- Modify: `apps/web/e2e/banco-de-horas.spec.ts`

**Interfaces:**
- Consumes: `ColaboradorView`, `styles` from Task 2.
- Produces: `requestCompensation(formData: FormData): Promise<void>` (Server Action, exported from `actions.ts`), `type CompensationRequest`.

- [ ] **Step 1: Write the failing e2e tests**

Append to `apps/web/e2e/banco-de-horas.spec.ts`:

```typescript
test("colaborador sees their own compensation requests, including the reviewer's note on a recusado one", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [],
      balanceMinutes: 0,
      dsrMinutes: 0,
      hourlyRateBRL: null,
      overtimeValueBRL: null,
    },
    myCompensations: [
      {
        id: "cp-1",
        reason: "Compensar 2h de plantão",
        status: "recusado",
        reviewNote: "Saldo insuficiente",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/banco-de-horas");

  await expect(page.getByText("Compensar 2h de plantão")).toBeVisible();
  await expect(page.getByText("Recusado")).toBeVisible();
  await expect(page.getByText("Saldo insuficiente")).toBeVisible();
});

test("shows a message when there are no compensation requests yet", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [],
      balanceMinutes: 0,
      dsrMinutes: 0,
      hourlyRateBRL: null,
      overtimeValueBRL: null,
    },
    myCompensations: [],
  });

  await page.goto("/banco-de-horas");

  await expect(page.getByText("Nenhuma solicitação registrada ainda.")).toBeVisible();
});

test("submitting the compensation form posts the reason to the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    bancoDeHorasMinhas: {
      days: [],
      balanceMinutes: 0,
      dsrMinutes: 0,
      hourlyRateBRL: null,
      overtimeValueBRL: null,
    },
    myCompensations: [],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/solicitacoes/compensacoes",
    status: 201,
    response: { id: "cp-new", reason: "Compensar plantão de sábado", status: "pendente" },
  });

  await page.goto("/banco-de-horas");
  await page.getByLabel("Motivo").fill("Compensar plantão de sábado");
  await page.getByRole("button", { name: "Enviar solicitação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "POST" && r.path === "/solicitacoes/compensacoes",
      )?.body;
    })
    .toEqual({ reason: "Compensar plantão de sábado" });
});
```

Add `getRecordedRequests` and `seedResponse` to the existing `import { addSessionCookie, mockApi } from "./test-session";` line at the top of the file, making it:

```typescript
import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && npx playwright test banco-de-horas.spec.ts`
Expected: FAIL — no form, no compensation list, `actions.ts` doesn't exist yet.

- [ ] **Step 3: Write the Server Action**

Create `apps/web/src/app/(app)/banco-de-horas/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function requestCompensation(formData: FormData) {
  const reason = formData.get("reason");
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new Error("Motivo é obrigatório.");
  }
  const res = await apiFetch("/solicitacoes/compensacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    throw new Error(`/solicitacoes/compensacoes responded with ${res.status}`);
  }
  revalidatePath("/banco-de-horas");
}
```

- [ ] **Step 4: Add the compensation type, form, and list to `ColaboradorView`**

In `apps/web/src/app/(app)/banco-de-horas/page.tsx`, add the import at the top:

```typescript
import { requestCompensation } from "./actions";
```

Add the type near `MinhaSummary`:

```typescript
type CompensationRequest = {
  id: string;
  reason: string;
  status: "pendente" | "aprovado" | "recusado";
  reviewNote: string | null;
  createdAt: string;
};

const COMPENSATION_STATUS_LABEL: Record<CompensationRequest["status"], string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};
```

In `ColaboradorView`, fetch the compensation list alongside the summary (replace the single `apiFetchJson` call with a `Promise.all`):

```typescript
  const [summary, minhasSolicitacoes] = await Promise.all([
    apiFetchJson<MinhaSummary>(`/banco-de-horas/minhas?start=${start}&end=${end}`),
    apiFetchJson<CompensationRequest[]>("/solicitacoes/compensacoes"),
  ]);
```

Append this markup right after the daily-table `<ul>` closes, still inside the outer `<div className={styles.page}>`:

```typescript
      <h2 className={styles.sectionTitle}>Solicitar compensação</h2>
      <form className={styles.form} action={requestCompensation}>
        <label htmlFor="reason">Motivo</label>
        <textarea id="reason" name="reason" className={styles.textarea} required />
        <button type="submit" className={styles.submitButton}>
          Enviar solicitação
        </button>
      </form>

      <h2 className={styles.sectionTitle}>Minhas solicitações</h2>
      {minhasSolicitacoes.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhuma solicitação registrada ainda.</p>
      ) : (
        <ul className={styles.list}>
          {minhasSolicitacoes.map((solicitacao) => (
            <li key={solicitacao.id} className={styles.item}>
              <span className={styles.itemDetail}>
                {solicitacao.reason}
                {solicitacao.reviewNote ? ` · ${solicitacao.reviewNote}` : ""}
              </span>
              <span
                className={`${styles.status} ${
                  solicitacao.status === "aprovado" ? styles.statusAprovado : ""
                } ${solicitacao.status === "recusado" ? styles.statusRecusado : ""}`}
              >
                {COMPENSATION_STATUS_LABEL[solicitacao.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
```

- [ ] **Step 5: Add the remaining CSS classes**

Append to `apps/web/src/app/(app)/banco-de-horas/banco-de-horas.module.css`:

```css
.sectionTitle {
  font-size: 18px;
  font-weight: 600;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.textarea {
  min-height: 80px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-background-selected);
  background: var(--color-background-element);
  color: var(--color-text);
  font: inherit;
  resize: vertical;
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

- [ ] **Step 6: Run the e2e tests to confirm they pass**

Run: `cd apps/web && npx playwright test banco-de-horas.spec.ts`
Expected: PASS (10 tests)

- [ ] **Step 7: Run the full web e2e suite to confirm no regressions**

Run: `cd apps/web && npx playwright test`
Expected: PASS (all tests except the already-known, pre-existing, unrelated `search.spec.ts` "Ctrl+K opens..." flake — do not attempt to fix that test as part of this task)

- [ ] **Step 8: Typecheck and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint "src/app/(app)/banco-de-horas" e2e/banco-de-horas.spec.ts`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add "apps/web/src/app/(app)/banco-de-horas" apps/web/e2e/banco-de-horas.spec.ts
git commit -m "feat(web): colaborador can request and track banco de horas compensation"
```

---

### Task 4: Sidebar entry and search

**Files:**
- Modify: `apps/web/src/lib/nav-sections.ts`
- Modify: `apps/web/e2e/app-shell.spec.ts`
- Modify: `apps/web/e2e/search.spec.ts`

**Interfaces:**
- Consumes: `COLABORADOR_SIDEBAR`, `NAV_SECTIONS` shapes (unchanged) from `apps/web/src/lib/nav-sections.ts`.

`NAV_SECTIONS`'s `/banco-de-horas` entry currently has `roles: ["gestor", "rh"]` — that array is what the global search overlay filters by for every role (see the file's own comment: "roles mirrors each page's own session.role guard"), so as it stands a colaborador's search would never surface "Banco de Horas" even after Tasks 1-3 ship. This task corrects that gap alongside adding the sidebar entry.

- [ ] **Step 1: Write the failing tests**

In `apps/web/e2e/app-shell.spec.ts`, add this assertion to the existing test `"colaborador sees a curated, grouped sidebar instead of the gestor/rh menu"`, right after the `await expect(page.getByRole("link", { name: "Ponto", exact: true })).toBeVisible();` line:

```typescript
  await expect(page.getByRole("link", { name: "Banco de Horas" })).toBeVisible();
```

Append to `apps/web/e2e/search.spec.ts`:

```typescript
test("colaborador can find Banco de Horas via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("banco");
  await expect(page.getByRole("button", { name: "Banco de Horas" })).toBeVisible();
});
```

`search.spec.ts` already imports `addSessionCookie` (`import { addSessionCookie, mockApi } from "./test-session";`) — no import change needed.

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && npx playwright test app-shell.spec.ts search.spec.ts`
Expected: FAIL — "Banco de Horas" isn't in `COLABORADOR_SIDEBAR` yet, and its `NAV_SECTIONS` entry doesn't include `"colaborador"` yet.

- [ ] **Step 3: Update `nav-sections.ts`**

Change the `/banco-de-horas` line inside `NAV_SECTIONS` from:

```typescript
  { href: "/banco-de-horas", label: "Banco de Horas", roles: ["gestor", "rh"] },
```

to:

```typescript
  { href: "/banco-de-horas", label: "Banco de Horas", roles: ["gestor", "rh", "colaborador"] },
```

Add a new top-level entry to `COLABORADOR_SIDEBAR`, right after the "Ponto" group's closing `},`:

```typescript
  { href: "/banco-de-horas", label: "Banco de Horas" },
```

so the array reads:

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
];
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd apps/web && npx playwright test app-shell.spec.ts search.spec.ts`
Expected: PASS

- [ ] **Step 5: Run the full web e2e suite to confirm no regressions**

Run: `cd apps/web && npx playwright test`
Expected: PASS (all tests except the already-known, pre-existing, unrelated `search.spec.ts` "Ctrl+K opens..." flake)

- [ ] **Step 6: Typecheck and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint src/lib/nav-sections.ts e2e/app-shell.spec.ts e2e/search.spec.ts`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/nav-sections.ts apps/web/e2e/app-shell.spec.ts apps/web/e2e/search.spec.ts
git commit -m "feat(web): add Banco de Horas to the colaborador sidebar and search"
```
