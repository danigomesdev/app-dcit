# Mural Colaborador Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the colaborador a working `/mural` page — see comunicados and aniversariantes, and react to posts — reusing the route gestor/RH already have.

**Architecture:** `apps/web/src/app/(app)/mural/page.tsx` branches by role, same pattern as `documentos/page.tsx`/`banco-de-horas/page.tsx`: the existing gestor/RH body becomes `TeamView` (extracted, zero behavior change beyond a timezone fix), and a new `ColaboradorView` renders an aniversariantes section (today/this-month split) and a comunicados feed where each post has a reaction toggle button backed by a native `<form action={...}>` Server Action — no new Client Component anywhere in this feature.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions only), CSS Modules, Playwright e2e (the only test layer `apps/web` has).

**Spec:** `docs/superpowers/specs/2026-09-01-mural-colaborador-web-design.md`

## Global Constraints

- No backend changes. `GET /mural/posts`, `POST /mural/posts/:id/react`, and `GET /mural/birthdays` already exist and already accept the colaborador role with no restriction.
- `formatDate` gets `timeZone: "UTC"` when extracted — a real bug (not cosmetic), the same class of issue already found and fixed in Férias/Documentos/Banco de Horas: formatting a UTC-midnight instant without pinning the timezone shifts the displayed day.
- "Hoje" for the aniversariantes split is computed with an explicit `America/Sao_Paulo` `Intl.DateTimeFormat` call (`todaySaoPauloMonthDay`), never the server's ambient timezone or a naive `new Date()` — same reasoning already established in `banco-de-horas/page.tsx`/`ferias/page.tsx`.
- No "unread" indicator — the mobile app's unread dot is a purely client-side, non-persisted concept with no backend field; it is not replicated here.
- The reaction button is a native `<form action={...}>` per post item, same pattern already used in `aprovacoes/approval-section.tsx` for one action per list row — no Client Component, no client-side state, anywhere in this feature.
- `COLABORADOR_SIDEBAR`: the new "Mural" entry is a sibling of "Ponto", "Banco de Horas", "Férias", and "Documentos" — top-level, not nested. This closes the sidebar structure anticipated since the Banco de Horas sub-project.

---

## Task 1: Wire `/mural` into colaborador navigation

**Files:**
- Modify: `apps/web/src/lib/nav-sections.ts`
- Modify: `apps/web/e2e/app-shell.spec.ts`
- Modify: `apps/web/e2e/search.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `/mural` in `NAV_SECTIONS` with `"colaborador"` added to its `roles`, and a `{ href: "/mural", label: "Mural" }` entry in `COLABORADOR_SIDEBAR` that later tasks' page will resolve to.

The colaborador-facing content this points to doesn't exist until Task 3 — that's fine here because neither test clicks through to `/mural`, they only assert the link/search-result is visible. Today `/mural` shows an `EmptyState` ("Sem permissão") for colaborador (see `apps/web/src/app/(app)/mural/page.tsx:42-50`) — that's fine too, it disappears once Task 3 lands.

- [ ] **Step 1: Write the failing tests**

In `apps/web/e2e/app-shell.spec.ts`, inside the existing test `"colaborador sees a curated, grouped sidebar instead of the gestor/rh menu"`, add this assertion right after the existing `Documentos` check:

```typescript
  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mural" })).toBeVisible();
```

In `apps/web/e2e/search.spec.ts`, add a new test at the end of the file:

```typescript
test("colaborador can find Mural via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("mural");

  await expect(page.getByRole("button", { name: "Mural" })).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test app-shell.spec.ts search.spec.ts`
Expected: FAIL — `page.getByRole('link', { name: 'Mural' })` and the search test's `getByRole('button', { name: 'Mural' })` are not found.

- [ ] **Step 3: Add the nav entries**

In `apps/web/src/lib/nav-sections.ts`, change the `/mural` line in `NAV_SECTIONS` (currently `{ href: "/mural", label: "Mural", roles: ["gestor", "rh"] }`):

```typescript
  { href: "/mural", label: "Mural", roles: ["gestor", "rh", "colaborador"] },
```

And append to `COLABORADOR_SIDEBAR` (after the `/documentos` entry):

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
  { href: "/documentos", label: "Documentos" },
  { href: "/mural", label: "Mural" },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test app-shell.spec.ts search.spec.ts`
Expected: PASS — every pre-existing test in both files still passes unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/nav-sections.ts apps/web/e2e/app-shell.spec.ts apps/web/e2e/search.spec.ts
git commit -m "feat(web): add Mural to colaborador navigation and search"
```

---

## Task 2: Extract `TeamView`; fix `formatDate`'s UTC timezone

**Files:**
- Modify: `apps/web/src/app/(app)/mural/page.tsx`
- Modify: `apps/web/e2e/mural.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TeamView(): Promise<JSX.Element>` (extracted, unchanged behavior except the timezone fix below); `formatDate(value: string): string` (now UTC-pinned) — both module-scoped in `page.tsx`, reused unchanged by Task 3.

This task is a pure refactor plus one small, deliberate behavior fix. It does NOT change the colaborador branch at all — colaborador still sees the "Sem permissão" `EmptyState`, exactly as today (that only changes in Task 3, when `ColaboradorView` is introduced and the guard needs a third branch anyway).

- [ ] **Step 1: Write the failing test**

Append to `apps/web/e2e/mural.spec.ts` (after the last existing test):

```typescript
test("shows a mural post's UTC calendar day, not a day shifted by local timezone", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  // createdAt is a UTC-midnight instant (same reasoning as documentos.spec.ts's
  // certification UTC test) — without formatDate's explicit timeZone: "UTC",
  // this would render as September 30th instead of October 1st in the
  // server's ambient America/Sao_Paulo (UTC-3) timezone.
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-2",
        glyph: "📣",
        title: "Aviso importante",
        body: "Confira o novo procedimento.",
        reactionCount: 0,
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    birthdays: [],
  });

  await page.goto("/mural");

  await expect(page.getByText("Aviso importante")).toBeVisible();
  await expect(page.getByText("publicado em 01/10/2026")).toBeVisible();
  await expect(page.getByText("publicado em 30/09/2026")).toHaveCount(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx playwright test mural.spec.ts`
Expected: FAIL — `formatDate` today (`page.tsx:37-39`) has no `timeZone` option, so `2026-10-01T00:00:00.000Z` renders as `30/09/2026` in the server's ambient `America/Sao_Paulo` timezone. The 2 pre-existing tests in the file still pass.

- [ ] **Step 3: Extract `TeamView` and apply the fix**

Read the full current file first (`apps/web/src/app/(app)/mural/page.tsx`, 114 lines) so you can extract it exactly — every element in `TeamView` below is copied verbatim from the current file's body (the `MuralPage` function's `const [posts, birthdays] = ...` through its closing `}`), with only `formatDate`'s new `timeZone: "UTC"` option applied.

Replace the whole file with:

```tsx
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./mural.module.css";

type MuralPost = {
  id: string;
  glyph: string;
  title: string;
  body: string;
  reactionCount: number;
  createdAt: string;
};

type Birthday = {
  name: string;
  day: number;
  month: number;
};

const MONTH_LABEL = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// API DateTime fields arrive as full ISO instant strings (Prisma DateTime ->
// JSON) — timeZone: "UTC" here is not cosmetic: without it, a UTC-midnight
// value shifts to the previous local day (the exact bug the Férias/
// Documentos sub-projects' reviews caught and fixed in their own
// formatDate).
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function MuralPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  return <TeamView />;
}

async function TeamView() {
  const [posts, birthdays] = await Promise.all([
    apiFetchJson<MuralPost[]>("/mural/posts"),
    apiFetchJson<Birthday[]>("/mural/birthdays"),
  ]);

  if (posts.length === 0 && birthdays.length === 0) {
    return (
      <EmptyState
        title="Mural"
        description="Os comunicados publicados no mural vão aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Mural</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aniversariantes</h2>
        {birthdays.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum aniversariante cadastrado.</p>
        ) : (
          <ul className={styles.birthdayList}>
            {birthdays.map((birthday) => (
              <li key={birthday.name} className={styles.birthdayItem}>
                {birthday.name} · {birthday.day} de {MONTH_LABEL[birthday.month - 1]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Comunicados</h2>
        {posts.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum comunicado publicado ainda.</p>
        ) : (
          <ul className={styles.list}>
            {posts.map((post) => (
              <li key={post.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.glyph}>{post.glyph}</span>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{post.title}</span>
                    <span className={styles.itemDetail}>
                      publicado em {formatDate(post.createdAt)}
                    </span>
                  </div>
                  <span className={styles.reactionCount}>
                    {post.reactionCount} reação(ões)
                  </span>
                </div>
                <p className={styles.body}>{post.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx playwright test mural.spec.ts`
Expected: PASS for all 3 tests (2 pre-existing + the new one). The pre-existing tests confirm `TeamView` has zero behavior change beyond the timezone fix (neither one uses a UTC-midnight fixture, per the spec's note that noon-UTC fixtures never cross a day boundary in UTC-3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/mural/page.tsx apps/web/e2e/mural.spec.ts
git commit -m "refactor(web): extract TeamView from MuralPage, fix formatDate timezone"
```

---

## Task 3: `ColaboradorView` skeleton — aniversariantes split and a read-only comunicados list

**Files:**
- Modify: `apps/web/src/app/(app)/mural/page.tsx`
- Modify: `apps/web/src/app/(app)/mural/mural.module.css`
- Modify: `apps/web/e2e/mural.spec.ts`

**Interfaces:**
- Consumes: `formatDate`, `styles` from Task 2 (unchanged).
- Produces: `ColaboradorView(): Promise<JSX.Element>`; `MuralPostRecord` and `BirthdayRecord` types; `todaySaoPauloMonthDay()`, `birthdaysToday()`, `birthdaysThisMonthExcludingToday()` helpers — all reused unchanged by Task 4.

This task introduces the whole `ColaboradorView` vertical slice except the reaction control itself — posts render read-only (title, body, publish date, no reaction button/count). Task 4 adds only the reaction form on top of the list markup this task creates.

- [ ] **Step 1: Write the failing tests**

In `apps/web/e2e/mural.spec.ts`, delete the existing test `"colaborador sees a permission message instead of the mural"` (colaborador now sees a real page, not a permission message — same reasoning already documented in the Banco de Horas/Documentos plans for the equivalent test). Replace it with these five tests, and add `todaySaoPauloMonthDay`/`pad` helpers near the top of the file (after the imports, mirroring how `ferias.spec.ts` replicates the page's own São-Paulo "today" helper so the test's expectations don't depend on the test runner's local timezone):

```typescript
function todaySaoPauloMonthDay(): { day: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month") };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

test("colaborador sees today's and this month's birthdays, but not a birthday from another month", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const today = todaySaoPauloMonthDay();
  const monthDay = (today.day % 28) + 1; // always different from today.day, valid in every month
  const otherMonth = (today.month % 12) + 1; // always different from today.month
  await mockApi(request, {
    muralPosts: [],
    birthdays: [
      { name: "Diana Colaboradora", day: today.day, month: today.month },
      { name: "Marcos Colega", day: monthDay, month: today.month },
      { name: "Outro Mês", day: 10, month: otherMonth },
    ],
  });

  await page.goto("/mural");

  await expect(page.getByText("Aniversariante(s) de hoje: Diana Colaboradora")).toBeVisible();
  await expect(
    page.getByText(`Também fazem aniversário este mês: Marcos Colega (${pad(monthDay)}/${pad(today.month)})`),
  ).toBeVisible();
  await expect(page.getByText("Outro Mês")).toHaveCount(0);
});

test("shows a message when there are no birthdays this month", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const today = todaySaoPauloMonthDay();
  const otherMonth = (today.month % 12) + 1;
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Texto.",
        reactionCount: 0,
        reacted: false,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    birthdays: [{ name: "Outro Mês", day: 10, month: otherMonth }],
  });

  await page.goto("/mural");

  await expect(page.getByText("Nenhum aniversariante este mês.")).toBeVisible();
});

test("colaborador sees mural posts with title, body and publish date", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Damos as boas-vindas ao novo time de suporte.",
        reactionCount: 4,
        reacted: false,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    birthdays: [],
  });

  await page.goto("/mural");

  await expect(page.getByRole("heading", { name: "Mural" })).toBeVisible();
  await expect(page.getByText("Boas-vindas!")).toBeVisible();
  await expect(page.getByText("Damos as boas-vindas ao novo time de suporte.")).toBeVisible();
  await expect(page.getByText("publicado em 20/08/2026")).toBeVisible();
});

test("shows a message when there are no posts yet", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    muralPosts: [],
    birthdays: [{ name: "Diana Colaboradora", day: 1, month: 1 }],
  });

  await page.goto("/mural");

  await expect(page.getByText("Nenhum comunicado publicado ainda.")).toBeVisible();
});
```

(That's four new tests plus one deletion — the file goes from 3 tests to 6.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test mural.spec.ts`
Expected: FAIL — visiting `/mural` as colaborador still renders the "Sem permissão" `EmptyState` from Task 2, so none of the new assertions find their targets. The 2 tests carried over from Task 2 (the gestor `TeamView` test and the UTC-timezone fix test) still pass — the permission-message test they used to sit alongside no longer exists, since Step 1 deleted it.

- [ ] **Step 3: Implement `ColaboradorView`**

In `apps/web/src/app/(app)/mural/page.tsx`, change `MuralPage`'s guard from the single combined check to a three-way branch, and add `ColaboradorView` plus its helpers and types after `TeamView`'s closing brace.

Change `MuralPage` to:

```tsx
export default async function MuralPage() {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <ColaboradorView />;
  }
  return <TeamView />;
}
```

Add after `TeamView`'s closing brace:

```typescript
type MuralPostRecord = {
  id: string;
  glyph: string;
  title: string;
  body: string;
  createdAt: string;
  reactionCount: number;
  reacted: boolean;
};

type BirthdayRecord = {
  name: string;
  day: number;
  month: number;
};

// "Hoje" must follow the company's timezone, not the server's ambient one
// (often UTC in production) — same reasoning as banco-de-horas/page.tsx's
// and ferias/page.tsx's todaySaoPauloDateOnly.
function todaySaoPauloMonthDay(): { day: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month") };
}

function birthdaysToday(
  birthdays: BirthdayRecord[],
  today: { day: number; month: number },
): BirthdayRecord[] {
  return birthdays.filter((b) => b.day === today.day && b.month === today.month);
}

function birthdaysThisMonthExcludingToday(
  birthdays: BirthdayRecord[],
  today: { day: number; month: number },
): BirthdayRecord[] {
  return birthdays.filter((b) => b.month === today.month && b.day !== today.day);
}

async function ColaboradorView() {
  const [posts, birthdays] = await Promise.all([
    apiFetchJson<MuralPostRecord[]>("/mural/posts"),
    apiFetchJson<BirthdayRecord[]>("/mural/birthdays"),
  ]);

  if (posts.length === 0 && birthdays.length === 0) {
    return (
      <EmptyState
        title="Mural"
        description="Os comunicados publicados no mural vão aparecer aqui."
      />
    );
  }

  const today = todaySaoPauloMonthDay();
  const todayBirthdays = birthdaysToday(birthdays, today);
  const monthBirthdays = birthdaysThisMonthExcludingToday(birthdays, today);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Mural</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aniversariantes</h2>
        {todayBirthdays.length > 0 ? (
          <div className={styles.birthdayToday}>
            🎂 Aniversariante(s) de hoje: {todayBirthdays.map((b) => b.name).join(", ")}
          </div>
        ) : null}
        {monthBirthdays.length > 0 ? (
          <p className={styles.birthdayMonth}>
            Também fazem aniversário este mês:{" "}
            {monthBirthdays
              .map(
                (b) =>
                  `${b.name} (${String(b.day).padStart(2, "0")}/${String(b.month).padStart(2, "0")})`,
              )
              .join(", ")}
          </p>
        ) : null}
        {todayBirthdays.length === 0 && monthBirthdays.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum aniversariante este mês.</p>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Comunicados</h2>
        {posts.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum comunicado publicado ainda.</p>
        ) : (
          <ul className={styles.list}>
            {posts.map((post) => (
              <li key={post.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.glyph}>{post.glyph}</span>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{post.title}</span>
                    <span className={styles.itemDetail}>
                      publicado em {formatDate(post.createdAt)}
                    </span>
                  </div>
                </div>
                <p className={styles.body}>{post.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

In `apps/web/src/app/(app)/mural/mural.module.css`, append:

```css
.birthdayToday {
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--color-background-selected);
  font-weight: 600;
  color: var(--color-text);
}

.birthdayMonth {
  font-size: 14px;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test mural.spec.ts`
Expected: PASS for all 6 tests (2 from Task 2's TeamView/UTC coverage + the 4 new ones from this task).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/mural/page.tsx apps/web/src/app/\(app\)/mural/mural.module.css apps/web/e2e/mural.spec.ts
git commit -m "feat(web): colaborador sees mural posts and birthdays"
```

---

## Task 4: Reaction toggle

**Files:**
- Create: `apps/web/src/app/(app)/mural/actions.ts`
- Modify: `apps/web/src/app/(app)/mural/page.tsx`
- Modify: `apps/web/src/app/(app)/mural/mural.module.css`
- Modify: `apps/web/e2e/mural.spec.ts`

**Interfaces:**
- Consumes: `MuralPostRecord`, `styles` from Task 3 (unchanged).
- Produces: `toggleMuralReaction(formData: FormData): Promise<void>` Server Action.

This is the last task — after it, run the full `apps/web` e2e suite (not just `mural.spec.ts`) to confirm nothing else regressed.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/e2e/mural.spec.ts`, and update the top import to add `getRecordedRequests` and `seedResponse`:

```typescript
import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";
```

```typescript
test("shows the reaction button's count and reacted state", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Texto.",
        reactionCount: 4,
        reacted: false,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
      {
        id: "post-2",
        glyph: "📣",
        title: "Aviso",
        body: "Texto 2.",
        reactionCount: 1,
        reacted: true,
        createdAt: "2026-08-21T12:00:00.000Z",
      },
    ],
    birthdays: [],
  });

  await page.goto("/mural");

  const unreacted = page.getByRole("button", { name: "♡ 4" });
  const reacted = page.getByRole("button", { name: "♥ 1" });
  await expect(unreacted).toBeVisible();
  await expect(reacted).toBeVisible();
  await expect(reacted).toHaveClass(/reactionButtonActive/);
  await expect(unreacted).not.toHaveClass(/reactionButtonActive/);
});

test("clicking the reaction button toggles it via the API and reflects the new state", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    muralPosts: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Texto.",
        reactionCount: 4,
        reacted: false,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    birthdays: [],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/mural/posts/post-1/react",
    response: { reactionCount: 5, reacted: true },
  });

  await page.goto("/mural");

  await seedResponse(request, {
    method: "GET",
    path: "/mural/posts",
    response: [
      {
        id: "post-1",
        glyph: "🎉",
        title: "Boas-vindas!",
        body: "Texto.",
        reactionCount: 5,
        reacted: true,
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.getByRole("button", { name: "♡ 4" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/mural/posts/post-1/react");
    })
    .toBeTruthy();

  await expect(page.getByRole("button", { name: "♥ 5" })).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test mural.spec.ts`
Expected: FAIL — posts render with no reaction button at all (Task 3 only rendered title/body/date), so `getByRole('button', { name: '♡ 4' })` isn't found. The 6 prior tests still pass.

- [ ] **Step 3: Implement**

Create `apps/web/src/app/(app)/mural/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function toggleMuralReaction(formData: FormData) {
  const postId = formData.get("postId");
  if (typeof postId !== "string" || postId.length === 0) {
    throw new Error("postId é obrigatório.");
  }
  const res = await apiFetch(`/mural/posts/${postId}/react`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/mural/posts/${postId}/react responded with ${res.status}`);
  }
  revalidatePath("/mural");
}
```

In `apps/web/src/app/(app)/mural/page.tsx`, add the import (after the existing ones):

```typescript
import { toggleMuralReaction } from "./actions";
```

In `ColaboradorView`, change the post `<li>` body from:

```tsx
                <p className={styles.body}>{post.body}</p>
              </li>
```

to:

```tsx
                <p className={styles.body}>{post.body}</p>
                <form action={toggleMuralReaction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button
                    type="submit"
                    className={
                      post.reacted
                        ? `${styles.reactionButton} ${styles.reactionButtonActive}`
                        : styles.reactionButton
                    }
                  >
                    {post.reacted ? "♥" : "♡"} {post.reactionCount}
                  </button>
                </form>
              </li>
```

In `apps/web/src/app/(app)/mural/mural.module.css`, append:

```css
.reactionButton {
  appearance: none;
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--color-background-selected);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}

.reactionButton:hover {
  background: var(--color-background-selected);
}

.reactionButtonActive {
  color: var(--color-text);
  border-color: var(--color-text);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test mural.spec.ts`
Expected: PASS for all 8 tests.

- [ ] **Step 5: Run the full web e2e suite**

Run: `cd apps/web && npx playwright test`
Expected: PASS — every pre-existing spec file still passes unchanged, alongside `mural.spec.ts`. (As of the Documentos sub-project, `auth.spec.ts:19`, `esqueci-senha.spec.ts:38`/`:47`, `login.spec.ts:33`, and `search.spec.ts:17` have 5 known pre-existing failures unrelated to any colaborador-portal work — confirm the failure set is still exactly those 5 and nothing new, not that the suite is 100% green.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/mural/page.tsx apps/web/src/app/\(app\)/mural/actions.ts apps/web/src/app/\(app\)/mural/mural.module.css apps/web/e2e/mural.spec.ts
git commit -m "feat(web): colaborador can react to mural posts"
```
