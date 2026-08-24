# Layout da Aplicação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single placeholder screen in each app with a real navigation shell — a 5-tab bottom navigation in the mobile app (colaborador) and a 2-section sidebar admin shell in the web app (RH) — so every future feature plan has a screen to build its data into instead of starting from a blank app.

**Architecture:** Mobile gets an expo-router `Tabs` navigator with one route per MVP section; four of the five screens (all but "Ponto", which already has a real endpoint) render a shared `EmptyState` component until their own backend module lands. Web gets an `AppShell` component (sidebar + content slot) wrapping the existing root layout, linking to two new pages (`/aprovacoes`, `/documentos`) that also render a (separate, web-native) `EmptyState` until the `approvals`/`documents` backend modules exist. No new styling dependency is introduced on either app — mobile keeps `StyleSheet` + the existing `Colors` theme object, web keeps CSS Modules, with the mobile palette copied into web custom properties so the two apps share a visual language.

**Tech Stack:** Expo Router (Tabs), React Native `StyleSheet`, `@testing-library/react-native` + `expo-router/testing-library`, Next.js App Router, CSS Modules, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-24-layout-aplicacao-design.md`

## Global Constraints

- TypeScript ponta a ponta — no other languages introduced.
- No new styling/UI dependency on either app: mobile uses `StyleSheet` + `apps/mobile/src/constants/theme.ts`'s `Colors`; web uses CSS Modules (both already in place).
- Follow existing patterns: mobile screens use `ThemedView`/`ThemedText` from `apps/mobile/src/components/`; web pages are React Server Components under `apps/web/src/app/`.
- The mobile color palette (`Colors.light`/`Colors.dark` in `apps/mobile/src/constants/theme.ts`) is the single source of truth for color values; the web app's new custom properties must copy those exact hex values, not invent new ones.
- No auth/login logic — the web sidebar reserves a space for the logged-in user's identity but does not implement authentication (module `auth` doesn't exist yet).
- No business logic for banco de horas, férias, documentos, mural (mobile) or aprovações, documentos (web) — every one of those screens renders `EmptyState` only; real data wiring is a future plan per module.

---

## File Structure

```
apps/
  mobile/
    src/
      components/
        empty-state.tsx              # new — shared placeholder UI
        __tests__/
          empty-state.test.tsx       # new
      app/
        _layout.tsx                  # unchanged (root Stack, auto-discovers (tabs))
        (tabs)/
          _layout.tsx                 # new — Tabs navigator, 5 screens
          index.tsx                   # moved from src/app/index.tsx (unchanged content)
          banco-de-horas.tsx          # new — EmptyState
          ferias.tsx                  # new — EmptyState
          documentos.tsx              # new — EmptyState
          mural.tsx                   # new — EmptyState
          __tests__/
            index.test.tsx            # moved from src/app/__tests__/index.test.tsx
            placeholder-screens.test.tsx  # new
        __tests__/
          tabs-layout.test.tsx        # new — renderRouter integration test
  web/
    src/
      app/
        layout.tsx                    # modified — wraps {children} in <AppShell>
        globals.css                   # modified — adds shared color tokens
        aprovacoes/
          page.tsx                    # new — EmptyState
        documentos/
          page.tsx                    # new — EmptyState
      components/
        empty-state.tsx               # new — web EmptyState
        empty-state.module.css        # new
        app-shell.tsx                 # new — sidebar shell
        app-shell.module.css          # new
    e2e/
      home.spec.ts                    # unchanged, still passes
      empty-state-pages.spec.ts       # new
      app-shell.spec.ts               # new
```

---

### Task 1: Mobile — `EmptyState` component

**Files:**
- Create: `apps/mobile/src/components/empty-state.tsx`
- Test: `apps/mobile/src/components/__tests__/empty-state.test.tsx`

**Interfaces:**
- Consumes: `ThemedView`, `ThemedText` from `apps/mobile/src/components/` (existing); `Spacing` from `apps/mobile/src/constants/theme.ts` (existing).
- Produces: `EmptyState({ glyph, title, description }: { glyph: string; title: string; description: string }) => JSX.Element`, exported from `apps/mobile/src/components/empty-state.tsx`, imported elsewhere as `import { EmptyState } from "@/components/empty-state";`. Task 2's four placeholder screens consume this directly.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/src/components/__tests__/empty-state.test.tsx
import { render, screen } from "@testing-library/react-native";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders the glyph, title and description", () => {
    render(
      <EmptyState
        glyph="🌴"
        title="Férias"
        description="Suas solicitações de férias vão aparecer aqui."
      />
    );

    expect(screen.getByText("🌴")).toBeTruthy();
    expect(screen.getByText("Férias")).toBeTruthy();
    expect(screen.getByText("Suas solicitações de férias vão aparecer aqui.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/mobile test -- empty-state.test.tsx`
Expected: FAIL — `Cannot find module '../empty-state'`.

- [ ] **Step 3: Write `apps/mobile/src/components/empty-state.tsx`**

```tsx
import { StyleSheet } from "react-native";

import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

import { Spacing } from "@/constants/theme";

type EmptyStateProps = {
  glyph: string;
  title: string;
  description: string;
};

export function EmptyState({ glyph, title, description }: EmptyStateProps) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.glyph}>{glyph}</ThemedText>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
        {description}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    padding: Spacing.four,
  },
  glyph: {
    fontSize: 40,
  },
  description: {
    textAlign: "center",
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/mobile test -- empty-state.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/empty-state.tsx apps/mobile/src/components/__tests__/empty-state.test.tsx
git commit -m "feat(mobile): add EmptyState component"
```

---

### Task 2: Mobile — 5-tab navigation shell

**Files:**
- Move: `apps/mobile/src/app/index.tsx` → `apps/mobile/src/app/(tabs)/index.tsx`
- Move: `apps/mobile/src/app/__tests__/index.test.tsx` → `apps/mobile/src/app/(tabs)/__tests__/index.test.tsx`
- Create: `apps/mobile/src/app/(tabs)/banco-de-horas.tsx`
- Create: `apps/mobile/src/app/(tabs)/ferias.tsx`
- Create: `apps/mobile/src/app/(tabs)/documentos.tsx`
- Create: `apps/mobile/src/app/(tabs)/mural.tsx`
- Test: `apps/mobile/src/app/(tabs)/__tests__/placeholder-screens.test.tsx`
- Create: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Test: `apps/mobile/src/app/__tests__/tabs-layout.test.tsx`

**Interfaces:**
- Consumes: `EmptyState` from Task 1 (`@/components/empty-state`).
- Produces: 5 routes reachable at `/`, `/banco-de-horas`, `/ferias`, `/documentos`, `/mural`, rendered inside a `Tabs` navigator. Future plans for banco de horas, férias, documentos and mural replace the `EmptyState` call inside the corresponding screen file with real data-fetching UI — the file itself is the seam.

- [ ] **Step 1: Move the existing Ponto screen and its test into the `(tabs)` route group**

Run:
```bash
mkdir -p apps/mobile/src/app/\(tabs\)/__tests__
git mv apps/mobile/src/app/index.tsx "apps/mobile/src/app/(tabs)/index.tsx"
git mv apps/mobile/src/app/__tests__/index.test.tsx "apps/mobile/src/app/(tabs)/__tests__/index.test.tsx"
```
No content changes needed — `index.test.tsx` imports `../index`, which still resolves correctly relative to its new location.

- [ ] **Step 2: Run the moved test to confirm nothing broke**

Run: `pnpm --filter @ponto-dcit/mobile test -- index.test.tsx`
Expected: PASS (same 2 tests as before the move).

- [ ] **Step 3: Write the failing test for the 4 new placeholder screens**

```tsx
// apps/mobile/src/app/(tabs)/__tests__/placeholder-screens.test.tsx
import { render, screen } from "@testing-library/react-native";
import BancoDeHorasScreen from "../banco-de-horas";
import FeriasScreen from "../ferias";
import DocumentosScreen from "../documentos";
import MuralScreen from "../mural";

describe("placeholder screens", () => {
  it("renders the Banco de Horas empty state", () => {
    render(<BancoDeHorasScreen />);
    expect(screen.getByText("Banco de Horas")).toBeTruthy();
  });

  it("renders the Férias empty state", () => {
    render(<FeriasScreen />);
    expect(screen.getByText("Férias")).toBeTruthy();
  });

  it("renders the Documentos empty state", () => {
    render(<DocumentosScreen />);
    expect(screen.getByText("Documentos")).toBeTruthy();
  });

  it("renders the Mural empty state", () => {
    render(<MuralScreen />);
    expect(screen.getByText("Mural")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/mobile test -- placeholder-screens.test.tsx`
Expected: FAIL — `Cannot find module '../banco-de-horas'`.

- [ ] **Step 5: Write the 4 placeholder screens**

```tsx
// apps/mobile/src/app/(tabs)/banco-de-horas.tsx
import { EmptyState } from "@/components/empty-state";

export default function BancoDeHorasScreen() {
  return (
    <EmptyState
      glyph="⏱️"
      title="Banco de Horas"
      description="Seu saldo de horas positivo e negativo vai aparecer aqui."
    />
  );
}
```

```tsx
// apps/mobile/src/app/(tabs)/ferias.tsx
import { EmptyState } from "@/components/empty-state";

export default function FeriasScreen() {
  return (
    <EmptyState
      glyph="🌴"
      title="Férias"
      description="Suas solicitações de férias e justificativas vão aparecer aqui."
    />
  );
}
```

```tsx
// apps/mobile/src/app/(tabs)/documentos.tsx
import { EmptyState } from "@/components/empty-state";

export default function DocumentosScreen() {
  return (
    <EmptyState
      glyph="📄"
      title="Documentos"
      description="Seus documentos e atestados enviados vão aparecer aqui."
    />
  );
}
```

```tsx
// apps/mobile/src/app/(tabs)/mural.tsx
import { EmptyState } from "@/components/empty-state";

export default function MuralScreen() {
  return (
    <EmptyState
      glyph="📣"
      title="Mural"
      description="Os avisos e comunicados da empresa vão aparecer aqui."
    />
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/mobile test -- placeholder-screens.test.tsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 7: Write the failing test for the tab bar itself**

```tsx
// apps/mobile/src/app/__tests__/tabs-layout.test.tsx
import { renderRouter, screen } from "expo-router/testing-library";

describe("(tabs) navigation", () => {
  it("renders a tab bar with all 5 sections", () => {
    renderRouter("src/app", { initialUrl: "/" });

    expect(screen.getByText("Ponto")).toBeTruthy();
    expect(screen.getByText("Banco de Horas")).toBeTruthy();
    expect(screen.getByText("Férias")).toBeTruthy();
    expect(screen.getByText("Documentos")).toBeTruthy();
    expect(screen.getByText("Mural")).toBeTruthy();
  });

  it("navigates to the Banco de Horas route", () => {
    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    expect(screen).toHavePathname("/banco-de-horas");
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/mobile test -- tabs-layout.test.tsx`
Expected: FAIL — `Unable to find an element with text: Banco de Horas` (no tab bar exists yet; the `(tabs)` folder has no `_layout.tsx`, so its screens render as plain stack routes with no visible tab labels).

- [ ] **Step 9: Write `apps/mobile/src/app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Ponto" }} />
      <Tabs.Screen name="banco-de-horas" options={{ title: "Banco de Horas" }} />
      <Tabs.Screen name="ferias" options={{ title: "Férias" }} />
      <Tabs.Screen name="documentos" options={{ title: "Documentos" }} />
      <Tabs.Screen name="mural" options={{ title: "Mural" }} />
    </Tabs>
  );
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/mobile test -- tabs-layout.test.tsx`
Expected: PASS — both tests green.

- [ ] **Step 11: Run the full mobile test suite**

Run: `pnpm --filter @ponto-dcit/mobile test`
Expected: PASS — every spec in `apps/mobile` green, including the moved `index.test.tsx`, the new `empty-state.test.tsx`, `placeholder-screens.test.tsx` and `tabs-layout.test.tsx`.

- [ ] **Step 12: Commit**

```bash
git add apps/mobile/src/app apps/mobile/src/components
git commit -m "feat(mobile): add 5-tab navigation shell with placeholder screens"
```

---

### Task 3: Web — `EmptyState` component + Aprovações/Documentos pages

**Files:**
- Create: `apps/web/src/components/empty-state.tsx`
- Create: `apps/web/src/components/empty-state.module.css`
- Create: `apps/web/src/app/aprovacoes/page.tsx`
- Create: `apps/web/src/app/documentos/page.tsx`
- Test: `apps/web/e2e/empty-state-pages.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EmptyState({ title, description }: { title: string; description: string }) => JSX.Element` from `apps/web/src/components/empty-state.tsx`, imported as `import { EmptyState } from "@/components/empty-state";`. Two pages at `/aprovacoes` and `/documentos` that Task 4's `AppShell` links to.

- [ ] **Step 1: Write the failing e2e test**

```ts
// apps/web/e2e/empty-state-pages.spec.ts
import { test, expect } from "@playwright/test";

test("aprovações page renders its empty state", async ({ page }) => {
  await page.goto("/aprovacoes");
  await expect(page.getByRole("heading", { name: "Fila de aprovações" })).toBeVisible();
  await expect(
    page.getByText(
      "As solicitações de férias e justificativas pendentes de validação vão aparecer aqui."
    )
  ).toBeVisible();
});

test("documentos page renders its empty state", async ({ page }) => {
  await page.goto("/documentos");
  await expect(page.getByRole("heading", { name: "Documentos e atestados" })).toBeVisible();
  await expect(
    page.getByText(
      "Os documentos e atestados enviados pelos colaboradores vão aparecer aqui."
    )
  ).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/web exec playwright test empty-state-pages.spec.ts`
Expected: FAIL — both routes 404 (no page exists yet).

- [ ] **Step 3: Write `apps/web/src/components/empty-state.tsx`**

```tsx
import styles from "./empty-state.module.css";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
```

- [ ] **Step 4: Write `apps/web/src/components/empty-state.module.css`**

```css
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 60vh;
  text-align: center;
  padding: 48px 24px;
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
}

.description {
  font-size: 16px;
  color: var(--color-text-secondary);
  max-width: 420px;
}
```

- [ ] **Step 5: Write `apps/web/src/app/aprovacoes/page.tsx`**

```tsx
import { EmptyState } from "@/components/empty-state";

export default function AprovacoesPage() {
  return (
    <EmptyState
      title="Fila de aprovações"
      description="As solicitações de férias e justificativas pendentes de validação vão aparecer aqui."
    />
  );
}
```

- [ ] **Step 6: Write `apps/web/src/app/documentos/page.tsx`**

```tsx
import { EmptyState } from "@/components/empty-state";

export default function DocumentosPage() {
  return (
    <EmptyState
      title="Documentos e atestados"
      description="Os documentos e atestados enviados pelos colaboradores vão aparecer aqui."
    />
  );
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/web exec playwright test empty-state-pages.spec.ts`
Expected: PASS — both tests green. (`--color-text`/`--color-text-secondary` aren't defined yet at this point, so the text renders in the browser's default color — that's fine, Task 4 adds the tokens; this test only checks the text is present and visible, not its color.)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components apps/web/src/app/aprovacoes apps/web/src/app/documentos apps/web/e2e/empty-state-pages.spec.ts
git commit -m "feat(web): add EmptyState component and Aprovações/Documentos pages"
```

---

### Task 4: Web — `AppShell` sidebar + shared color tokens

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/src/components/app-shell.module.css`
- Modify: `apps/web/src/app/layout.tsx`
- Test: `apps/web/e2e/app-shell.spec.ts`

**Interfaces:**
- Consumes: `/aprovacoes` and `/documentos` pages from Task 3 as navigation targets.
- Produces: `AppShell({ children }: { children: ReactNode }) => JSX.Element` from `apps/web/src/components/app-shell.tsx`, wired into the root layout so every page in the app renders inside the shell.

- [ ] **Step 1: Add the shared color tokens to `apps/web/src/app/globals.css`**

Add these alongside the existing `:root` and dark-mode blocks (don't remove the existing `--background`/`--foreground` tokens — `page.module.css` still depends on them):

```css
:root {
  --background: #ffffff;
  --foreground: #171717;

  --color-background: #ffffff;
  --color-text: #000000;
  --color-background-element: #f0f0f3;
  --color-background-selected: #e0e1e6;
  --color-text-secondary: #60646c;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;

    --color-background: #000000;
    --color-text: #ffffff;
    --color-background-element: #212225;
    --color-background-selected: #2e3135;
    --color-text-secondary: #b0b4ba;
  }
}
```

These exact hex values are copied from `Colors.light`/`Colors.dark` in `apps/mobile/src/constants/theme.ts` — do not use different values.

- [ ] **Step 2: Write the failing e2e test for the sidebar**

```ts
// apps/web/e2e/app-shell.spec.ts
import { test, expect } from "@playwright/test";

test("sidebar renders both sections and navigates between them", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Aprovações" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();

  await page.getByRole("link", { name: "Aprovações" }).click();
  await expect(page).toHaveURL(/\/aprovacoes$/);
  await expect(page.getByRole("heading", { name: "Fila de aprovações" })).toBeVisible();

  await page.getByRole("link", { name: "Documentos" }).click();
  await expect(page).toHaveURL(/\/documentos$/);
  await expect(page.getByRole("heading", { name: "Documentos e atestados" })).toBeVisible();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/web exec playwright test app-shell.spec.ts`
Expected: FAIL — no `Aprovações`/`Documentos` links exist on `/` yet.

- [ ] **Step 4: Write `apps/web/src/components/app-shell.tsx`**

```tsx
import type { ReactNode } from "react";
import Link from "next/link";

import styles from "./app-shell.module.css";

const NAV_SECTIONS = [
  { href: "/aprovacoes", label: "Aprovações" },
  { href: "/documentos", label: "Documentos" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.identity}>RH</div>
        <nav>
          <ul className={styles.nav}>
            {NAV_SECTIONS.map((section) => (
              <li key={section.href}>
                <Link href={section.href} className={styles.navLink}>
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Write `apps/web/src/components/app-shell.module.css`**

```css
.shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--color-background-element);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.identity {
  font-weight: 600;
  color: var(--color-text);
}

.nav {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.navLink {
  display: block;
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--color-text-secondary);
}

.navLink:hover {
  background: var(--color-background-selected);
  color: var(--color-text);
}

.content {
  flex: 1;
  min-width: 0;
}
```

- [ ] **Step 6: Wire `AppShell` into `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ponto DCIT",
  description: "Registro de ponto da DCIT Tecnologia",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/web exec playwright test app-shell.spec.ts`
Expected: PASS.

- [ ] **Step 8: Run the full web test suite**

Run: `pnpm --filter @ponto-dcit/web exec playwright test`
Expected: PASS — `home.spec.ts` (unmodified, `/` still renders the "Ponto DCIT" heading, now inside the shell), `empty-state-pages.spec.ts` and `app-shell.spec.ts` all green.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/src/components/app-shell.tsx apps/web/src/components/app-shell.module.css apps/web/e2e/app-shell.spec.ts
git commit -m "feat(web): add AppShell sidebar and shared color tokens"
```

---

## Self-Review Notes

- **Spec coverage:** Section 3 (mobile nav, 5 tabs) → Task 2. Section 4 (web nav, 2 sidebar sections + reserved identity space) → Task 4. Section 5 (shared palette, web dark mode via existing `prefers-color-scheme` block) → Task 4 Step 1; mobile dark mode was already implemented before this plan (`useColorScheme` + `ThemeProvider` in the existing root `_layout.tsx`), so no task re-does it. Section 6 (`EmptyState`, one per platform) → Task 1 (mobile) and Task 3 (web). Section 7 (tests, no new tooling) → every task ends with its own test run using the frameworks already in the repo. Section 8 (out of scope) → no task touches auth, business logic, or a shared design system.
- **No placeholders:** every step has literal file contents or exact commands; no screen defers its copy to "TBD".
- **Type/name consistency:** `EmptyState` mobile signature (`glyph`, `title`, `description`) matches every call site in Task 2's four screens. `EmptyState` web signature (`title`, `description`) matches both Task 3 pages. Route file names in Task 2 Step 9 (`index`, `banco-de-horas`, `ferias`, `documentos`, `mural`) match the file names created in Steps 1 and 5 exactly. Nav hrefs in Task 4's `AppShell` (`/aprovacoes`, `/documentos`) match the folder names created in Task 3.
