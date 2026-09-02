# Sininho de Notificações + Push Real (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-built `ExpoPushService` into `NotificationsService` so creating a `Notification` actually sends a real push, and add the equivalent inbox UI (badge + history section + tap-to-navigate) to the mobile app.

**Architecture:** Backend: `NotificationsService.sendPagamento` switches `createMany` → `createManyAndReturn` (needs each row's `id` for the push payload) and calls `ExpoPushService.sendToUser` per created row with a `data: { notificationId, link }` payload. Mobile: a single `NotificationProvider` (mounted at the root layout, same fix already validated on the web bell for avoiding divergent badge/list state) owns the inbox — fetched from `GET /notifications/mine`, exposed to the home-screen badge and the `/notificacoes` screen alike. A root-layout tap handler (`expo-notifications` response listener + cold-start check) resolves a tapped push back to its `NotificationRecord` and reuses the same mark-read/navigate logic as an in-app tap.

**Tech Stack:** NestJS + Prisma (SQLite) on `apps/api`; Expo Router + React Native + `expo-notifications` on `apps/mobile`; Jest on both.

**Spec:** [`docs/superpowers/specs/2026-09-02-notificacoes-mobile-design.md`](../specs/2026-09-02-notificacoes-mobile-design.md)

## Global Constraints

- Zero Prisma schema changes — `Notification`/`PushToken` already have every field needed.
- `ExpoPushService.sendToUser` stays best-effort — no push failure (bad token, Expo API down, network error) may ever throw out of `sendPagamento`, fail the notification creation, or become visible to the RH sender.
- `Notification.link` stays `null` from the only real producer today (`sendPagamento`) — same decision already made for the web bell. The tap-to-navigate path is built and works, it just has no real destination yet.
- One `NotificationProvider`, mounted once at `apps/mobile/src/app/_layout.tsx`, is the only fetcher of `/notifications/mine` in the mobile app — no screen fetches it independently.
- Every touch point with `expo-notifications` (new or existing) uses lazy `require`/`import` inside a function, never a static top-level import — a static import throws in Expo Go on Android (SDK 53+ dropped remote-notification support there).
- Real push delivery is verified end-to-end only on a physical iPhone via Expo Go. Android runs the identical code path with no real-device verification this round (Expo Go there can't receive remote push at all) — this is accepted scope, not a gap to fix in this plan.

---

### Task 1: `ExpoPushService` — carry an optional `data` payload

**Files:**
- Modify: `apps/api/src/push/expo-push.service.ts`
- Test: `apps/api/src/push/expo-push.service.spec.ts`

**Interfaces:**
- Produces: `PushMessage = { title: string; body: string; data?: Record<string, unknown> }`; `ExpoPushService.sendToUser(userId: string, message: PushMessage): Promise<void>` (signature unchanged, `data` is a new optional field on the existing `message` param).

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/push/expo-push.service.spec.ts`, inside the existing `describe('ExpoPushService', ...)` block, after the `'sends a push request for each registered token'` test:

```typescript
  it('includes data in the payload when provided', async () => {
    await prisma.pushToken.create({
      data: { userId: 'expo-user-a', token: 'ExponentPushToken[data]' },
    });

    await service.sendToUser('expo-user-a', {
      title: 'Pagamento',
      body: 'Depositado',
      data: { notificationId: 'notif-1', link: null },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string) as unknown[];
    expect(payload).toEqual([
      {
        to: 'ExponentPushToken[data]',
        title: 'Pagamento',
        body: 'Depositado',
        data: { notificationId: 'notif-1', link: null },
      },
    ]);
  });

  it('omits data from the payload when not provided', async () => {
    await prisma.pushToken.create({
      data: { userId: 'expo-user-a', token: 'ExponentPushToken[nodata]' },
    });

    await service.sendToUser('expo-user-a', { title: 'Oi', body: 'Teste' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string) as unknown[];
    expect(payload[0]).not.toHaveProperty('data');
  });
```

This file's `beforeEach` already resets `fetchMock` and its `afterAll` already scopes cleanup to `userId: { in: ['expo-user-a', 'expo-user-b'] }` — `expo-user-a` is reused here (already covered), no fixture changes needed elsewhere in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest push/expo-push.service.spec.ts -t "data" --silent=false`
Expected: FAIL — both new tests fail because `data` is never included in the payload today (the `payload[0]` in the first test won't have a `data` key at all, so `toEqual` fails; the second test currently passes trivially, but confirm the first genuinely fails before moving on).

- [ ] **Step 3: Implement**

In `apps/api/src/push/expo-push.service.ts`, replace the `PushMessage` type and the `body: JSON.stringify(...)` block:

```typescript
export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};
```

```typescript
        body: JSON.stringify(
          tokens.map((t) => ({
            to: t.token,
            title: message.title,
            body: message.body,
            ...(message.data ? { data: message.data } : {}),
          })),
        ),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest push/expo-push.service.spec.ts --silent=false`
Expected: PASS, all tests in the file (old and new).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/push/expo-push.service.ts apps/api/src/push/expo-push.service.spec.ts
git commit -m "feat(api): let ExpoPushService carry an optional data payload"
```

---

### Task 2: Wire `ExpoPushService` into `NotificationsService.sendPagamento`

**Files:**
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Modify: `apps/api/src/notifications/notifications.module.ts`
- Test: `apps/api/src/notifications/notifications.service.spec.ts`

**Interfaces:**
- Consumes: `ExpoPushService.sendToUser(userId, { title, body, data? })` from Task 1; `PushModule` (`apps/api/src/push/push.module.ts`, already exports `ExpoPushService`).
- Produces: `NotificationsService.sendPagamento` behavior unchanged in signature, now also sends a push per created notification.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/notifications/notifications.service.spec.ts`, change the test module setup to inject a mock `ExpoPushService`, and add a new test. Replace the top of the file:

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;
  const sendToUser = jest.fn();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        PrismaService,
        { provide: ExpoPushService, useValue: { sendToUser } },
      ],
    }).compile();

    service = module.get(NotificationsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(() => {
    sendToUser.mockReset();
  });

  afterEach(async () => {
    await prisma.notification.deleteMany();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });
```

Then add a new test inside the existing `describe('sendPagamento', ...)` block (after the `'creates one Notification per userId with the category message'` test):

```typescript
    it('sends a push to every recipient with the notification id and link in the data payload', async () => {
      await service.sendPagamento('salario', ['user-1', 'user-2']);

      expect(sendToUser).toHaveBeenCalledTimes(2);

      const notifications = await prisma.notification.findMany({ orderBy: { userId: 'asc' } });
      expect(notifications).toHaveLength(2);

      for (const notification of notifications) {
        expect(sendToUser).toHaveBeenCalledWith(notification.userId, {
          title: 'Ponto DCIT',
          body: 'Seu salário foi depositado.',
          data: { notificationId: notification.id, link: null },
        });
      }
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest notifications/notifications.service.spec.ts -t "sends a push" --silent=false`
Expected: FAIL — `sendToUser` was never called (0 calls), because `sendPagamento` doesn't call it yet.

- [ ] **Step 3: Implement**

In `apps/api/src/notifications/notifications.service.ts`, add the import and constructor injection, and replace `sendPagamento`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';
import { PagamentoCategoria } from '@ponto-dcit/shared-types';
```

```typescript
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
  ) {}

  async sendPagamento(category: PagamentoCategoria, userIds: string[]) {
    const message = PAGAMENTO_MESSAGE[category];
    const created = await this.prisma.notification.createManyAndReturn({
      data: userIds.map((userId) => ({ userId, type: 'pagamento', category, message })),
    });
    await Promise.all(
      created.map((n) =>
        this.expoPush.sendToUser(n.userId, {
          title: 'Ponto DCIT',
          body: n.message,
          data: { notificationId: n.id, link: n.link },
        }),
      ),
    );
  }
```

(Leave `pagamentoStatus`, `listMine`, and `markRead` exactly as they are — only the constructor and `sendPagamento` change.)

In `apps/api/src/notifications/notifications.module.ts`, import `PushModule`:

```typescript
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [AuthModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest notifications/notifications.service.spec.ts --silent=false`
Expected: PASS, all tests in the file (the pre-existing `'creates one Notification per userId...'` test must still pass unchanged — `createManyAndReturn` returns the same fields `findMany` already asserted on, plus `id`/`link`).

Also run the full API suite to confirm nothing else broke (e.g. the app module still boots with the new `PushModule` import):

Run: `cd apps/api && npx jest --silent=false`
Expected: PASS aside from the pre-existing, environment-level flakiness recorded in this plan's ledger during setup (`auth/auth.service.spec.ts` fails identically on master when run in isolation — a real pre-existing gap unrelated to this task; do not attempt to fix it here).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/notifications.service.ts apps/api/src/notifications/notifications.module.ts apps/api/src/notifications/notifications.service.spec.ts
git commit -m "feat(api): send a real push when a pagamento notification is created"
```

---

### Task 3: Mobile — notification inbox context + badge on the home screen

**Files:**
- Create: `apps/mobile/src/lib/notifications-api.ts`
- Create: `apps/mobile/src/context/notification-context.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/src/app/(tabs)/index.tsx`
- Test: `apps/mobile/src/__tests__/app/(tabs)/index.test.tsx`

**Interfaces:**
- Produces:
  - `NotificationRecord = { id: string; type: string; category: string | null; message: string; link: string | null; createdAt: string; readAt: string | null }` (`apps/mobile/src/lib/notifications-api.ts`).
  - `fetchNotifications(token: string): Promise<NotificationRecord[] | null>` and `markNotificationRead(token: string, id: string): Promise<void>` (`apps/mobile/src/lib/notifications-api.ts`).
  - `NotificationProvider({ children }): JSX.Element` and `useNotificationContext(): { items: NotificationRecord[]; unreadCount: number; refresh: () => Promise<NotificationRecord[]>; handlePress: (notification: NotificationRecord) => void }` (`apps/mobile/src/context/notification-context.tsx`). Note `refresh` resolves with the freshly-fetched array (not just `void`) — Task 6's tap handler depends on this to avoid a React-render race.

- [ ] **Step 1: Write the failing test**

First, check `apps/mobile/src/__tests__/app/(tabs)/index.test.tsx` to see its current fetch-mocking setup (read the file — it already mocks `global.fetch` for the existing punch-flow tests). Add these two tests to it, following whatever mock-branching pattern the file already uses for `globalThis.fetch` (branch on `url.includes(...)`, same style as `apps/mobile/src/__tests__/app/notificacoes.test.tsx`'s jornada-alert test):

```typescript
  it("shows an unread-count badge on the notifications icon when there are unread notifications", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/notifications/mine")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "n1",
              type: "pagamento",
              category: "salario",
              message: "Seu salário foi depositado.",
              link: null,
              createdAt: "2026-09-02T21:00:00.000Z",
              readAt: null,
            },
            {
              id: "n2",
              type: "pagamento",
              category: "salario",
              message: "Antiga",
              link: null,
              createdAt: "2026-08-01T00:00:00.000Z",
              readAt: "2026-08-02T00:00:00.000Z",
            },
          ],
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("1")).toBeTruthy();
    });
  });

  it("refetches notifications when the app returns to the foreground", async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/notifications/mine")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });
    globalThis.fetch = fetchMock;
    const addEventListenerSpy = jest.spyOn(AppState, "addEventListener");

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/mine"),
        expect.anything(),
      );
    });
    fetchMock.mockClear();

    const [, listener] = addEventListenerSpy.mock.calls.find(([event]) => event === "change")!;
    listener("active" as never);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/mine"),
        expect.anything(),
      );
    });
  });
```

Add `import { AppState } from "react-native";` to the file's imports if not already present. Both tests need `await saveSessionToken("test-token");` to already have run — check whether the file's `beforeEach` already does this (mirroring `notificacoes.test.tsx`'s pattern); if not, add it to a `beforeEach` or to each test before `renderRouter`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest "(tabs)/index.test" -t "notification" --silent=false`
Expected: FAIL — `screen.getByText("1")` and the `/notifications/mine` fetch assertions fail because nothing fetches or renders a badge yet.

- [ ] **Step 3: Implement — `notifications-api.ts`**

Create `apps/mobile/src/lib/notifications-api.ts`:

```typescript
import { API_URL } from "@/constants/api";

export type NotificationRecord = {
  id: string;
  type: string;
  category: string | null;
  message: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
};

/**
 * Returns null on any failure (no session, network down, bad response) so
 * the caller can fall back to whatever local state it already has — this
 * hydrates the inbox, it never blocks any other screen.
 */
export async function fetchNotifications(token: string): Promise<NotificationRecord[] | null> {
  try {
    const response = await fetch(`${API_URL}/notifications/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as NotificationRecord[]) : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort: marking read is a side effect of a tap, not the user's
 * primary intent — a failure here never blocks navigation or shows an
 * error. Worst case the notification reads unread again next fetch.
 */
export async function markNotificationRead(token: string, id: string): Promise<void> {
  try {
    await fetch(`${API_URL}/notifications/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best-effort — see doc comment above.
  }
}
```

- [ ] **Step 4: Implement — `notification-context.tsx`**

Create `apps/mobile/src/context/notification-context.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useRouter, type Href } from "expo-router";

import { getSessionToken } from "@/lib/session";
import {
  fetchNotifications,
  markNotificationRead,
  type NotificationRecord,
} from "@/lib/notifications-api";

export type { NotificationRecord };

type NotificationContextValue = {
  items: NotificationRecord[];
  unreadCount: number;
  refresh: () => Promise<NotificationRecord[]>;
  handlePress: (notification: NotificationRecord) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const router = useRouter();

  const refresh = useCallback(async (): Promise<NotificationRecord[]> => {
    const token = await getSessionToken();
    if (!token) return [];
    const fetched = await fetchNotifications(token);
    if (!fetched) return [];
    setItems(fetched);
    return fetched;
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const handlePress = useCallback(
    (notification: NotificationRecord) => {
      if (notification.readAt === null) {
        const readAt = new Date().toISOString();
        setItems((current) =>
          current.map((n) => (n.id === notification.id ? { ...n, readAt } : n)),
        );
        getSessionToken().then((token) => {
          if (token) markNotificationRead(token, notification.id).catch(() => {});
        });
      }
      if (notification.link) {
        router.push(notification.link as Href);
      }
    },
    [router],
  );

  const unreadCount = items.filter((n) => n.readAt === null).length;

  return (
    <NotificationContext.Provider value={{ items, unreadCount, refresh, handlePress }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const value = useContext(NotificationContext);
  if (!value) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return value;
}
```

- [ ] **Step 5: Implement — mount the provider in `_layout.tsx`**

Modify `apps/mobile/src/app/_layout.tsx`:

```tsx
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { PontoProvider } from '@/context/ponto-context';
import { NotificationProvider } from '@/context/notification-context';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PontoProvider>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </NotificationProvider>
      </PontoProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 6: Implement — badge on the home screen icon**

In `apps/mobile/src/app/(tabs)/index.tsx`:

Add to imports: `Text` to the existing `react-native` import (`Pressable, ScrollView, StyleSheet, Text, View`); `ReactNode` to the existing `import type { ComponentProps } from "react";` line (becomes `import type { ComponentProps, ReactNode } from "react";`); and a new import `import { useNotificationContext } from "@/context/notification-context";`.

Change `HeaderIconButton` to accept and render `children`:

```tsx
function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  children,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[styles.headerIcon, { backgroundColor: theme.backgroundElement }, Elevation.card]}
    >
      <Ionicons name={icon} size={20} color={theme.text} />
      {children}
    </Pressable>
  );
}
```

In `HomeScreen`, get `unreadCount` and pass the badge as children of the notifications `HeaderIconButton`:

```tsx
  const { unreadCount } = useNotificationContext();
```

(add this line among the other hooks near the top of `HomeScreen`, e.g. right after `const { entries, addEntry, markEntrySynced, hydrateEntries } = usePonto();`)

```tsx
            <HeaderIconButton
              icon="notifications-outline"
              accessibilityLabel="Notificações"
              onPress={() => router.push("/notificacoes")}
            >
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              ) : null}
            </HeaderIconButton>
```

(replaces the existing self-closing `<HeaderIconButton icon="notifications-outline" .../>` call.)

Add to `styles` (`StyleSheet.create({...})`):

```tsx
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/mobile && npx jest "(tabs)/index.test" --silent=false`
Expected: PASS, all tests in the file (existing punch-flow tests + the two new ones).

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/lib/notifications-api.ts apps/mobile/src/context/notification-context.tsx apps/mobile/src/app/_layout.tsx "apps/mobile/src/app/(tabs)/index.tsx" "apps/mobile/src/__tests__/app/(tabs)/index.test.tsx"
git commit -m "feat(mobile): add shared notification inbox + unread badge on home screen"
```

---

### Task 4: Mobile — server-backed notifications section on `/notificacoes`

**Files:**
- Modify: `apps/mobile/src/app/notificacoes.tsx`
- Test: `apps/mobile/src/__tests__/app/notificacoes.test.tsx`

**Interfaces:**
- Consumes: `useNotificationContext()`, `NotificationRecord` from Task 3.

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/src/__tests__/app/notificacoes.test.tsx`:

```typescript
  it("shows server notifications above the computed notices, marks read and navigates on tap", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/notifications/mine")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "n1",
              type: "pagamento",
              category: "salario",
              message: "Seu salário foi depositado.",
              link: "/historico",
              createdAt: "2026-09-02T21:00:00.000Z",
              readAt: null,
            },
          ],
        });
      }
      if (typeof url === "string" && url.includes("/notifications/n1/read") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: false });
    });

    renderRouter("src/app", { initialUrl: "/notificacoes" });

    await waitFor(() => {
      expect(screen.getByText("Seu salário foi depositado.")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Seu salário foi depositado."));

    await waitFor(() => {
      expect(screen).toHavePathname("/historico");
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/n1/read"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows the empty state only when there are neither server notifications nor computed notices", () => {
    (globalThis.fetch as jest.Mock).mockImplementation(() => Promise.resolve({ ok: false }));

    renderRouter("src/app", { initialUrl: "/notificacoes" });

    expect(screen.getByText("Tudo em dia")).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest app/notificacoes.test --silent=false`
Expected: FAIL — the message text never appears (no server section rendered yet), and the second test may already incidentally pass (verify it currently does, since it's asserting existing behavior — if it does, that's fine, it's a regression guard for Step 3).

- [ ] **Step 3: Implement**

Modify `apps/mobile/src/app/notificacoes.tsx`. Add imports:

```tsx
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
```
(add `Pressable` to this existing import)

```tsx
import { useNotificationContext } from "@/context/notification-context";
```

Add inside `NotificacoesScreen`, near the other hooks:

```tsx
  const { items, handlePress } = useNotificationContext();
```

Add a date formatter near the top of the file (module scope, alongside `VENCIMENTO_ALERT_THRESHOLD_DAYS`):

```tsx
function formatNotificationDate(iso: string): string {
  // createdAt is a full ISO instant (Prisma DateTime -> JSON), not a
  // date-only value — the real wall-clock time in São Paulo is what
  // matters here, unlike the UTC-pinned date-only formatting used
  // elsewhere on this screen (jornada alert dates).
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

Replace the render's conditional block (currently `{notices.length === 0 ? (<EmptyState .../>) : (<ScrollView ...>{notices.map(...)}</ScrollView>)}`) with:

```tsx
      {items.length === 0 && notices.length === 0 ? (
        <EmptyState
          glyph="🔔"
          title="Tudo em dia"
          description="Nenhum aviso no momento."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.length > 0 ? (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Notificações
              </ThemedText>
              {items.map((notification) => (
                <Pressable
                  key={notification.id}
                  onPress={() => handlePress(notification)}
                  style={[styles.row, { backgroundColor: theme.backgroundElement }]}
                >
                  <View style={styles.rowContent}>
                    <ThemedText type="smallBold">{notification.message}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatNotificationDate(notification.createdAt)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}
          {notices.length > 0 ? (
            <>
              <ThemedText
                type="smallBold"
                themeColor="textSecondary"
                style={items.length > 0 ? styles.sectionGap : undefined}
              >
                Avisos
              </ThemedText>
              {notices.map((notice) => (
                <View key={notice.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons
                    name={notice.icon}
                    size={22}
                    color={notice.tone === "accent" ? theme.accent : theme.secondary}
                  />
                  <View style={styles.rowContent}>
                    <ThemedText type="smallBold">{notice.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {notice.description}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
```

Add to `styles`:

```tsx
  sectionGap: {
    marginTop: Spacing.two,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest app/notificacoes.test --silent=false`
Expected: PASS, all tests in the file (existing computed-notice tests + the two new ones).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/notificacoes.tsx apps/mobile/src/__tests__/app/notificacoes.test.tsx
git commit -m "feat(mobile): show server-backed notifications on /notificacoes"
```

---

### Task 5: Mobile — `push.ts` foreground handler + tap listener

**Files:**
- Modify: `apps/mobile/src/lib/push.ts`
- Test: `apps/mobile/src/__tests__/lib/push-notification-handler.test.ts` (new file)

**Interfaces:**
- Produces: `configureNotificationHandler(): void` and `addNotificationTapListener(onTap: (data: unknown) => void): () => void` (both in `apps/mobile/src/lib/push.ts`).

This is a separate test file from the existing `push.test.ts` because that file's `jest.mock("expo-notifications", ...)` deliberately throws (simulating Expo Go on Android) — these new functions need a working mock instead, which can't coexist with the throwing one in the same file.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/__tests__/lib/push-notification-handler.test.ts`:

```typescript
const setNotificationHandler = jest.fn();
const addNotificationResponseReceivedListener = jest.fn();
const getLastNotificationResponseAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  setNotificationHandler: (...args: unknown[]) => setNotificationHandler(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    addNotificationResponseReceivedListener(...args),
  getLastNotificationResponseAsync: (...args: unknown[]) =>
    getLastNotificationResponseAsync(...args),
}));

import { waitFor } from "@testing-library/react-native";
import { configureNotificationHandler, addNotificationTapListener } from "@/lib/push";

describe("configureNotificationHandler", () => {
  beforeEach(() => {
    setNotificationHandler.mockReset();
  });

  it("registers a notification handler with expo-notifications", () => {
    configureNotificationHandler();
    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
  });
});

describe("addNotificationTapListener", () => {
  beforeEach(() => {
    addNotificationResponseReceivedListener.mockReset().mockReturnValue({ remove: jest.fn() });
    getLastNotificationResponseAsync.mockReset().mockResolvedValue(null);
  });

  it("calls onTap with the tapped notification's data", () => {
    const onTap = jest.fn();
    addNotificationTapListener(onTap);

    const listener = addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    listener({
      notification: { request: { content: { data: { notificationId: "n1", link: "/historico" } } } },
    });

    expect(onTap).toHaveBeenCalledWith({ notificationId: "n1", link: "/historico" });
  });

  it("checks for a cold-start tap via getLastNotificationResponseAsync", async () => {
    getLastNotificationResponseAsync.mockResolvedValue({
      notification: { request: { content: { data: { notificationId: "n2", link: null } } } },
    });
    const onTap = jest.fn();

    addNotificationTapListener(onTap);

    await waitFor(() => {
      expect(onTap).toHaveBeenCalledWith({ notificationId: "n2", link: null });
    });
  });

  it("returns a cleanup function that removes the listener subscription", () => {
    const remove = jest.fn();
    addNotificationResponseReceivedListener.mockReturnValue({ remove });

    const cleanup = addNotificationTapListener(jest.fn());
    cleanup();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest push-notification-handler --silent=false`
Expected: FAIL — `configureNotificationHandler`/`addNotificationTapListener` don't exist yet (import error / undefined).

- [ ] **Step 3: Implement**

Add to `apps/mobile/src/lib/push.ts` (after the existing `unregisterPushNotifications` function, using the same `loadNotifications()` helper already defined at the top of the file):

```typescript
/**
 * Best-effort: without an explicit handler, the current Expo SDK's default
 * behavior is to NOT show a banner for a notification that arrives while
 * the app is in the foreground — this makes that behavior explicit so a
 * push received with the app open is actually visible.
 */
export function configureNotificationHandler(): void {
  try {
    const Notifications = loadNotifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Best-effort — without this, foreground pushes just don't show a
    // banner; tapping one from outside the app still works normally.
  }
}

/**
 * Best-effort: covers both a tap while the app is backgrounded (the
 * response listener fires) and a cold start where the tap is what
 * launched the app (getLastNotificationResponseAsync catches that case,
 * which the listener alone would miss). Returns a no-op cleanup on any
 * setup failure so callers can always call the returned function.
 */
export function addNotificationTapListener(onTap: (data: unknown) => void): () => void {
  try {
    const Notifications = loadNotifications();
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      onTap(response.notification.request.content.data);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) onTap(response.notification.request.content.data);
    });
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest push-notification-handler --silent=false`
Expected: PASS, all 4 new tests.

Also run the pre-existing push test file to confirm the new exports didn't disturb its throwing-mock scenario:

Run: `cd apps/mobile && npx jest lib/push.test --silent=false`
Expected: PASS (unchanged).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/push.ts apps/mobile/src/__tests__/lib/push-notification-handler.test.ts
git commit -m "feat(mobile): add foreground notification handler + tap listener"
```

---

### Task 6: Mobile — wire push-tap navigation into the root layout

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`
- Test: `apps/mobile/src/__tests__/app/notification-tap-navigation.test.tsx` (new file)

**Interfaces:**
- Consumes: `useNotificationContext()` (Task 3), `configureNotificationHandler`/`addNotificationTapListener` (Task 5).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/__tests__/app/notification-tap-navigation.test.tsx`:

```typescript
const addNotificationResponseReceivedListener = jest.fn();

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    addNotificationResponseReceivedListener(...args),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
}));

import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

globalThis.fetch = jest.fn();

describe("push notification tap navigation", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    addNotificationResponseReceivedListener.mockReset().mockReturnValue({ remove: jest.fn() });
    await saveSessionToken("test-token");
  });

  it("marks the notification read and navigates to its link when a background tap is handled", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/notifications/mine")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "n1",
              type: "pagamento",
              category: "salario",
              message: "Seu salário foi depositado.",
              link: "/historico",
              createdAt: "2026-09-02T21:00:00.000Z",
              readAt: null,
            },
          ],
        });
      }
      if (typeof url === "string" && url.includes("/notifications/n1/read") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: false });
    });

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    const listener = addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    listener({
      notification: { request: { content: { data: { notificationId: "n1", link: "/historico" } } } },
    });

    await waitFor(() => {
      expect(screen).toHavePathname("/historico");
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/n1/read"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("falls back to the payload's link when the notification isn't found in the refreshed inbox", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/notifications/mine")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    const listener = addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    listener({
      notification: { request: { content: { data: { notificationId: "gone", link: "/historico" } } } },
    });

    await waitFor(() => {
      expect(screen).toHavePathname("/historico");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest notification-tap-navigation --silent=false`
Expected: FAIL — `addNotificationResponseReceivedListener` is never called (nothing registers a tap listener yet), so the first `waitFor` times out.

- [ ] **Step 3: Implement**

Modify `apps/mobile/src/app/_layout.tsx`:

```tsx
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, type Href } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useEffect } from 'react';

import { PontoProvider } from '@/context/ponto-context';
import { NotificationProvider, useNotificationContext } from '@/context/notification-context';
import { configureNotificationHandler, addNotificationTapListener } from '@/lib/push';

export const unstable_settings = {
  initialRouteName: 'login',
};

function NotificationTapHandler() {
  const { refresh, handlePress } = useNotificationContext();
  const router = useRouter();

  useEffect(() => {
    configureNotificationHandler();
    return addNotificationTapListener(async (data) => {
      const payload = data as { notificationId?: string; link?: string | null };
      if (!payload.notificationId) return;
      const fetched = await refresh();
      const found = fetched.find((n) => n.id === payload.notificationId);
      if (found) {
        handlePress(found);
      } else if (payload.link) {
        router.push(payload.link as Href);
      }
    });
  }, [refresh, handlePress, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PontoProvider>
        <NotificationProvider>
          <NotificationTapHandler />
          <Stack screenOptions={{ headerShown: false }} />
        </NotificationProvider>
      </PontoProvider>
    </ThemeProvider>
  );
}
```

`NotificationTapHandler` must be a child of `NotificationProvider` (so `useNotificationContext()` resolves) but renders `null` — it exists only to run the tap-registration effect with access to the inbox context.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest notification-tap-navigation --silent=false`
Expected: PASS, both tests.

Then run the full mobile suite to confirm nothing regressed across all the files touched in this plan:

Run: `cd apps/mobile && npx jest --silent=false`
Expected: PASS, modulo the pre-existing flaky suites recorded in this plan's ledger during setup (5 suites failed on this worktree's clean baseline, before any task touched code — none of them are files this plan modifies). Compare the failing suite names against the ledger's baseline list; a new failure in a file this plan didn't touch is still worth flagging, but only a failure in a file this plan DID touch is this task's problem.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/_layout.tsx apps/mobile/src/__tests__/app/notification-tap-navigation.test.tsx
git commit -m "feat(mobile): navigate to a tapped push notification's link"
```

---

## After all tasks

Run the full monorepo suite once more from the repo root (`apps/api` + `apps/mobile` + `apps/web` + `packages/shared-types`) to catch any cross-package gap no single task's file list would surface (the documented gotcha from the Pagamentos sub-project: a changed shared type/consumer outside any task's stated files). Then do a final whole-branch review before considering this sub-project done, per this project's established practice — task-scoped reviews have repeatedly missed real bugs (stale-state races, timezone edge cases) that only a full-diff review caught.
