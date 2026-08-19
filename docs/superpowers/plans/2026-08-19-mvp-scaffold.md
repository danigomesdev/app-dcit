# Ponto DCIT — MVP Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Ponto DCIT monorepo end to end — tooling, a shared type-contract package, a NestJS backend with a real (online-only) `POST /time-entries` endpoint, a Next.js web skeleton, an Expo mobile skeleton that can call that endpoint, and CI — so every subsequent feature plan (offline sync, auth/SSO, leave requests, documents, approvals, etc.) has a working foundation to build on.

**Architecture:** TypeScript monorepo managed with pnpm workspaces + Turborepo. Three apps (`apps/api` NestJS, `apps/web` Next.js, `apps/mobile` Expo) share a single source of truth for data contracts via `packages/shared-types` (Zod schemas). Backend persists to SQLite via Prisma for now (Postgres/docker-compose is already documented in the architecture spec and is a drop-in swap once Docker is available on the dev machine — see "Out of scope" below).

**Tech Stack:** Node.js 24 LTS, pnpm (via corepack), Turborepo, NestJS 11, Prisma + SQLite, Next.js (App Router), Expo (React Native, expo-router), Zod, Jest, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md` (architecture) and `docs/spec-funcional.md` (functional spec v2)

## Global Constraints

- TypeScript ponta a ponta (mobile, backend, web) — no other languages introduced.
- Monorepo: pnpm workspaces + Turborepo, hosted on GitHub.
- Backend is a modular monolith; modules are organized by business domain, not by roadmap phase.
- No biometric verification anywhere in the point-marking flow.
- Geolocation (when implemented) must never block point marking — out of scope for this plan, called out here because it constrains how the `time-entries` endpoint's contract is shaped (no required-location field).
- `packages/shared-types` is the single source of truth for data contracts shared across apps — no duplicated type/schema definitions.

## Out of scope for this plan

- **Offline queue + signed local timestamps on mobile.** The architecture spec calls this "the most sensitive point in the system" and it deserves its own focused plan with its own design review, not to be bundled into the scaffold. This plan's mobile app calls the API directly over HTTP (online-only) so there's a real, testable vertical slice to build the offline layer on top of later.
- **Auth/SSO (Active Directory).** The `time-entries` endpoint in this plan takes a `userId` string in the payload with no auth guard. A dedicated `auth` module plan will add SSO/JWT and then this endpoint will read the user from the authenticated session instead.
- **Postgres/docker-compose activation.** Docker Desktop is not installed on the dev machine yet (requires enabling WSL2, which requires a reboot). The docker-compose file is written and committed as part of this plan so it's ready to use, but Prisma is configured against local SQLite for now so the plan is fully runnable without Docker. Switching the Prisma datasource to `postgresql` is a one-line change (`prisma/schema.prisma` `provider`) plus a new `DATABASE_URL`, planned as the first step of whichever future plan needs a real Postgres instance.
- All other domain modules (`leave-requests`, `documents`, `approvals`, `notifications`, `announcements`) and the web/mobile screens for them — each gets its own plan once started.

---

## File Structure

```
ponto-dcit/
  package.json                 # root workspace scripts
  pnpm-workspace.yaml
  turbo.json
  .gitignore
  .github/workflows/ci.yml
  packages/
    shared-types/
      package.json
      tsconfig.json
      src/
        index.ts
        time-entry.ts
        time-entry.test.ts
  apps/
    api/                        # NestJS (generated via Nest CLI, then modified)
      src/
        health/
          health.controller.ts
          health.controller.spec.ts
        time-entries/
          time-entries.module.ts
          time-entries.controller.ts
          time-entries.controller.spec.ts
          time-entries.service.ts
          time-entries.service.spec.ts
          prisma.service.ts
      prisma/
        schema.prisma
      .env
    web/                        # Next.js (generated via create-next-app)
      src/app/page.tsx
      e2e/home.spec.ts
      playwright.config.ts
    mobile/                     # Expo (generated via create-expo-app)
      app/index.tsx
      app/__tests__/index.test.tsx
  infra/
    docker/
      docker-compose.yml
```

Each app keeps its own `package.json`; pnpm workspaces link them together and Turborepo orchestrates `build`/`test`/`lint` across all of them with caching.

---

### Task 1: Monorepo tooling foundation

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Interfaces:**
- Produces: the `pnpm turbo run <task>` command every later task's test/build step relies on. Any app added under `apps/*` or `packages/*` is automatically picked up as a workspace member.

- [ ] **Step 1: Enable pnpm via corepack**

Run:
```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```
Expected: prints a pnpm version (9.x or later).

- [ ] **Step 2: Write `.nvmrc`**

```
24
```

- [ ] **Step 3: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: Write root `package.json`**

```json
{
  "name": "ponto-dcit",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 5: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules/
dist/
.next/
.expo/
*.tsbuildinfo
.env
.env.local
*.db
.turbo/
```

- [ ] **Step 7: Install root dependencies and verify Turborepo runs with zero packages**

Run:
```bash
pnpm install
pnpm turbo run build
```
Expected: `pnpm install` succeeds; `pnpm turbo run build` prints "No tasks were executed" (or similar) since no workspace packages exist yet — this confirms the pipeline wiring is correct before any app exists.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore .nvmrc pnpm-lock.yaml
git commit -m "chore: bootstrap pnpm/turborepo monorepo tooling"
```

---

### Task 2: `packages/shared-types` — shared data contracts

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/time-entry.ts`
- Test: `packages/shared-types/src/time-entry.test.ts`

**Interfaces:**
- Consumes: nothing (leaf package).
- Produces: `TimeEntryInputSchema` (Zod schema) and `TimeEntryInput` (inferred TS type), exported from `@ponto-dcit/shared-types`. Task 4 (backend) uses `TimeEntryInputSchema.parse(...)` to validate the request body. Task 6 (mobile) imports `TimeEntryInput` for the fetch call's payload type.

- [ ] **Step 1: Write `packages/shared-types/package.json`**

```json
{
  "name": "@ponto-dcit/shared-types",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "jest"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Write `packages/shared-types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "dist"]
}
```

- [ ] **Step 3: Write the failing test — `packages/shared-types/src/time-entry.test.ts`**

```typescript
import { TimeEntryInputSchema } from "./time-entry";

describe("TimeEntryInputSchema", () => {
  it("accepts a valid payload", () => {
    const result = TimeEntryInputSchema.safeParse({
      userId: "user-123",
      clockedAt: "2026-08-19T13:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing userId", () => {
    const result = TimeEntryInputSchema.safeParse({
      clockedAt: "2026-08-19T13:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with a non-ISO clockedAt", () => {
    const result = TimeEntryInputSchema.safeParse({
      userId: "user-123",
      clockedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Install dependencies and run the test to verify it fails**

Run:
```bash
pnpm install
pnpm --filter @ponto-dcit/shared-types test
```
Expected: FAIL — `Cannot find module './time-entry'`.

- [ ] **Step 5: Write `packages/shared-types/src/time-entry.ts`**

```typescript
import { z } from "zod";

export const TimeEntryInputSchema = z.object({
  userId: z.string().min(1),
  clockedAt: z.string().datetime(),
});

export type TimeEntryInput = z.infer<typeof TimeEntryInputSchema>;
```

- [ ] **Step 6: Write `packages/shared-types/src/index.ts`**

```typescript
export { TimeEntryInputSchema } from "./time-entry";
export type { TimeEntryInput } from "./time-entry";
```

- [ ] **Step 7: Run the test to verify it passes**

Run:
```bash
pnpm --filter @ponto-dcit/shared-types test
```
Expected: PASS — 3 tests green.

- [ ] **Step 8: Build the package**

Run:
```bash
pnpm --filter @ponto-dcit/shared-types build
```
Expected: `packages/shared-types/dist/index.js` and `dist/index.d.ts` are created with no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared-types pnpm-lock.yaml
git commit -m "feat(shared-types): add TimeEntryInput schema"
```

---

### Task 3: `apps/api` — NestJS skeleton with a health endpoint

**Files:**
- Create: `apps/api/` (generated by Nest CLI, see Step 1)
- Create: `apps/api/src/health/health.controller.ts`
- Test: `apps/api/src/health/health.controller.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a running NestJS app on port 3000 with `GET /health` → `{ status: "ok" }`. Task 4 adds the `time-entries` module into this same `AppModule`.

- [ ] **Step 1: Generate the Nest app into `apps/api`**

Run from the repo root:
```bash
pnpm dlx @nestjs/cli new apps/api --package-manager pnpm --skip-git --skip-install
```
Expected: `apps/api` is created with the standard Nest CLI structure (`src/main.ts`, `src/app.module.ts`, etc.).

- [ ] **Step 2: Rename the generated package and align it with the workspace**

Edit `apps/api/package.json`: change `"name"` to `"@ponto-dcit/api"`, remove the `"packageManager"` field if present (root already declares it), and delete `apps/api/pnpm-lock.yaml` if the CLI created one (the root lockfile is the single source of truth).

- [ ] **Step 3: Write the failing test — `apps/api/src/health/health.controller.spec.ts`**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("returns ok status", () => {
    expect(controller.check()).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 4: Install dependencies and run the test to verify it fails**

Run:
```bash
pnpm install
pnpm --filter @ponto-dcit/api test -- health.controller.spec.ts
```
Expected: FAIL — `Cannot find module './health.controller'`.

- [ ] **Step 5: Write `apps/api/src/health/health.controller.ts`**

```typescript
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  check() {
    return { status: "ok" };
  }

  @Get()
  handle() {
    return this.check();
  }
}
```

- [ ] **Step 6: Register `HealthController` in `apps/api/src/app.module.ts`**

Modify `apps/api/src/app.module.ts` to import and register the controller:

```typescript
import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 7: Run the test to verify it passes**

Run:
```bash
pnpm --filter @ponto-dcit/api test -- health.controller.spec.ts
```
Expected: PASS.

- [ ] **Step 8: Boot the app and manually verify the endpoint**

Run:
```bash
pnpm --filter @ponto-dcit/api start &
sleep 3
curl http://localhost:3000/health
kill %1
```
Expected: `{"status":"ok"}`.

- [ ] **Step 9: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): scaffold NestJS app with health endpoint"
```

---

### Task 4: `apps/api` — `time-entries` module (Prisma + SQLite)

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/.env`
- Create: `apps/api/src/time-entries/prisma.service.ts`
- Create: `apps/api/src/time-entries/time-entries.service.ts`
- Test: `apps/api/src/time-entries/time-entries.service.spec.ts`
- Create: `apps/api/src/time-entries/time-entries.controller.ts`
- Test: `apps/api/src/time-entries/time-entries.controller.spec.ts`
- Create: `apps/api/src/time-entries/time-entries.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `TimeEntryInputSchema`, `TimeEntryInput` from `@ponto-dcit/shared-types` (Task 2).
- Produces: `POST /time-entries` → `201` with the created row `{ id, userId, clockedAt, createdAt }`. `TimeEntriesService.create(input: TimeEntryInput)` is the method a future offline-sync-worker plan will call directly (or via HTTP) once it exists.

- [ ] **Step 1: Add Prisma and the shared-types dependency to `apps/api`**

Run:
```bash
pnpm --filter @ponto-dcit/api add @prisma/client zod
pnpm --filter @ponto-dcit/api add -D prisma
pnpm --filter @ponto-dcit/api add @ponto-dcit/shared-types@workspace:*
```

- [ ] **Step 2: Write `apps/api/.env`**

```
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 3: Write `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model TimeEntry {
  id        String   @id @default(uuid())
  userId    String
  clockedAt DateTime
  createdAt DateTime @default(now())
}
```

- [ ] **Step 4: Run the initial migration**

Run:
```bash
pnpm --filter @ponto-dcit/api exec prisma migrate dev --name init
```
Expected: creates `apps/api/prisma/migrations/`, `apps/api/dev.db`, and generates the Prisma client with no errors.

- [ ] **Step 5: Write `apps/api/src/time-entries/prisma.service.ts`**

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 6: Write the failing test — `apps/api/src/time-entries/time-entries.service.spec.ts`**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { TimeEntriesService } from "./time-entries.service";
import { PrismaService } from "./prisma.service";

describe("TimeEntriesService", () => {
  let service: TimeEntriesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimeEntriesService, PrismaService],
    }).compile();

    service = module.get(TimeEntriesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.timeEntry.deleteMany();
    await prisma.onModuleDestroy();
  });

  it("creates and persists a time entry", async () => {
    const created = await service.create({
      userId: "user-123",
      clockedAt: "2026-08-19T13:00:00.000Z",
    });

    expect(created.userId).toBe("user-123");
    expect(created.clockedAt.toISOString()).toBe("2026-08-19T13:00:00.000Z");

    const found = await prisma.timeEntry.findUnique({ where: { id: created.id } });
    expect(found).not.toBeNull();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run:
```bash
pnpm --filter @ponto-dcit/api test -- time-entries.service.spec.ts
```
Expected: FAIL — `Cannot find module './time-entries.service'`.

- [ ] **Step 8: Write `apps/api/src/time-entries/time-entries.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { TimeEntryInput } from "@ponto-dcit/shared-types";
import { PrismaService } from "./prisma.service";

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: TimeEntryInput) {
    return this.prisma.timeEntry.create({
      data: {
        userId: input.userId,
        clockedAt: new Date(input.clockedAt),
      },
    });
  }
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run:
```bash
pnpm --filter @ponto-dcit/api test -- time-entries.service.spec.ts
```
Expected: PASS.

- [ ] **Step 10: Write the failing test — `apps/api/src/time-entries/time-entries.controller.spec.ts`**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { TimeEntriesController } from "./time-entries.controller";
import { TimeEntriesService } from "./time-entries.service";

describe("TimeEntriesController", () => {
  let controller: TimeEntriesController;
  const serviceMock = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeEntriesController],
      providers: [{ provide: TimeEntriesService, useValue: serviceMock }],
    }).compile();

    controller = module.get(TimeEntriesController);
  });

  it("delegates a valid payload to the service", async () => {
    serviceMock.create.mockResolvedValue({ id: "1", userId: "user-123", clockedAt: new Date(), createdAt: new Date() });

    await controller.create({ userId: "user-123", clockedAt: "2026-08-19T13:00:00.000Z" });

    expect(serviceMock.create).toHaveBeenCalledWith({
      userId: "user-123",
      clockedAt: "2026-08-19T13:00:00.000Z",
    });
  });

  it("rejects an invalid payload before calling the service", async () => {
    await expect(controller.create({ userId: "", clockedAt: "not-a-date" } as never)).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run:
```bash
pnpm --filter @ponto-dcit/api test -- time-entries.controller.spec.ts
```
Expected: FAIL — `Cannot find module './time-entries.controller'`.

- [ ] **Step 12: Write `apps/api/src/time-entries/time-entries.controller.ts`**

```typescript
import { BadRequestException, Body, Controller, HttpCode, Post } from "@nestjs/common";
import { TimeEntryInput, TimeEntryInputSchema } from "@ponto-dcit/shared-types";
import { TimeEntriesService } from "./time-entries.service";

@Controller("time-entries")
export class TimeEntriesController {
  constructor(private readonly timeEntries: TimeEntriesService) {}

  @Post()
  @HttpCode(201)
  create(@Body() body: unknown) {
    const result = TimeEntryInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.timeEntries.create(result.data as TimeEntryInput);
  }
}
```

- [ ] **Step 13: Run the test to verify it passes**

Run:
```bash
pnpm --filter @ponto-dcit/api test -- time-entries.controller.spec.ts
```
Expected: PASS.

- [ ] **Step 14: Write `apps/api/src/time-entries/time-entries.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { TimeEntriesController } from "./time-entries.controller";
import { TimeEntriesService } from "./time-entries.service";
import { PrismaService } from "./prisma.service";

@Module({
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService, PrismaService],
})
export class TimeEntriesModule {}
```

- [ ] **Step 15: Register `TimeEntriesModule` in `apps/api/src/app.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { TimeEntriesModule } from "./time-entries/time-entries.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [TimeEntriesModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 16: Run the full backend test suite**

Run:
```bash
pnpm --filter @ponto-dcit/api test
```
Expected: PASS — all specs green.

- [ ] **Step 17: Manually verify the endpoint end to end**

Run:
```bash
pnpm --filter @ponto-dcit/api start &
sleep 3
curl -X POST http://localhost:3000/time-entries \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","clockedAt":"2026-08-19T13:00:00.000Z"}'
kill %1
```
Expected: `201` response with a JSON body containing a generated `id`.

- [ ] **Step 18: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add time-entries module with Prisma/SQLite persistence"
```

---

### Task 5: `apps/web` — Next.js skeleton

**Files:**
- Create: `apps/web/` (generated by `create-next-app`)
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/playwright.config.ts`
- Test: `apps/web/e2e/home.spec.ts`

**Interfaces:**
- Consumes: nothing yet (no API calls in this task — the web app's RH/gestor screens are future plans).
- Produces: a running Next.js app on port 3001 rendering "Ponto DCIT" on `/`.

- [ ] **Step 1: Generate the Next.js app into `apps/web`**

Run from the repo root:
```bash
pnpm dlx create-next-app@latest apps/web \
  --ts --app --eslint --src-dir --import-alias "@/*" \
  --no-tailwind --use-pnpm --skip-install
```
Expected: `apps/web` created with the App Router structure.

- [ ] **Step 2: Rename the generated package and set its dev port**

Edit `apps/web/package.json`: set `"name"` to `"@ponto-dcit/web"`, and change the `"dev"` script to `"next dev -p 3001"` (keeps it from colliding with `apps/api` on 3000 when both run via `pnpm dev`).

- [ ] **Step 3: Edit `apps/web/src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main>
      <h1>Ponto DCIT</h1>
    </main>
  );
}
```

- [ ] **Step 4: Add Playwright**

Run:
```bash
pnpm --filter @ponto-dcit/web add -D @playwright/test
pnpm --filter @ponto-dcit/web exec playwright install --with-deps chromium
```

- [ ] **Step 5: Write `apps/web/playwright.config.ts`**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:3001",
  },
});
```

- [ ] **Step 6: Write the failing test — `apps/web/e2e/home.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test("home page renders the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ponto DCIT" })).toBeVisible();
});
```

- [ ] **Step 7: Run the test to verify it passes**

Run:
```bash
pnpm install
pnpm --filter @ponto-dcit/web exec playwright test
```
Expected: PASS — 1 test green. (Playwright starts the dev server itself per `webServer` config, so this also proves Step 3's edit renders correctly.)

- [ ] **Step 8: Add a `test` script so Turborepo can run it**

Edit `apps/web/package.json`, add to `"scripts"`: `"test": "playwright test"`.

- [ ] **Step 9: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold Next.js app with home page e2e test"
```

---

### Task 6: `apps/mobile` — Expo skeleton with a "Bater Ponto" screen

**Files:**
- Create: `apps/mobile/` (generated by `create-expo-app`)
- Modify: `apps/mobile/app/index.tsx`
- Test: `apps/mobile/app/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: `TimeEntryInput` from `@ponto-dcit/shared-types` (Task 2); calls `POST http://localhost:3000/time-entries` (Task 4) via `fetch`.
- Produces: a screen with a single "Bater Ponto" button. Tapping it calls the API with the current timestamp and the (hardcoded, since auth doesn't exist yet) `userId: "demo-user"`, then shows a confirmation or error message. This is the seam a future offline-queue plan will intercept — the button's `onPress` handler is the one place that call happens.

- [ ] **Step 1: Generate the Expo app into `apps/mobile`**

Run from the repo root:
```bash
pnpm dlx create-expo-app@latest apps/mobile --template default
```
Expected: `apps/mobile` created with an `expo-router` app structure (`app/index.tsx`, `app.json`, etc.).

- [ ] **Step 2: Rename the generated package**

Edit `apps/mobile/package.json`: set `"name"` to `"@ponto-dcit/mobile"`.

- [ ] **Step 3: Add the shared-types dependency and testing tools**

Run:
```bash
pnpm --filter @ponto-dcit/mobile add @ponto-dcit/shared-types@workspace:*
pnpm --filter @ponto-dcit/mobile add -D @testing-library/react-native
```
(Expo's default template already ships `jest-expo` and a `test` script — confirm `apps/mobile/package.json` has `"test": "jest"` and a `jest` config with `preset: "jest-expo"`; if either is missing, add them.)

- [ ] **Step 4: Write the failing test — `apps/mobile/app/__tests__/index.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "../index";

global.fetch = jest.fn();

describe("HomeScreen", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it("shows a confirmation after tapping Bater Ponto", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen.getByText(/Ponto registrado/i)).toBeTruthy();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/time-entries",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows an error message when the request fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen.getByText(/Falha ao registrar/i)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run:
```bash
pnpm install
pnpm --filter @ponto-dcit/mobile test
```
Expected: FAIL — the rendered screen doesn't contain a "Bater Ponto" button yet (default template content).

- [ ] **Step 6: Write `apps/mobile/app/index.tsx`**

```tsx
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import type { TimeEntryInput } from "@ponto-dcit/shared-types";

const API_URL = "http://localhost:3000/time-entries";

export default function HomeScreen() {
  const [message, setMessage] = useState<string | null>(null);

  async function handlePress() {
    const payload: TimeEntryInput = {
      userId: "demo-user",
      clockedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(response.ok ? "Ponto registrado" : "Falha ao registrar ponto");
    } catch {
      setMessage("Falha ao registrar ponto");
    }
  }

  return (
    <View style={styles.container}>
      <Button title="Bater Ponto" onPress={handlePress} />
      {message ? <Text>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

- [ ] **Step 7: Run the test to verify it passes**

Run:
```bash
pnpm --filter @ponto-dcit/mobile test
```
Expected: PASS — both tests green.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo app with Bater Ponto screen"
```

---

### Task 7: CI pipeline + Postgres docker-compose (for later)

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `infra/docker/docker-compose.yml`

**Interfaces:**
- Consumes: the `build`/`test`/`lint` scripts every prior task's app defines.
- Produces: a GitHub Actions workflow that runs on every push/PR; a docker-compose file ready to use once Docker Desktop is installed (see "Out of scope").

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Enable corepack
        run: corepack enable

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo run lint

      - name: Build
        run: pnpm turbo run build

      - name: Test
        run: pnpm turbo run test
```

- [ ] **Step 2: Write `infra/docker/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ponto_dcit
      POSTGRES_PASSWORD: ponto_dcit
      POSTGRES_DB: ponto_dcit
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 3: Add root-level `lint` scripts to each app so `pnpm turbo run lint` (used by CI) has something to run**

Confirm `apps/api/package.json`, `apps/web/package.json`, and `apps/mobile/package.json` each already have a `"lint"` script (the Nest, Next, and Expo CLIs generate one by default with ESLint). If any is missing, add `"lint": "eslint ."` to that app's `package.json`.

- [ ] **Step 4: Run the same commands CI will run, locally, to confirm they succeed**

Run:
```bash
pnpm turbo run lint
pnpm turbo run build
pnpm turbo run test
```
Expected: all three succeed across every workspace package (Turborepo prints a per-package summary).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml infra/docker/docker-compose.yml
git commit -m "chore: add CI pipeline and Postgres docker-compose for later use"
```

- [ ] **Step 6: Push and confirm the workflow runs**

Run:
```bash
git remote -v
```
If a `origin` remote pointing at GitHub is already configured, push the branch and open the repo's Actions tab to confirm the workflow runs green. If no remote exists yet, this step is deferred until the user creates the GitHub repository and adds it as `origin` — note that explicitly rather than guessing a remote URL.

---

## Self-Review Notes

- **Spec coverage**: every architecture-spec item scoped to the MVP scaffold (monorepo layout, pnpm/Turborepo, NestJS modular backend, shared-types as single contract source, Next.js web, Expo mobile, Jest/Playwright, GitHub Actions CI, docker-compose for Postgres) has a task. Items explicitly deferred (offline signed timestamps, SSO/auth, geolocation, RBAC-aware web routing, and all non-MVP domain modules) are listed under "Out of scope" rather than half-implemented.
- **No placeholders**: every step has runnable commands or complete file contents; no "add appropriate tests" or "similar to Task N" steps.
- **Type consistency**: `TimeEntryInput`/`TimeEntryInputSchema` (Task 2) are the exact names imported in Task 4 (`time-entries.controller.ts`, `time-entries.service.ts`) and Task 6 (`index.tsx`). `TimeEntriesService.create` signature (`(input: TimeEntryInput) => Promise<TimeEntry>`) matches how the controller calls it in Task 4 Step 12.
