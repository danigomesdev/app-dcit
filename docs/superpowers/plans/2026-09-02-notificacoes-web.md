# Sininho de Notificações — Colaborador Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a notification bell to the app topbar (all roles) with an unread badge and a dropdown of the last 10 notifications, plus a `/notificacoes` page with the full history — both consuming the already-built `GET /notifications/mine` and `POST /notifications/:id/read` endpoints with zero API changes.

**Architecture:** A shared `useNotificationInbox` hook + `NotificationList` presentational component (both in `apps/web/src/components/`) own the "click marks read, optimistic local state, navigate if `link` is set" behavior once; `NotificationBell` (topbar dropdown) and `NotificationHistoryList` (full-page list) are thin wrappers around them. `(app)/layout.tsx` fetches the notification list once per navigation and passes it down through `AppShell`.

**Tech Stack:** Next.js 16 App Router (Server Components + Client Components + a directly-invoked Server Action, no `<form action>`); Playwright e2e on `apps/web` (the only test layer this app has — no component/unit test layer exists for `apps/web`).

**Spec:** `docs/superpowers/specs/2026-09-02-notificacoes-web-design.md`

## Global Constraints

- Zero changes to `apps/api` or `packages/shared-types` — both consumed endpoints (`GET /notifications/mine`, `POST /notifications/:id/read`) already exist in the exact shape used here.
- `Notification.link` is `null` for every real notification today — clicking one still marks it read, it just never navigates. Don't invent a link target.
- The bell's dropdown is a `useState`-controlled `<button>`, never native `<details>` — the unread badge must update the instant a notification is clicked, which already forces JS-controlled state; `<details>` would be a second, redundant open/closed source of truth.
- `markNotificationRead` (the Server Action) does **not** call `revalidatePath` — read state is local/optimistic on the client; revalidating would force an unnecessary round-trip.
- No permission gate on the bell or `/notificacoes` — every authenticated role sees their own notifications.
- `createdAt` is formatted with `timeZone: "America/Sao_Paulo"` **and shows the time**, not the `formatDateOnly` convention used elsewhere for date-only fields — it's a real instant, not a date-only value.
- `(app)/layout.tsx` fetches `/notifications/mine` on every navigation under `(app)`, with no caching (`apiFetch` always uses `cache: "no-store"`) — an accepted, deliberate simplicity tradeoff, not a bug to fix.
- The layout-level fetch means `/notifications/mine` is now called by **every page in every existing e2e spec**, not just the new ones in this plan — `fake-api-server.mjs` needs an unconditional 200-`[]` fallback for it (Task 1), and Task 1 must run the full existing suite to confirm nothing broke.

---

## Task 1: Notification bell in the topbar

**Files:**
- Create: `apps/web/src/components/notification-list.tsx`
- Create: `apps/web/src/components/notification-list.module.css`
- Create: `apps/web/src/components/notification-actions.ts`
- Create: `apps/web/src/components/notification-bell.tsx`
- Create: `apps/web/src/components/notification-bell.module.css`
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/components/app-shell.tsx`
- Modify: `apps/web/src/components/app-shell.module.css`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Modify: `apps/web/e2e/test-session.ts`
- Create: `apps/web/e2e/notificacoes.spec.ts`

**Interfaces:**
- Consumes: `GET /notifications/mine` (returns `Notification[]`, already live), `POST /notifications/:id/read` (already live).
- Produces: `NotificationRecord` type, `useNotificationInbox(initial: NotificationRecord[]): { items, unreadCount, handleClick }`, `NotificationList({ notifications, onItemClick }): JSX.Element` — all three reused unchanged by Task 2's history page. `AppShell` gains a required `notifications: NotificationRecord[]` prop.

This task delivers the whole bell end-to-end: badge, dropdown, click-to-read, click-to-navigate. Task 2 builds the `/notificacoes` page on top of the same `useNotificationInbox`/`NotificationList` without changing either.

- [ ] **Step 1: Add the `fake-api-server.mjs` fallback and the `mockApi` seeding key first**

This must land before the rest of the task's own tests can run cleanly, and — per the Global Constraints — before any other spec in the suite is affected by the new layout-level fetch.

In `apps/web/e2e/fake-api-server.mjs`, add this immediately after the existing `/notifications/pagamentos/status/:category` fallback (around line 210), before the final 404 fallback:

```javascript
  if (req.method === "GET" && url.pathname === "/notifications/mine") {
    return sendJson(res, 200, []);
  }
```

In `apps/web/e2e/test-session.ts`, add `notifications?: unknown[];` to the `mockApi` function's `data` parameter type (in the big inline object type, alphabetically near the other keys is fine — e.g. right after `myCompensations?: unknown[];`), and add the seeding block at the end of the function body, right before the closing `}` (after the `feriasData` block):

```typescript
  if (data.notifications) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/notifications/mine", response: data.notifications },
    });
  }
```

- [ ] **Step 2: Run the full existing e2e suite to confirm the fallback alone breaks nothing**

Run from `apps/web`:

```bash
npx playwright test
```

Expected: same result as the pre-existing baseline — 153 passed, and only the 5 known pre-existing flaky failures (`auth.spec.ts:19`, `esqueci-senha.spec.ts:38`/`:47`, `login.spec.ts:33`, `search.spec.ts:17`). This step only adds an unused fallback route and an unused seeding key — nothing calls either yet, so this run is really confirming the file edits themselves introduced no syntax/behavior error. The real regression risk (every page now fetching `/notifications/mine`) is checked again at the end of this task, after the layout is wired.

- [ ] **Step 3: Write the failing tests**

Create `apps/web/e2e/notificacoes.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi } from "./test-session";

test("shows no badge when there are no unread notifications", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    notifications: [
      {
        id: "n1",
        type: "pagamento",
        category: "salario",
        message: "Seu salário foi depositado.",
        link: null,
        createdAt: "2026-09-01T12:00:00.000Z",
        readAt: "2026-09-01T13:00:00.000Z",
      },
    ],
  });

  await page.goto("/");

  const bellButton = page.getByLabel("Notificações");
  await expect(bellButton).toBeVisible();
  await expect(bellButton).not.toContainText(/\d/);
});

test("shows the exact unread count on the badge", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    notifications: [
      {
        id: "n1",
        type: "pagamento",
        category: "salario",
        message: "Notificação 1",
        link: null,
        createdAt: "2026-09-03T12:00:00.000Z",
        readAt: null,
      },
      {
        id: "n2",
        type: "pagamento",
        category: "salario",
        message: "Notificação 2",
        link: null,
        createdAt: "2026-09-02T12:00:00.000Z",
        readAt: null,
      },
      {
        id: "n3",
        type: "pagamento",
        category: "salario",
        message: "Notificação 3",
        link: null,
        createdAt: "2026-09-01T12:00:00.000Z",
        readAt: "2026-09-01T13:00:00.000Z",
      },
    ],
  });

  await page.goto("/");

  await expect(page.getByLabel("Notificações")).toContainText("2");
});

test("caps the badge at 9+ when there are more than 9 unread", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const unread = Array.from({ length: 11 }, (_, i) => ({
    id: `n${i + 1}`,
    type: "pagamento",
    category: "salario",
    message: `Notificação ${i + 1}`,
    link: null,
    createdAt: `2026-09-${String(11 - i).padStart(2, "0")}T12:00:00.000Z`,
    readAt: null,
  }));
  await mockApi(request, { notifications: unread });

  await page.goto("/");

  await expect(page.getByLabel("Notificações")).toContainText("9+");
});

test("opening the bell shows only the 10 most recent notifications", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  // Pre-sorted newest first, same as the real listMine (orderBy createdAt desc)
  // — the fake server returns whatever is seeded verbatim, it does not sort.
  const notifications = Array.from({ length: 11 }, (_, i) => ({
    id: `n${i + 1}`,
    type: "pagamento",
    category: "salario",
    message: `Notificação ${i + 1}`,
    link: null,
    createdAt: `2026-09-${String(11 - i).padStart(2, "0")}T12:00:00.000Z`,
    readAt: "2026-09-01T00:00:00.000Z",
  }));
  await mockApi(request, { notifications });

  await page.goto("/");
  await page.getByLabel("Notificações").click();

  await expect(page.getByText("Notificação 1")).toBeVisible();
  await expect(page.getByText("Notificação 10")).toBeVisible();
  await expect(page.getByText("Notificação 11")).toHaveCount(0);
});

test("shows an empty message when there are no notifications", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { notifications: [] });

  await page.goto("/");
  await page.getByLabel("Notificações").click();

  await expect(page.getByText("Nenhuma notificação.")).toBeVisible();
});

test("clicking an unread notification marks it read and updates the badge, without navigating when link is null", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    notifications: [
      {
        id: "n1",
        type: "pagamento",
        category: "salario",
        message: "Seu salário foi depositado.",
        link: null,
        createdAt: "2026-09-01T12:00:00.000Z",
        readAt: null,
      },
    ],
  });

  await page.goto("/");
  await page.getByLabel("Notificações").click();
  await expect(page.getByLabel("Notificações")).toContainText("1");

  await page.getByText("Seu salário foi depositado.").click();

  await expect(page.getByLabel("Notificações")).not.toContainText(/\d/);
  expect(page.url()).toMatch(/\/$/);

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/notifications/n1/read");
    })
    .toBeTruthy();
});

test("clicking a notification with a link navigates there", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    notifications: [
      {
        id: "n1",
        type: "ponto_perdido",
        category: null,
        message: "Você esqueceu de bater o ponto ontem.",
        link: "/historico",
        createdAt: "2026-09-01T12:00:00.000Z",
        readAt: null,
      },
    ],
  });

  await page.goto("/");
  await page.getByLabel("Notificações").click();
  await page.getByText("Você esqueceu de bater o ponto ontem.").click();

  await page.waitForURL("**/historico");
});

test("the bell is visible to colaborador, gestor, and rh", async ({ page, context, request }) => {
  await mockApi(request, { notifications: [] });

  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");
  await expect(page.getByLabel("Notificações")).toBeVisible();

  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/");
  await expect(page.getByLabel("Notificações")).toBeVisible();

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await page.goto("/");
  await expect(page.getByLabel("Notificações")).toBeVisible();
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run from `apps/web`:

```bash
npx playwright test notificacoes.spec.ts
```

Expected: FAIL — `getByLabel("Notificações")` finds nothing, since no bell exists yet.

- [ ] **Step 5: Implement `notification-actions.ts`**

Create `apps/web/src/components/notification-actions.ts` first — `notification-list.tsx` (next step) imports from it, so it must exist first for the import to resolve:

```typescript
"use server";

import { apiFetch } from "@/lib/api";

export async function markNotificationRead(id: string): Promise<void> {
  const res = await apiFetch(`/notifications/${id}/read`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/notifications/${id}/read responded with ${res.status}`);
  }
}
```

- [ ] **Step 6: Implement `notification-list.tsx`**

Create `apps/web/src/components/notification-list.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markNotificationRead } from "./notification-actions";
import styles from "./notification-list.module.css";

export type NotificationRecord = {
  id: string;
  type: string;
  category: string | null;
  message: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
};

function formatNotificationDate(iso: string): string {
  // createdAt is a full ISO instant (Prisma DateTime -> JSON), not a
  // date-only value — unlike the formatDateOnly convention used elsewhere
  // (which pins UTC to avoid shifting a date-only field by a day), a
  // notification's real wall-clock time in São Paulo is what matters here.
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Shared state + click behavior between the bell's dropdown (truncated
// list) and /notificacoes (full list) — each call site owns its own copy
// of local state, updated optimistically.
export function useNotificationInbox(initial: NotificationRecord[]) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const unreadCount = items.filter((n) => n.readAt === null).length;

  function handleClick(notification: NotificationRecord) {
    if (notification.readAt === null) {
      const readAt = new Date().toISOString();
      setItems((current) => current.map((n) => (n.id === notification.id ? { ...n, readAt } : n)));
      startTransition(() => {
        // Best-effort: marking read is a side effect of the click, not the
        // user's primary intent — a failure here never blocks navigation
        // or shows an error. Worst case the notification reads unread
        // again next time /notifications/mine is refetched.
        markNotificationRead(notification.id).catch(() => {});
      });
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }

  return { items, unreadCount, handleClick };
}

export function NotificationList({
  notifications,
  onItemClick,
}: {
  notifications: NotificationRecord[];
  onItemClick: (notification: NotificationRecord) => void;
}) {
  if (notifications.length === 0) {
    return <p className={styles.empty}>Nenhuma notificação.</p>;
  }
  return (
    <ul className={styles.list}>
      {notifications.map((notification) => (
        <li key={notification.id}>
          <button
            type="button"
            className={
              notification.readAt === null ? `${styles.item} ${styles.itemUnread}` : styles.item
            }
            onClick={() => onItemClick(notification)}
          >
            <span className={styles.message}>{notification.message}</span>
            <span className={styles.date}>{formatNotificationDate(notification.createdAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 7: Implement `notification-list.module.css`**

Create `apps/web/src/components/notification-list.module.css`:

```css
.empty {
  padding: 12px 8px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 360px;
  overflow-y: auto;
}

.item {
  appearance: none;
  width: 100%;
  text-align: left;
  border: none;
  border-radius: 8px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: none;
  cursor: pointer;
}

.item:hover {
  background: var(--color-background-selected);
}

.itemUnread {
  background: rgba(255, 255, 255, 0.06);
}

.itemUnread .message {
  font-weight: 600;
}

.message {
  font-size: 14px;
  color: var(--color-text);
}

.date {
  font-size: 12px;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 8: Implement `notification-bell.tsx`**

Create `apps/web/src/components/notification-bell.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { NotificationList, useNotificationInbox, type NotificationRecord } from "./notification-list";
import styles from "./notification-bell.module.css";

export function NotificationBell({ notifications }: { notifications: NotificationRecord[] }) {
  const [open, setOpen] = useState(false);
  const { items, unreadCount, handleClick } = useNotificationInbox(notifications);

  return (
    <div className={styles.bell}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => setOpen((current) => !current)}
        aria-label="Notificações"
        aria-expanded={open}
      >
        <svg className={styles.bellIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.73 21a2 2 0 01-3.46 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>Notificações</div>
          <NotificationList
            notifications={items.slice(0, 10)}
            onItemClick={(notification) => {
              handleClick(notification);
              setOpen(false);
            }}
          />
          <Link href="/notificacoes" className={styles.viewAll} onClick={() => setOpen(false)}>
            Ver todas
          </Link>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 9: Implement `notification-bell.module.css`**

Create `apps/web/src/components/notification-bell.module.css`:

```css
.bell {
  position: relative;
}

.bellButton {
  position: relative;
  appearance: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--color-background-element);
  color: var(--color-text);
  cursor: pointer;
}

.bellButton:hover {
  background: var(--color-background-selected);
}

.bellIcon {
  width: 20px;
  height: 20px;
}

.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 999px;
  background: #e5484d;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 12px;
  background: #1c2230;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  z-index: 10;
}

.panelHeader {
  padding: 4px 8px 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--color-background-selected);
  font-weight: 600;
  color: var(--color-text);
}

.viewAll {
  display: block;
  text-align: center;
  padding: 10px 8px 4px;
  margin-top: 4px;
  border-top: 1px solid var(--color-background-selected);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.viewAll:hover {
  color: var(--color-text);
}
```

- [ ] **Step 10: Wire the layout to fetch notifications**

Modify `apps/web/src/app/(app)/layout.tsx` to:

```tsx
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { apiFetchJson } from "@/lib/api";
import { requireSession } from "@/lib/session";
import type { NotificationRecord } from "@/components/notification-list";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  // Best-effort: a failure here can't take down the layout every page in
  // the portal renders through — worst case the bell opens empty until
  // the next successful navigation refetches it.
  const notifications = await apiFetchJson<NotificationRecord[]>("/notifications/mine").catch(
    () => [] as NotificationRecord[],
  );
  return (
    <AppShell user={user} notifications={notifications}>
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 11: Wire `AppShell` to render the bell**

In `apps/web/src/components/app-shell.tsx`:

1. Add imports:

```typescript
import { NotificationBell } from "./notification-bell";
import type { NotificationRecord } from "./notification-list";
```

2. Add `notifications: NotificationRecord[];` to the props type, right after `user: Session;`.

3. Add `notifications` to the destructured props: `export function AppShell({ children, user, notifications }: { ... })`.

4. Wrap the topbar's right-hand side (currently just the `<details className={styles.userMenu}>` block) in a new `<div className={styles.topbarActions}>` containing the bell followed by the existing user menu, unchanged:

```tsx
        <header className={styles.topbar}>
          <SearchOverlay role={user.role} />
          <div className={styles.topbarActions}>
            <NotificationBell notifications={notifications} />
            <details className={styles.userMenu}>
              {/* ...existing summary/panel content, unchanged... */}
            </details>
          </div>
        </header>
```

(Only the `<details>` block's *wrapper* changes — nothing inside it.)

In `apps/web/src/components/app-shell.module.css`, add right after the `.topbar` rule:

```css
.topbarActions {
  display: flex;
  align-items: center;
  gap: 8px;
}
```

- [ ] **Step 12: Run tests to verify they pass**

Run from `apps/web`:

```bash
npx playwright test notificacoes.spec.ts
```

Expected: PASS for all 8 tests.

- [ ] **Step 13: Run the full e2e suite — this is the real regression check**

Run from `apps/web`:

```bash
npx playwright test
```

Expected: PASS, with the failure set being exactly the same 5 known pre-existing flaky tests as before this task (`auth.spec.ts:19`, `esqueci-senha.spec.ts:38`/`:47`, `login.spec.ts:33`, `search.spec.ts:17`) plus the new `notificacoes.spec.ts` tests passing — not zero failures, but *no new* failures beyond that fixed set. This is the step that actually proves the layout-wide `/notifications/mine` fetch didn't silently break any of the ~150 pre-existing tests now running through the same layout. If a leftover Chrome/Node process from a prior run causes unrelated timeouts, close them first before concluding anything is a real regression.

Also run `npx tsc --noEmit` from `apps/web` to confirm the new `AppShell` prop and all the new files compile cleanly.

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/components/notification-list.tsx apps/web/src/components/notification-list.module.css apps/web/src/components/notification-actions.ts apps/web/src/components/notification-bell.tsx apps/web/src/components/notification-bell.module.css apps/web/src/app/\(app\)/layout.tsx apps/web/src/components/app-shell.tsx apps/web/src/components/app-shell.module.css apps/web/e2e/fake-api-server.mjs apps/web/e2e/test-session.ts apps/web/e2e/notificacoes.spec.ts
git commit -m "feat(web): add notification bell to the app topbar"
```

---

## Task 2: `/notificacoes` full history page

**Files:**
- Create: `apps/web/src/app/(app)/notificacoes/page.tsx`
- Create: `apps/web/src/app/(app)/notificacoes/notification-history-list.tsx`
- Create: `apps/web/src/app/(app)/notificacoes/notificacoes.module.css`
- Modify: `apps/web/src/lib/nav-sections.ts`
- Modify: `apps/web/e2e/notificacoes.spec.ts`

**Interfaces:**
- Consumes: `NotificationRecord`, `useNotificationInbox`, `NotificationList` (Task 1, unchanged).
- Produces: nothing consumed by any later task — this is the last task in the plan.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/e2e/notificacoes.spec.ts` (add `Link` behavior isn't needed here; reuse the existing imports already in the file):

```typescript
test("/notificacoes shows the full history, not just the last 10", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  const notifications = Array.from({ length: 11 }, (_, i) => ({
    id: `n${i + 1}`,
    type: "pagamento",
    category: "salario",
    message: `Notificação ${i + 1}`,
    link: null,
    createdAt: `2026-09-${String(11 - i).padStart(2, "0")}T12:00:00.000Z`,
    readAt: "2026-09-01T00:00:00.000Z",
  }));
  await mockApi(request, { notifications });

  await page.goto("/notificacoes");

  await expect(page.getByText("Notificação 1")).toBeVisible();
  await expect(page.getByText("Notificação 11")).toBeVisible();
});

test("/notificacoes shows an empty message with no notifications", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { notifications: [] });

  await page.goto("/notificacoes");

  await expect(page.getByText("Nenhuma notificação.")).toBeVisible();
});

test("clicking a notification on /notificacoes marks it read in place", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    notifications: [
      {
        id: "n1",
        type: "pagamento",
        category: "salario",
        message: "Seu salário foi depositado.",
        link: null,
        createdAt: "2026-09-01T12:00:00.000Z",
        readAt: null,
      },
    ],
  });

  await page.goto("/notificacoes");
  await page.getByText("Seu salário foi depositado.").click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/notifications/n1/read");
    })
    .toBeTruthy();
});

test("/notificacoes is reachable for colaborador, gestor, and rh with no permission gate", async ({
  page,
  context,
  request,
}) => {
  await mockApi(request, { notifications: [] });

  for (const claims of [
    { sub: "colaborador-1", role: "colaborador", name: "Ana" },
    { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" },
    { sub: "rh-1", role: "rh", name: "Carla RH" },
  ]) {
    await addSessionCookie(context, claims);
    await page.goto("/notificacoes");
    await expect(page.getByRole("heading", { name: "Notificações" })).toBeVisible();
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/web`:

```bash
npx playwright test notificacoes.spec.ts
```

Expected: FAIL — the 4 new tests fail (404/no route for `/notificacoes`), the 8 tests from Task 1 still pass.

- [ ] **Step 3: Implement `notification-history-list.tsx`**

Create `apps/web/src/app/(app)/notificacoes/notification-history-list.tsx`:

```tsx
"use client";

import {
  NotificationList,
  useNotificationInbox,
  type NotificationRecord,
} from "@/components/notification-list";

export function NotificationHistoryList({ notifications }: { notifications: NotificationRecord[] }) {
  const { items, handleClick } = useNotificationInbox(notifications);
  return <NotificationList notifications={items} onItemClick={handleClick} />;
}
```

- [ ] **Step 4: Implement `notificacoes.module.css`**

Create `apps/web/src/app/(app)/notificacoes/notificacoes.module.css`:

```css
.page {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 640px;
}

.heading {
  font-size: 24px;
  font-weight: 600;
}
```

- [ ] **Step 5: Implement `page.tsx`**

Create `apps/web/src/app/(app)/notificacoes/page.tsx`:

```tsx
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { NotificationRecord } from "@/components/notification-list";

import { NotificationHistoryList } from "./notification-history-list";
import styles from "./notificacoes.module.css";

export default async function NotificacoesPage() {
  const session = await getSession();
  const notifications = session
    ? await apiFetchJson<NotificationRecord[]>("/notifications/mine").catch(() => [] as NotificationRecord[])
    : [];

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Notificações</h1>
      <NotificationHistoryList notifications={notifications} />
    </div>
  );
}
```

- [ ] **Step 6: Add the nav-sections entry**

In `apps/web/src/lib/nav-sections.ts`, add to `NAV_SECTIONS`, at the end of the array:

```typescript
  { href: "/notificacoes", label: "Notificações", roles: ["colaborador", "gestor", "rh"] },
```

- [ ] **Step 7: Run tests to verify they pass**

Run from `apps/web`:

```bash
npx playwright test notificacoes.spec.ts
```

Expected: PASS for all 12 tests (8 from Task 1 + 4 new).

- [ ] **Step 8: Run the full e2e suite one more time**

Run from `apps/web`:

```bash
npx playwright test
```

Expected: PASS — same failure set as Task 1's Step 13 (the 5 known pre-existing flaky tests, nothing new).

Also run `npx tsc --noEmit` from `apps/web` to confirm everything compiles.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/\(app\)/notificacoes apps/web/src/lib/nav-sections.ts apps/web/e2e/notificacoes.spec.ts
git commit -m "feat(web): add /notificacoes full history page"
```
