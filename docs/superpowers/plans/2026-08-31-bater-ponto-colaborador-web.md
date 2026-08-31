# Bater Ponto — Colaborador — Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `colaborador` visiting `/` on the web app punch their own time clock and see today's last punch and worked minutes — today every page (including `/`) blocks that role entirely.

**Architecture:** `apps/web/src/app/(app)/page.tsx` branches by role: `colaborador` renders a new client component (`MeuPontoCard`) backed by a Server Action (`punchTimeEntry`) that calls the existing `POST /time-entries`; `gestor`/`rh` keep today's `PresencePanel` team view untouched. No backend or mobile changes — `POST /time-entries` and `GET /time-entries` already accept any authenticated user and are unmodified.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Playwright e2e (this app has no unit test runner — see `apps/web/package.json`), the existing `apps/web/e2e/fake-api-server.mjs` stand-in API.

**Spec:** [`docs/superpowers/specs/2026-08-31-bater-ponto-colaborador-web-design.md`](../specs/2026-08-31-bater-ponto-colaborador-web-design.md)

## Global Constraints

- No reverse geocoding / external geocoding service — location display is raw `lat, long` coordinates only, or "Localização não disponível" (spec §4.3, confirmed in conversation).
- No offline queue, no push reminders — a failed punch shows an inline error and lets the person retry; no local queueing (spec §7).
- `gestor`/`rh` behavior at `/` must not change in any way (spec §4.1, §8).
- "Today" for filtering entries must be São Paulo-timezone-aware, not UTC-naive (spec §4.2) — mirror the existing `todaySaoPauloDateOnly` pattern already duplicated in `escala/page.tsx` and `banco-de-horas/page.tsx`, don't import between them.

---

### Task 1: `/` branches by role — colaborador can punch and see today's status

**Files:**
- Modify: `apps/web/src/app/(app)/page.tsx`
- Create: `apps/web/src/app/(app)/ponto-actions.ts`
- Create: `apps/web/src/app/(app)/meu-ponto-card.tsx`
- Modify: `apps/web/src/app/(app)/ponto.module.css`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Create: `apps/web/e2e/meu-ponto.spec.ts`

**Interfaces:**
- Produces: `punchTimeEntry(): Promise<{ id: string; clockedAt: string }>` (exported from `ponto-actions.ts`, a `"use server"` action called directly from a client `onClick`, same pattern as `getAtestadoPhoto` in `apps/web/src/app/(app)/documentos/actions.ts`). Throws on a non-2xx response.
- Produces: `MeuPontoCard({ name, initialEntries }: { name: string; initialEntries: { id: string; clockedAt: string }[] })` (exported from `meu-ponto-card.tsx`), used by `page.tsx`.

- [ ] **Step 1: Write the failing e2e test**

Create `apps/web/e2e/meu-ponto.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, seedResponse } from "./test-session";

test.use({ timezoneId: "America/Sao_Paulo" });

test("colaborador bate o ponto e vê o horário e as horas trabalhadas", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toHaveCount(0);
  await expect(page.getByText("Último ponto: --:--")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();

  await seedResponse(request, {
    method: "POST",
    path: "/time-entries",
    status: 201,
    response: { id: "te-1", clockedAt: "2026-08-20T12:00:00.000Z" },
  });
  await page.getByRole("button", { name: "Bater Ponto" }).click();
  await expect(page.getByText("Último ponto: 09:00")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 0h 00min")).toBeVisible();

  await seedResponse(request, {
    method: "POST",
    path: "/time-entries",
    status: 201,
    response: { id: "te-2", clockedAt: "2026-08-20T13:30:00.000Z" },
  });
  await page.getByRole("button", { name: "Bater Ponto" }).click();
  await expect(page.getByText("Último ponto: 10:30")).toBeVisible();
  await expect(page.getByText("Horas trabalhadas hoje: 1h 30min")).toBeVisible();
});

test("gestor keeps seeing the team presence panel at /, not the punch card", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Bater Ponto" })).toHaveCount(0);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && npx playwright test meu-ponto.spec.ts`
Expected: FAIL — `/` still shows the "Sem permissão" `EmptyState` for `colaborador-1` (current `page.tsx` blocks that role entirely), so `getByText("Último ponto: --:--")` never appears.

- [ ] **Step 3: Add the fake API server route for `GET /time-entries`**

In `apps/web/e2e/fake-api-server.mjs`, add this alongside the existing `/time-entries/team` handler (near line 70):

```javascript
  if (req.method === "GET" && url.pathname === "/time-entries") {
    return sendJson(res, 200, []);
  }
```

(No default handler needed for `POST /time-entries` — every test that punches seeds its own response via `seedResponse`, same convention as `POST /documentos/holerites` etc.)

- [ ] **Step 4: Write the Server Action**

Create `apps/web/src/app/(app)/ponto-actions.ts`:

```typescript
"use server";

import type { TimeEntryInput } from "@ponto-dcit/shared-types";

import { apiFetch } from "@/lib/api";

type TimeEntry = { id: string; clockedAt: string };

// userId is required by TimeEntryInputSchema but ignored server-side — the
// API always stamps clockedAt with its own clock and identifies the user
// via the auth token, not this payload (TimeEntriesController.create).
export async function punchTimeEntry(): Promise<TimeEntry> {
  const payload: TimeEntryInput = { userId: "web-user", clockedAt: new Date().toISOString() };
  const res = await apiFetch("/time-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`/time-entries responded with ${res.status}`);
  }
  return (await res.json()) as TimeEntry;
}
```

- [ ] **Step 5: Write `MeuPontoCard`**

Create `apps/web/src/app/(app)/meu-ponto-card.tsx`:

```typescript
"use client";

import { useState } from "react";

import { punchTimeEntry } from "./ponto-actions";
import styles from "./ponto.module.css";

type TimeEntry = { id: string; clockedAt: string };

function summarizeDay(dayEntries: TimeEntry[]) {
  const sorted = [...dayEntries].sort(
    (a, b) => new Date(a.clockedAt).getTime() - new Date(b.clockedAt).getTime(),
  );
  let workedMinutes = 0;
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const start = new Date(sorted[i].clockedAt).getTime();
    const end = new Date(sorted[i + 1].clockedAt).getTime();
    workedMinutes += (end - start) / 60000;
  }
  return { workedMinutes: Math.round(workedMinutes), sorted };
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

export function MeuPontoCard({
  name,
  initialEntries,
}: {
  name: string;
  initialEntries: TimeEntry[];
}) {
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handlePunch() {
    setPending(true);
    setError(null);
    try {
      const entry = await punchTimeEntry();
      setEntries((current) => [...current, entry]);
    } catch {
      setError("Falha ao registrar ponto. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  const { workedMinutes, sorted } = summarizeDay(entries);
  const lastEntry = sorted[sorted.length - 1];
  const lastPunchTime = lastEntry
    ? new Date(lastEntry.clockedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Olá, {name}</h1>
      <div className={styles.meuPontoCard}>
        <button
          type="button"
          className={styles.punchButton}
          onClick={handlePunch}
          disabled={pending}
        >
          Bater Ponto
        </button>
        <p className={styles.itemDetail}>Último ponto: {lastPunchTime}</p>
        <p className={styles.itemDetail}>Horas trabalhadas hoje: {formatMinutes(workedMinutes)}</p>
        {error ? <p className={styles.errorText}>{error}</p> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add the CSS classes**

Append to `apps/web/src/app/(app)/ponto.module.css`:

```css
.meuPontoCard {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  border-radius: 12px;
  background: var(--color-background-element);
  max-width: 360px;
}

.punchButton {
  appearance: none;
  border: none;
  border-radius: 999px;
  padding: 14px 32px;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-background);
  background: var(--color-text);
  cursor: pointer;
}

.punchButton:hover {
  opacity: 0.85;
}

.punchButton:disabled {
  opacity: 0.5;
  cursor: default;
}

.errorText {
  font-size: 13px;
  color: var(--color-status-danger);
}
```

- [ ] **Step 7: Branch `page.tsx` by role**

Replace the full contents of `apps/web/src/app/(app)/page.tsx`:

```typescript
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { MeuPontoCard } from "./meu-ponto-card";
import { PresencePanel, type TeamMember } from "./presence-panel";

type TimeEntry = { id: string; clockedAt: string };

// Explicit America/Sao_Paulo, not the server's ambient timezone — same
// reasoning as escala/page.tsx's todaySaoPauloDateOnly (colocated copy,
// not a shared import; see that file's comment for why).
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

function todaySaoPauloDateOnly(): string {
  return dateOnlyInSaoPaulo(new Date());
}

export default async function Home() {
  const session = await getSession();
  if (!session) {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  if (session.role === "colaborador") {
    const entries = await apiFetchJson<TimeEntry[]>("/time-entries");
    const today = todaySaoPauloDateOnly();
    const todayEntries = entries.filter(
      (entry) => dateOnlyInSaoPaulo(new Date(entry.clockedAt)) === today,
    );
    return <MeuPontoCard name={session.name} initialEntries={todayEntries} />;
  }

  const team = await apiFetchJson<TeamMember[]>("/time-entries/team");

  if (team.length === 0) {
    return (
      <EmptyState
        title="Ponto dos funcionários"
        description="A presença dos funcionários no dia vai aparecer aqui."
      />
    );
  }

  return <PresencePanel initialTeam={team} />;
}
```

- [ ] **Step 8: Run the e2e test to confirm it passes**

Run: `cd apps/web && npx playwright test meu-ponto.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Run the full web e2e suite to confirm no regressions**

Run: `cd apps/web && npx playwright test`
Expected: PASS (all tests, including `home.spec.ts` and `app-shell.spec.ts` unchanged)

- [ ] **Step 10: Typecheck and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint src/app/\(app\)/page.tsx src/app/\(app\)/ponto-actions.ts src/app/\(app\)/meu-ponto-card.tsx`
Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/\(app\)/page.tsx apps/web/src/app/\(app\)/ponto-actions.ts apps/web/src/app/\(app\)/meu-ponto-card.tsx apps/web/src/app/\(app\)/ponto.module.css apps/web/e2e/fake-api-server.mjs apps/web/e2e/meu-ponto.spec.ts
git commit -m "feat(web): let a colaborador punch their own time clock at /"
```

---

### Task 2: Show device location on the punch card (coordinates only, non-blocking)

**Files:**
- Modify: `apps/web/src/app/(app)/meu-ponto-card.tsx`
- Modify: `apps/web/src/app/(app)/ponto.module.css`
- Modify: `apps/web/e2e/meu-ponto.spec.ts`

**Interfaces:**
- Consumes: `MeuPontoCard` from Task 1 (same component, extended in place — no new exports).

- [ ] **Step 1: Write the failing test**

Append to `apps/web/e2e/meu-ponto.spec.ts`:

```typescript
test("shows a fallback when location isn't available", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");
  // The default Playwright browser context has no geolocation permission
  // granted, so the browser's geolocation API errors out immediately.
  await expect(page.getByText("Localização não disponível")).toBeVisible();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && npx playwright test meu-ponto.spec.ts`
Expected: FAIL — no location text is rendered yet.

- [ ] **Step 3: Add the geolocation effect to `MeuPontoCard`**

In `apps/web/src/app/(app)/meu-ponto-card.tsx`, add the `useEffect` import and a `locationText` state, and render it:

```typescript
import { useEffect, useState } from "react";
```

Add inside the component body, after the existing `useState` declarations:

```typescript
  const [locationText, setLocationText] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationText("Localização não disponível");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationText(`Localização: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
      },
      () => setLocationText("Localização não disponível"),
    );
  }, []);
```

Add this line in the JSX, right after the "Horas trabalhadas hoje" paragraph:

```typescript
        <p className={styles.itemDetail}>{locationText ?? "Obtendo localização..."}</p>
```

- [ ] **Step 4: Run the e2e test to confirm it passes**

Run: `cd apps/web && npx playwright test meu-ponto.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full web e2e suite and typecheck**

Run: `cd apps/web && npx playwright test && npx tsc --noEmit`
Expected: PASS, no type errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/meu-ponto-card.tsx apps/web/e2e/meu-ponto.spec.ts
git commit -m "feat(web): show device coordinates on the punch card, non-blocking"
```

---

### Task 3: Make "Ponto" findable via search for a colaborador

**Files:**
- Modify: `apps/web/src/lib/nav-sections.ts`
- Modify: `apps/web/e2e/search.spec.ts`

**Interfaces:**
- Consumes: `NAV_SECTIONS` array shape from `apps/web/src/lib/nav-sections.ts` (unchanged shape, only the `"/"` entry's `roles` value changes).

- [ ] **Step 1: Write the failing test**

Append to `apps/web/e2e/search.spec.ts`:

```typescript
test("colaborador can find Ponto via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("ponto");

  await expect(page.getByRole("button", { name: "Ponto" })).toBeVisible();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/web && npx playwright test search.spec.ts`
Expected: FAIL — `NAV_SECTIONS`'s `"/"` entry doesn't include `"colaborador"` in `roles` yet, so the search result is filtered out.

- [ ] **Step 3: Update `nav-sections.ts`**

In `apps/web/src/lib/nav-sections.ts`, change the first entry:

```typescript
  { href: "/", label: "Ponto", roles: ["gestor", "rh", "colaborador"] },
```

- [ ] **Step 4: Run the e2e tests to confirm they pass**

Run: `cd apps/web && npx playwright test search.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full web e2e suite**

Run: `cd apps/web && npx playwright test`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/nav-sections.ts apps/web/e2e/search.spec.ts
git commit -m "feat(web): let a colaborador find Ponto through search"
```
