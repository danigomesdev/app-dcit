# Histórico de Pontos + Folha de Ponto — Colaborador — Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `colaborador` view their full punch history (`/historico`) and a per-day worked-hours breakdown with PDF export (`/folha`) on the web — both already exist on mobile, neither exists on web.

**Architecture:** Two new Server Component pages under `apps/web/src/app/(app)/`, both reusing the same `GET /time-entries` endpoint the punch card (`/`) already uses — no backend changes. `/folha`'s day-by-day breakdown pairs punches over the *entire* chronological history (not per calendar day) before attributing a completed pair's minutes to the São-Paulo day it closes on — the same fix just applied to the punch card's "worked today" math (`docs/superpowers/plans/2026-08-31-bater-ponto-colaborador-web.md`, commit `8dc3fa1`), applied here from the start so this sub-project doesn't reintroduce the bug it just fixed elsewhere. PDF export is `window.print()` plus a print stylesheet — no new dependency.

**Tech Stack:** Next.js App Router (Server Components; one small Client Component for the print button), Playwright e2e (this app has no unit test runner).

**Spec:** [`docs/superpowers/specs/2026-08-31-historico-folha-colaborador-web-design.md`](../specs/2026-08-31-historico-folha-colaborador-web-design.md)

## Global Constraints

- Access guard on `/historico` and `/folha` is *inverted* from every other page in this app: block everyone who is **not** `colaborador`, not the reverse.
- `/folha`'s worked-minutes math must pair punches over the *entire* chronological history first, then attribute each completed pair's minutes to the São-Paulo calendar date its *end* falls on — never bucket entries by day before pairing (that reintroduces the overnight-shift bug fixed in commit `8dc3fa1`).
- No new dependency and no backend/PDF-generation code — "Exportar PDF" is `window.print()` plus a print stylesheet.
- Every displayed date/time on these two pages uses an explicit `timeZone: "America/Sao_Paulo"` in `Intl`/`toLocaleString` calls — never the ambient server/browser timezone.
- `apps/web/src/components/nav-links.tsx` keeps rendering every `NAV_SECTIONS` entry to every role (only the search overlay filters by role) — do not add role-filtering to the sidebar itself.

---

### Task 1: `/historico` — full punch history, newest first

**Files:**
- Create: `apps/web/src/app/(app)/historico/page.tsx`
- Create: `apps/web/src/app/(app)/historico/historico.module.css`
- Create: `apps/web/e2e/historico.spec.ts`

**Interfaces:**
- Produces: `HistoricoPage` (default export, Server Component, no props — reads session/fetches data itself), matching the file-based routing convention (`/historico`).

- [ ] **Step 1: Write the failing e2e test**

Create `apps/web/e2e/historico.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, seedResponse } from "./test-session";

test("gestor and rh see a permission message instead of the history", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/historico");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await page.goto("/historico");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("shows an empty state when there's no punch on record", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/historico");
  await expect(page.getByRole("heading", { name: "Histórico de pontos" })).toBeVisible();
  await expect(page.getByText("Nenhum ponto registrado ainda.")).toBeVisible();
});

test("lists every punch, most recent first, in São Paulo time", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [
      { id: "te-1", clockedAt: "2026-08-19T12:00:00-03:00" },
      { id: "te-2", clockedAt: "2026-08-20T09:30:00-03:00" },
    ],
  });

  await page.goto("/historico");

  const rows = page.locator("ul > li");
  await expect(rows).toHaveCount(2);
  // Newest first: the 08-20 entry comes before the 08-19 one.
  await expect(rows.nth(0)).toContainText("20 de agosto");
  await expect(rows.nth(0)).toContainText("09:30");
  await expect(rows.nth(1)).toContainText("19 de agosto");
  await expect(rows.nth(1)).toContainText("12:00");
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && npx playwright test historico.spec.ts`
Expected: FAIL — `/historico` doesn't exist yet (404).

- [ ] **Step 3: Write the page**

Create `apps/web/src/app/(app)/historico/page.tsx`:

```typescript
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./historico.module.css";

type TimeEntry = { id: string; clockedAt: string };

export default async function HistoricoPage() {
  const session = await getSession();
  if (!session || session.role !== "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é pessoal, restrita a colaboradores."
      />
    );
  }

  const entries = await apiFetchJson<TimeEntry[]>("/time-entries");
  const sorted = [...entries].sort(
    (a, b) => new Date(b.clockedAt).getTime() - new Date(a.clockedAt).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="Histórico de pontos"
        description="Nenhum ponto registrado ainda."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Histórico de pontos</h1>
      <ul className={styles.list}>
        {sorted.map((entry) => {
          const date = new Date(entry.clockedAt);
          return (
            <li key={entry.id} className={styles.item}>
              <span className={styles.itemDate}>
                {date.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  timeZone: "America/Sao_Paulo",
                })}
              </span>
              <span className={styles.itemTime}>
                {date.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Sao_Paulo",
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Add the CSS**

Create `apps/web/src/app/(app)/historico/historico.module.css`:

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

.list {
  list-style: none;
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

.itemDate {
  font-weight: 600;
  color: var(--color-text);
}

.itemTime {
  color: var(--color-text-secondary);
}
```

- [ ] **Step 5: Run the e2e test to confirm it passes**

Run: `cd apps/web && npx playwright test historico.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Typecheck and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint src/app/\(app\)/historico`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(app\)/historico apps/web/e2e/historico.spec.ts
git commit -m "feat(web): add /historico — a colaborador's full punch history"
```

---

### Task 2: `/folha` — per-day worked hours + PDF export

**Files:**
- Create: `apps/web/src/app/(app)/folha/page.tsx`
- Create: `apps/web/src/app/(app)/folha/exportar-pdf-button.tsx`
- Create: `apps/web/src/app/(app)/folha/folha.module.css`
- Modify: `apps/web/src/components/app-shell.module.css`
- Create: `apps/web/e2e/folha.spec.ts`

**Interfaces:**
- Produces: `ExportarPdfButton` (default export... no — named export `ExportarPdfButton`, from `exportar-pdf-button.tsx`, a Client Component with no props, `onClick={() => window.print()}`), consumed only by `folha/page.tsx`.

- [ ] **Step 1: Write the failing e2e test**

Create `apps/web/e2e/folha.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, seedResponse } from "./test-session";

test.use({ timezoneId: "America/Sao_Paulo" });

test("gestor and rh see a permission message instead of the folha", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/folha");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("shows an empty state when no day has a punch on record", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/folha");
  await expect(page.getByRole("heading", { name: "Folha de ponto" })).toBeVisible();
  await expect(page.getByText("Nenhum dia registrado ainda.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Exportar PDF" })).toHaveCount(0);
});

test("groups punches by day and sums worked minutes per day, most recent day first", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [
      { id: "te-1", clockedAt: "2026-08-19T09:00:00-03:00" },
      { id: "te-2", clockedAt: "2026-08-19T11:00:00-03:00" },
      { id: "te-3", clockedAt: "2026-08-20T09:00:00-03:00" },
      { id: "te-4", clockedAt: "2026-08-20T13:30:00-03:00" },
    ],
  });

  await page.goto("/folha");

  const rows = page.locator("ul > li");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("20 de agosto");
  await expect(rows.nth(0)).toContainText("4h 30min");
  await expect(rows.nth(1)).toContainText("19 de agosto");
  await expect(rows.nth(1)).toContainText("2h 00min");
});

test("credits an overnight shift's hours to the day it closes on, not the day it started", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  // Clock-in Aug 19 23:00 SP, clock-out Aug 20 01:00 SP — a 2-hour shift
  // crossing midnight. Grouping by day *before* pairing (the mobile app's
  // bug, and the punch card's pre-fix bug — see commit 8dc3fa1) would
  // strand the clock-in on Aug 19 and the clock-out on Aug 20, each
  // showing up unpaired instead of one completed 2-hour shift on Aug 20.
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [
      { id: "te-in", clockedAt: "2026-08-19T23:00:00-03:00" },
      { id: "te-out", clockedAt: "2026-08-20T01:00:00-03:00" },
    ],
  });

  await page.goto("/folha");

  const rows = page.locator("ul > li");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("20 de agosto");
  await expect(rows.nth(0)).toContainText("2h 00min");
});

test("shows an open-shift day for a trailing unpaired punch", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [{ id: "te-open", clockedAt: "2026-08-20T09:00:00-03:00" }],
  });

  await page.goto("/folha");

  const rows = page.locator("ul > li");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("20 de agosto");
  await expect(rows.nth(0)).toContainText("0h 00min");
  await expect(rows.nth(0)).toContainText("ponto em aberto");
});

test("exports via window.print, and hides sidebar/topbar while printing", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/time-entries",
    response: [{ id: "te-1", clockedAt: "2026-08-20T09:00:00-03:00" }],
  });

  await page.addInitScript(() => {
    (window as unknown as { __printed: boolean }).__printed = false;
    window.print = () => {
      (window as unknown as { __printed: boolean }).__printed = true;
    };
  });

  await page.goto("/folha");
  await page.getByRole("button", { name: "Exportar PDF" }).click();

  const printed = await page.evaluate(() => (window as unknown as { __printed: boolean }).__printed);
  expect(printed).toBe(true);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && npx playwright test folha.spec.ts`
Expected: FAIL — `/folha` doesn't exist yet (404).

- [ ] **Step 3: Write the PDF export button**

Create `apps/web/src/app/(app)/folha/exportar-pdf-button.tsx`:

```typescript
"use client";

import styles from "./folha.module.css";

export function ExportarPdfButton() {
  return (
    <button type="button" className={styles.exportButton} onClick={() => window.print()}>
      Exportar PDF
    </button>
  );
}
```

- [ ] **Step 4: Write the page**

Create `apps/web/src/app/(app)/folha/page.tsx`:

```typescript
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ExportarPdfButton } from "./exportar-pdf-button";
import styles from "./folha.module.css";

type TimeEntry = { id: string; clockedAt: string };
type DayRow = { day: string; label: string; workedMinutes: number; isOpen: boolean };

// Same reasoning as apps/web/src/app/(app)/meu-ponto-card.tsx's
// dateOnlyInSaoPaulo (colocated copy, not a shared import).
function dateOnlyInSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatDayLabel(day: string): string {
  return new Date(`${day}T00:00:00-03:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

// Pairs over the *entire* chronological history before attributing minutes
// to a day — never buckets entries by day first (see this plan's Global
// Constraints; commit 8dc3fa1 fixed the same class of bug on the punch
// card). A completed pair's minutes count toward the São Paulo date its
// *end* falls on. At most one trailing entry can ever be unpaired (a
// linear alternating stream can't have two), so there's at most one open
// day.
function groupByDay(entries: TimeEntry[]): DayRow[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.clockedAt).getTime() - new Date(b.clockedAt).getTime(),
  );

  const minutesByDay = new Map<string, number>();
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const start = new Date(sorted[i].clockedAt).getTime();
    const end = new Date(sorted[i + 1].clockedAt).getTime();
    const day = dateOnlyInSaoPaulo(new Date(sorted[i + 1].clockedAt));
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + (end - start) / 60000);
  }

  const openDay =
    sorted.length % 2 === 1 ? dateOnlyInSaoPaulo(new Date(sorted[sorted.length - 1].clockedAt)) : null;
  if (openDay !== null && !minutesByDay.has(openDay)) {
    minutesByDay.set(openDay, 0);
  }

  return [...minutesByDay.entries()]
    .map(([day, minutes]) => ({
      day,
      label: formatDayLabel(day),
      workedMinutes: Math.round(minutes),
      isOpen: day === openDay,
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

export default async function FolhaPage() {
  const session = await getSession();
  if (!session || session.role !== "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é pessoal, restrita a colaboradores."
      />
    );
  }

  const entries = await apiFetchJson<TimeEntry[]>("/time-entries");
  const days = groupByDay(entries);

  if (days.length === 0) {
    return (
      <EmptyState
        title="Folha de ponto"
        description="Nenhum dia registrado ainda."
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Folha de ponto</h1>
        <ExportarPdfButton />
      </div>
      <ul className={styles.list}>
        {days.map((row) => (
          <li key={row.day} className={styles.item}>
            <span className={styles.itemDate}>{row.label}</span>
            <span className={styles.itemHours}>
              {formatMinutes(row.workedMinutes)}
              {row.isOpen ? " · ponto em aberto" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Add the CSS, including the print rule**

Create `apps/web/src/app/(app)/folha/folha.module.css`:

```css
.page {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.headingRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.heading {
  font-size: 24px;
  font-weight: 600;
}

.exportButton {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-background);
  background: var(--color-text);
  cursor: pointer;
}

.exportButton:hover {
  opacity: 0.85;
}

@media print {
  .exportButton {
    display: none;
  }
}

.list {
  list-style: none;
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

.itemDate {
  font-weight: 600;
  color: var(--color-text);
}

.itemHours {
  color: var(--color-text-secondary);
}
```

Append to `apps/web/src/components/app-shell.module.css`:

```css
@media print {
  .sidebar,
  .topbar {
    display: none;
  }
}
```

- [ ] **Step 6: Run the e2e test to confirm it passes**

Run: `cd apps/web && npx playwright test folha.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Run the full web e2e suite to confirm no regressions**

Run: `cd apps/web && npx playwright test`
Expected: PASS (all tests except the already-known, pre-existing, unrelated `search.spec.ts` "Ctrl+K opens..." flake — do not attempt to fix that test as part of this task)

- [ ] **Step 8: Typecheck and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint src/app/\(app\)/folha src/components/app-shell.module.css`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/\(app\)/folha apps/web/src/components/app-shell.module.css apps/web/e2e/folha.spec.ts
git commit -m "feat(web): add /folha — per-day worked hours with PDF export"
```

---

### Task 3: Make Histórico and Folha findable via search, and add sidebar entries

**Files:**
- Modify: `apps/web/src/lib/nav-sections.ts`
- Modify: `apps/web/e2e/search.spec.ts`

**Interfaces:**
- Consumes: `NAV_SECTIONS` array shape from `apps/web/src/lib/nav-sections.ts` (unchanged shape — two new entries added).

- [ ] **Step 1: Write the failing test**

Append to `apps/web/e2e/search.spec.ts`:

```typescript
test("colaborador can find Histórico and Folha via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("hist");
  await expect(page.getByRole("button", { name: "Histórico de Pontos" })).toBeVisible();

  await page.getByPlaceholder("Buscar telas...").fill("folha");
  await expect(page.getByRole("button", { name: "Folha de Ponto" })).toBeVisible();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && npx playwright test search.spec.ts`
Expected: FAIL — neither entry exists in `NAV_SECTIONS` yet.

- [ ] **Step 3: Add the two entries to `nav-sections.ts`**

In `apps/web/src/lib/nav-sections.ts`, add after the `"/"` entry:

```typescript
  { href: "/historico", label: "Histórico de Pontos", roles: ["colaborador"] },
  { href: "/folha", label: "Folha de Ponto", roles: ["colaborador"] },
```

- [ ] **Step 4: Run the e2e tests to confirm they pass**

Run: `cd apps/web && npx playwright test search.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full web e2e suite**

Run: `cd apps/web && npx playwright test`
Expected: PASS (all tests except the already-known, pre-existing, unrelated `search.spec.ts` "Ctrl+K opens..." flake)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/nav-sections.ts apps/web/e2e/search.spec.ts
git commit -m "feat(web): let a colaborador find Histórico and Folha through search"
```
