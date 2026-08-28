# Mapa de Presença (Painel do Gestor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the gestor/RH home page's "Presente/Não presente/Sem registro" list into a live-updating presence panel with seven statuses (Trabalhando, Em pausa, Atrasado, De folga, Férias, Atestado, Não presente), backed by a new per-employee expected-start-time field.

**Architecture:** `Employee` gains a nullable `expectedStartTime` ("HH:mm") column, edited via a new RH-only `/colaboradores` page. `TimeEntriesService.listTeamToday()` derives a `status` per employee by combining today's `TimeEntry` rows with approved `VacationRequest`/`Atestado` records and the new field, using a priority order (weekend → férias → atestado → 4+ punches → odd punches → 2 punches → late/no-record). "What day/time it is" for weekend and lateness checks uses América/São_Paulo explicitly (via a new small helper), not the server's ambient timezone — mirroring the fix already applied to `/escala`. The home page becomes a thin Server Component that seeds a Client Component, which polls a new same-origin Next.js Route Handler (`/api/team-presence`, a thin proxy to the NestJS API — needed because the JWT lives in an httpOnly cookie only the Next.js server can read) every 60s, keeping the last known-good data on any polling failure.

**Tech Stack:** NestJS + Prisma (SQLite) for the API, Next.js App Router (Server Components, a Client Component, a Route Handler) for web — no new dependencies.

**Spec:** [`docs/superpowers/specs/2026-08-28-mapa-de-presenca-design.md`](../specs/2026-08-28-mapa-de-presenca-design.md)

## Global Constraints

- `Employee.expectedStartTime: String?` — `"HH:mm"`, 24h, nullable. `null` means the employee never shows as `atrasado`.
- `EmployeeScheduleUpdateSchema` (shared-types): `{ expectedStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable() }`.
- `PATCH /employees/:userId` is `@Roles('rh')` only (not `gestor`) — this is cadastral data.
- Status priority order (first match wins): weekend (São Paulo) → `folga`; approved férias covering today → `ferias`; approved atestado covering today → `atestado`; 4+ punches today → `nao_presente`; odd punch count (1 or 3) → `trabalhando`; exactly 2 punches → `pausa`; 0 punches and `now > expectedStartTime + 10min` (São Paulo) → `atrasado`; otherwise → `sem_registro`.
- Atestado period: `periodStart` = `createdAt` truncated to the day, `periodEnd` = `periodStart + dias` (calendar days) — the first day back at work, not the last day out.
- "What day/time is it" for weekend and lateness decisions uses América/São_Paulo (`Intl.DateTimeFormat` with `timeZone: "America/Sao_Paulo"`), not the server's ambient timezone — same reasoning already applied in `apps/web/src/app/(app)/escala/page.tsx`'s `todaySaoPauloDateOnly`. The existing UTC-based "which `TimeEntry` rows count as today" window in `listTeamToday` is unchanged (out of scope to fix here).
- Single-quote style in `apps/api` (Prettier default there); double-quote style in `apps/web` (its Prettier config) — match whichever file you're editing.
- No mobile changes. No changes to the four preventive alerts (separate future spec).

---

## File Structure

```
packages/
  shared-types/
    src/
      employee-schedule.ts                          # new — EmployeeScheduleUpdateSchema
      employee-schedule.test.ts                      # new
      index.ts                                        # modified — export new schema/type
apps/
  api/
    prisma/
      schema.prisma                                   # modified — Employee.expectedStartTime
      migrations/<generated>_add_employee_expected_start_time/  # generated
    src/
      common/
        sao-paulo-time.ts                              # new — SP timezone helpers
        sao-paulo-time.spec.ts                         # new
      employees/
        employees.service.ts                            # modified — list() + updateSchedule()
        employees.service.spec.ts                        # modified
        employees.controller.ts                          # modified — PATCH :userId
        employees.controller.spec.ts                      # modified
      time-entries/
        time-entries.service.ts                          # modified — status derivation
        time-entries.service.spec.ts                      # modified
  web/
    src/
      components/
        nav-links.tsx                                    # modified — add "Colaboradores" link
      app/
        globals.css                                       # modified — 5 new status color tokens
        api/
          team-presence/
            route.ts                                       # new — Route Handler proxy
        (app)/
          page.tsx                                          # modified — thin Server Component
          presence-panel.tsx                                # new — Client Component, polling
          ponto.module.css                                  # modified — new status classes
          colaboradores/
            page.tsx                                          # new
            actions.ts                                        # new
            colaboradores-row.tsx                             # new
            colaboradores.module.css                          # new
    e2e/
      fake-api-server.mjs                                 # modified — generalized seeding + PATCH /employees/:userId
      test-session.ts                                      # modified — seedResponse() helper
      home.spec.ts                                         # modified — new statuses + polling
      colaboradores.spec.ts                                # new
      app-shell.spec.ts                                    # modified — assert "Colaboradores" link visible
```

---

### Task 1: `packages/shared-types` — `EmployeeScheduleUpdateSchema`

**Files:**
- Create: `packages/shared-types/src/employee-schedule.ts`
- Test: `packages/shared-types/src/employee-schedule.test.ts`
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `EmployeeScheduleUpdateSchema` (Zod schema) and `EmployeeScheduleUpdate` (inferred type: `{ expectedStartTime: string | null }`), exported from `@ponto-dcit/shared-types`. Task 4 imports it for `PATCH /employees/:userId`.

- [ ] **Step 1: Write the failing test — `packages/shared-types/src/employee-schedule.test.ts`**

```typescript
import { EmployeeScheduleUpdateSchema } from "./employee-schedule";

describe("EmployeeScheduleUpdateSchema", () => {
  it("accepts a valid HH:mm time", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "09:00" });
    expect(result.success).toBe(true);
  });

  it("accepts null (clearing the schedule)", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: null });
    expect(result.success).toBe(true);
  });

  it("rejects a single-digit hour", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "9:00" });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range hour", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "24:00" });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range minute", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "09:60" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/shared-types test -- employee-schedule.test.ts`
Expected: FAIL — `Cannot find module './employee-schedule'`.

- [ ] **Step 3: Write `packages/shared-types/src/employee-schedule.ts`**

```typescript
import { z } from "zod";

export const EmployeeScheduleUpdateSchema = z.object({
  expectedStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable(),
});
export type EmployeeScheduleUpdate = z.infer<typeof EmployeeScheduleUpdateSchema>;
```

- [ ] **Step 4: Update `packages/shared-types/src/index.ts`**

Add these two lines (keep everything else in the file as-is):

```typescript
export { EmployeeScheduleUpdateSchema } from "./employee-schedule";
export type { EmployeeScheduleUpdate } from "./employee-schedule";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/shared-types test -- employee-schedule.test.ts`
Expected: PASS — 6 tests green.

- [ ] **Step 6: Build the package**

Run: `pnpm --filter @ponto-dcit/shared-types run build`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types
git commit -m "feat(shared-types): add EmployeeScheduleUpdateSchema"
```

---

### Task 2: `apps/api` — `Employee.expectedStartTime` Prisma field

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Generated: `apps/api/prisma/migrations/<timestamp>_add_employee_expected_start_time/`

**Interfaces:**
- Consumes: nothing.
- Produces: `expectedStartTime` on `prisma.employee` rows, used by Task 4 and Task 5.

- [ ] **Step 1: Add the field to `apps/api/prisma/schema.prisma`**

Find the `Employee` model:

```prisma
model Employee {
  userId   String   @id
  name     String
  role     String
  hireDate DateTime
}
```

Replace it with:

```prisma
model Employee {
  userId            String   @id
  name              String
  role              String
  hireDate          DateTime
  expectedStartTime String?  // "HH:mm", 24h, América/São_Paulo. null = never "atrasado".
}
```

- [ ] **Step 2: Generate and apply the migration against the dev database**

Run: `pnpm --filter @ponto-dcit/api exec prisma migrate dev --name add_employee_expected_start_time`
Expected: creates `apps/api/prisma/migrations/<timestamp>_add_employee_expected_start_time/migration.sql`, applies it to `apps/api/prisma/dev.db`, regenerates the Prisma Client (so `expectedStartTime` is available in TypeScript on `Employee`).

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): add expectedStartTime to Employee"
```

---

### Task 3: `apps/api` — América/São_Paulo time helpers

**Files:**
- Create: `apps/api/src/common/sao-paulo-time.ts`
- Test: `apps/api/src/common/sao-paulo-time.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `todaySaoPauloDateOnly(): string`, `dateOnlyInSaoPaulo(date: Date): string`, `nowSaoPauloTimeOnly(): string`, `dayOfWeekFromDateOnly(dateOnly: string): number`, `isWeekend(dateOnly: string): boolean`, `minutesSinceMidnight(hhmm: string): number` — all consumed by Task 5's `TimeEntriesService.listTeamToday`.

- [ ] **Step 1: Write the failing test — `apps/api/src/common/sao-paulo-time.spec.ts`**

```typescript
import {
  dateOnlyInSaoPaulo,
  dayOfWeekFromDateOnly,
  isWeekend,
  minutesSinceMidnight,
  nowSaoPauloTimeOnly,
  todaySaoPauloDateOnly,
} from './sao-paulo-time';

describe('sao-paulo-time', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('todaySaoPauloDateOnly / dateOnlyInSaoPaulo', () => {
    it('stays on the previous calendar day when UTC has already rolled over but São Paulo has not', () => {
      // 2026-08-29T00:30:00.000Z is 2026-08-28T21:30:00 in São Paulo (UTC-3).
      jest.useFakeTimers().setSystemTime(new Date('2026-08-29T00:30:00.000Z'));
      expect(todaySaoPauloDateOnly()).toBe('2026-08-28');
    });

    it('matches the UTC date well within the day', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-28T15:00:00.000Z'));
      expect(todaySaoPauloDateOnly()).toBe('2026-08-28');
    });

    it('dateOnlyInSaoPaulo converts an arbitrary given date, not just "now"', () => {
      expect(dateOnlyInSaoPaulo(new Date('2026-09-01T01:00:00.000Z'))).toBe('2026-08-31');
    });
  });

  describe('nowSaoPauloTimeOnly', () => {
    it('returns the wall-clock HH:mm in São Paulo, 3 hours behind UTC', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-28T12:15:00.000Z'));
      expect(nowSaoPauloTimeOnly()).toBe('09:15');
    });
  });

  describe('dayOfWeekFromDateOnly / isWeekend', () => {
    it('identifies a Saturday as day 6 and a weekend', () => {
      expect(dayOfWeekFromDateOnly('2026-08-29')).toBe(6);
      expect(isWeekend('2026-08-29')).toBe(true);
    });

    it('identifies a Sunday as day 0 and a weekend', () => {
      expect(dayOfWeekFromDateOnly('2026-08-30')).toBe(0);
      expect(isWeekend('2026-08-30')).toBe(true);
    });

    it('identifies a Thursday as not a weekend', () => {
      expect(dayOfWeekFromDateOnly('2026-08-27')).toBe(4);
      expect(isWeekend('2026-08-27')).toBe(false);
    });
  });

  describe('minutesSinceMidnight', () => {
    it('converts HH:mm to minutes since midnight', () => {
      expect(minutesSinceMidnight('09:00')).toBe(540);
      expect(minutesSinceMidnight('00:00')).toBe(0);
      expect(minutesSinceMidnight('23:59')).toBe(1439);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/api test -- sao-paulo-time.spec.ts`
Expected: FAIL — `Cannot find module './sao-paulo-time'`.

- [ ] **Step 3: Write `apps/api/src/common/sao-paulo-time.ts`**

```typescript
// "What day/time is it right now" for business-facing decisions (weekend
// detection, lateness) must follow the company's actual timezone, not the
// server's ambient one (often UTC in production) — same reasoning as
// apps/web/src/app/(app)/escala/page.tsx's todaySaoPauloDateOnly, which this
// mirrors for the API side (a different runtime, so not directly
// importable from there). Storage/comparison of already-known date-only
// values (VacationRequest.startDate, etc.) stays UTC-midnight throughout,
// unaffected by this — only "what is today/now" is timezone-aware here.

export function dateOnlyInSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function todaySaoPauloDateOnly(): string {
  return dateOnlyInSaoPaulo(new Date());
}

export function nowSaoPauloTimeOnly(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('hour')}:${get('minute')}`;
}

// 0=Sunday..6=Saturday, matching Date.prototype.getUTCDay's convention.
// dateOnly is a plain "YYYY-MM-DD" (already resolved to São Paulo by the
// caller), so parsing it as UTC midnight is unambiguous here.
export function dayOfWeekFromDateOnly(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00.000Z`).getUTCDay();
}

export function isWeekend(dateOnly: string): boolean {
  const day = dayOfWeekFromDateOnly(dateOnly);
  return day === 0 || day === 6;
}

// Minutes since midnight, for comparing two "HH:mm" wall-clock values.
export function minutesSinceMidnight(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/api test -- sao-paulo-time.spec.ts`
Expected: PASS — 9 tests green.

- [ ] **Step 5: Lint**

Run: `pnpm --filter @ponto-dcit/api exec eslint "src/common/**/*.ts" --fix`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common
git commit -m "feat(api): add América/São_Paulo time helpers"
```

---

### Task 4: `apps/api` — `employees` module: schedule field + `PATCH`

**Files:**
- Modify: `apps/api/src/employees/employees.service.ts`
- Modify: `apps/api/src/employees/employees.service.spec.ts`
- Modify: `apps/api/src/employees/employees.controller.ts`
- Modify: `apps/api/src/employees/employees.controller.spec.ts`

**Interfaces:**
- Consumes: `EmployeeScheduleUpdateSchema`/`EmployeeScheduleUpdate` from `@ponto-dcit/shared-types` (Task 1); `expectedStartTime` on `prisma.employee` (Task 2).
- Produces: `EmployeesService.list()` now includes `expectedStartTime`; `EmployeesService.updateSchedule(userId, input)`; `PATCH /employees/:userId` (`@Roles('rh')`). Task 5 reads `expectedStartTime` from `list()`'s underlying data. Task 6 (web) calls `PATCH /employees/:userId` over HTTP.

- [ ] **Step 1: Write the failing tests — append to `apps/api/src/employees/employees.service.spec.ts`**

Read the current file first. Change the `afterAll` from:

```typescript
  afterAll(async () => {
    await prisma.employee.deleteMany({
      where: { userId: { in: ['emp-b', 'emp-a'] } },
    });
    await prisma.onModuleDestroy();
  });
```

to:

```typescript
  afterAll(async () => {
    await prisma.employee.deleteMany({
      where: { userId: { in: ['emp-b', 'emp-a', 'emp-schedule'] } },
    });
    await prisma.onModuleDestroy();
  });
```

Then add this `describe` block at the end of the file, inside the outer `describe('EmployeesService', ...)` (immediately before its closing `});`):

```typescript
  describe('updateSchedule', () => {
    it('sets expectedStartTime and returns the updated employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-schedule',
          name: 'Duda Horário',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      const updated = await service.updateSchedule('emp-schedule', {
        expectedStartTime: '09:00',
      });

      expect(updated.expectedStartTime).toBe('09:00');
      const found = await prisma.employee.findUnique({ where: { userId: 'emp-schedule' } });
      expect(found?.expectedStartTime).toBe('09:00');
    });

    it('clears expectedStartTime when given null', async () => {
      await service.updateSchedule('emp-schedule', { expectedStartTime: null });

      const found = await prisma.employee.findUnique({ where: { userId: 'emp-schedule' } });
      expect(found?.expectedStartTime).toBeNull();
    });
  });

  it('list() includes expectedStartTime for each employee', async () => {
    await prisma.employee.update({
      where: { userId: 'emp-a' },
      data: { expectedStartTime: '08:00' },
    });

    const results = await service.list();

    expect(results.find((e) => e.userId === 'emp-a')?.expectedStartTime).toBe('08:00');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ponto-dcit/api test -- employees.service.spec.ts`
Expected: FAIL — `service.updateSchedule is not a function`, and the `list()` test fails because `expectedStartTime` isn't selected yet.

- [ ] **Step 3: Implement in `apps/api/src/employees/employees.service.ts`**

Replace the whole file with:

```typescript
import { Injectable } from '@nestjs/common';
import { EmployeeScheduleUpdate } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
      select: { userId: true, name: true, expectedStartTime: true },
    });
  }

  updateSchedule(userId: string, input: EmployeeScheduleUpdate) {
    return this.prisma.employee.update({
      where: { userId },
      data: { expectedStartTime: input.expectedStartTime },
    });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ponto-dcit/api test -- employees.service.spec.ts`
Expected: PASS — all tests green, including the pre-existing `'lists employees sorted by name'` test (unaffected — it only checks `name`).

- [ ] **Step 5: Write the failing tests — append to `apps/api/src/employees/employees.controller.spec.ts`**

Read the current file first. Add this test inside `describe('EmployeesController guard metadata', ...)`, immediately after the existing `list` guard test and before that block's closing `});`:

```typescript
  it('applies AuthGuard and RolesGuard to updateSchedule, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updateSchedule,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updateSchedule,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });
```

In the behavioral `describe('EmployeesController', ...)` block, change `serviceMock` from:

```typescript
  const serviceMock = { list: jest.fn() };
```

to:

```typescript
  const serviceMock = { list: jest.fn(), updateSchedule: jest.fn() };
```

Then add these tests inside that same `describe` block, after the existing `'returns the employee roster'` test:

```typescript
  it('updates the schedule with a valid payload', async () => {
    serviceMock.updateSchedule.mockResolvedValue({ userId: 'user-1', expectedStartTime: '09:00' });

    await controller.updateSchedule('user-1', { expectedStartTime: '09:00' });

    expect(serviceMock.updateSchedule).toHaveBeenCalledWith('user-1', {
      expectedStartTime: '09:00',
    });
  });

  it('accepts null to clear the schedule', async () => {
    serviceMock.updateSchedule.mockResolvedValue({ userId: 'user-1', expectedStartTime: null });

    await controller.updateSchedule('user-1', { expectedStartTime: null });

    expect(serviceMock.updateSchedule).toHaveBeenCalledWith('user-1', {
      expectedStartTime: null,
    });
  });

  it('rejects a malformed time before calling the service', async () => {
    await expect(
      controller.updateSchedule('user-1', { expectedStartTime: '9am' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updateSchedule).not.toHaveBeenCalled();
  });
```

Add this import to the top of the file:

```typescript
import { BadRequestException } from '@nestjs/common';
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm --filter @ponto-dcit/api test -- employees.controller.spec.ts`
Expected: FAIL — `controller.updateSchedule is not a function`.

- [ ] **Step 7: Implement in `apps/api/src/employees/employees.controller.ts`**

Replace the whole file with:

```typescript
import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { EmployeeScheduleUpdateSchema } from '@ponto-dcit/shared-types';
import { EmployeesService } from './employees.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get()
  list() {
    return this.employees.list();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Patch(':userId')
  async updateSchedule(@Param('userId') userId: string, @Body() body: unknown) {
    const result = EmployeeScheduleUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.updateSchedule(userId, result.data);
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @ponto-dcit/api test -- employees.controller.spec.ts`
Expected: PASS — all tests green, including the pre-existing `list` tests (unaffected).

- [ ] **Step 9: Run the full API test suite**

Run: `pnpm --filter @ponto-dcit/api run test`
Expected: PASS — every spec green.

- [ ] **Step 10: Lint**

Run: `pnpm --filter @ponto-dcit/api exec eslint "{src,test}/**/*.ts" --fix`
Expected: no new errors.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/employees
git commit -m "feat(api): add PATCH /employees/:userId for expected start time"
```

---

### Task 5: `apps/api` — presence status derivation in `TimeEntriesService.listTeamToday`

**Files:**
- Modify: `apps/api/src/time-entries/time-entries.service.ts`
- Modify: `apps/api/src/time-entries/time-entries.service.spec.ts`

**Interfaces:**
- Consumes: `todaySaoPauloDateOnly`, `nowSaoPauloTimeOnly`, `isWeekend`, `minutesSinceMidnight` from `../common/sao-paulo-time` (Task 3); `expectedStartTime` on `prisma.employee` (Task 2); `prisma.vacationRequest`, `prisma.atestado` (existing models).
- Produces: `listTeamToday()` now returns `{ userId, name, entries, workedMinutes, status, periodStart?, periodEnd? }[]` — `status` is one of `'trabalhando' | 'pausa' | 'atrasado' | 'folga' | 'sem_registro' | 'nao_presente' | 'ferias' | 'atestado'`; `isOpen` is removed. Task 8 (web) consumes this shape from `GET /time-entries/team` over HTTP. `TimeEntriesController` needs no change — it already just returns whatever the service returns.

- [ ] **Step 1: Write the failing tests — modify `apps/api/src/time-entries/time-entries.service.spec.ts`**

Read the current file first. Inside the existing `describe('listTeamToday', ...)` block, replace the existing `it("pairs today's punches per employee and reports who's currently clocked in", ...)` test's three assertions:

```typescript
      const open = results.find((r) => r.userId === 'team-open');
      expect(open?.name).toBe('Ana Aberta');
      expect(open?.isOpen).toBe(true);
      expect(open?.entries).toHaveLength(1);
      expect(open?.workedMinutes).toBe(0);

      const closed = results.find((r) => r.userId === 'team-closed');
      expect(closed?.isOpen).toBe(false);
      expect(closed?.entries).toHaveLength(2);
      expect(closed?.workedMinutes).toBe(240);

      const none = results.find((r) => r.userId === 'team-none');
      expect(none?.isOpen).toBe(false);
      expect(none?.entries).toEqual([]);
      expect(none?.workedMinutes).toBe(0);
```

with (this fixture's `'team-closed'` employee has exactly 2 punches today, which is now `'pausa'`, not a generic "closed"; `'team-none'` has 0 punches and no `expectedStartTime`, so it's `'sem_registro'`):

```typescript
      const open = results.find((r) => r.userId === 'team-open');
      expect(open?.name).toBe('Ana Aberta');
      expect(open?.status).toBe('trabalhando');
      expect(open?.entries).toHaveLength(1);
      expect(open?.workedMinutes).toBe(0);

      const closed = results.find((r) => r.userId === 'team-closed');
      expect(closed?.status).toBe('pausa');
      expect(closed?.entries).toHaveLength(2);
      expect(closed?.workedMinutes).toBe(240);

      const none = results.find((r) => r.userId === 'team-none');
      expect(none?.status).toBe('sem_registro');
      expect(none?.entries).toEqual([]);
      expect(none?.workedMinutes).toBe(0);
```

Change the file's `afterAll` from:

```typescript
  afterAll(async () => {
    await prisma.timeEntry.deleteMany();
    // Scoped to this file's own fixture ids, not a blanket deleteMany(): the
    // Employee table is shared with solicitacoes.service.spec.ts, which runs
    // as a separate Jest worker against the same test.db — a blanket delete
    // here raced with that suite's own Employee rows and made both suites
    // flaky.
    await prisma.employee.deleteMany({
      where: { userId: { in: ['team-open', 'team-closed', 'team-none'] } },
    });
    await prisma.onModuleDestroy();
  });
```

to:

```typescript
  afterAll(async () => {
    await prisma.timeEntry.deleteMany();
    // Scoped to this file's own fixture ids, not a blanket deleteMany(): the
    // Employee table is shared with solicitacoes.service.spec.ts, which runs
    // as a separate Jest worker against the same test.db — a blanket delete
    // here raced with that suite's own Employee rows and made both suites
    // flaky.
    await prisma.employee.deleteMany({
      where: {
        userId: {
          in: [
            'team-open',
            'team-closed',
            'team-none',
            'presence-folga-sat',
            'presence-folga-sun',
            'presence-ferias',
            'presence-ferias-pendente',
            'presence-atestado-today',
            'presence-atestado-lastday',
            'presence-atestado-nextday',
            'presence-4-entries',
            'presence-odd-1',
            'presence-odd-3',
            'presence-2-entries',
            'presence-atrasado',
            'presence-tolerancia',
            'presence-sem-horario',
          ],
        },
      },
    });
    await prisma.vacationRequest.deleteMany({
      where: { userId: { in: ['presence-ferias', 'presence-ferias-pendente'] } },
    });
    await prisma.atestado.deleteMany({
      where: {
        userId: {
          in: ['presence-atestado-today', 'presence-atestado-lastday', 'presence-atestado-nextday'],
        },
      },
    });
    await prisma.onModuleDestroy();
  });
```

Then add this new `describe` block at the end of the file, inside the outer `describe('TimeEntriesService', ...)` (immediately before its closing `});`, i.e. right after the `describe('listTeamToday', ...)` block closes):

```typescript
  describe('listTeamToday status derivation', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    // Baseline: Thursday 2026-08-27, 15:00 UTC = 12:00 in São Paulo (UTC-3).
    // Not a weekend, well past a typical 09:00 start.
    const WEEKDAY_NOON_SP = new Date('2026-08-27T15:00:00.000Z');

    function baseEmployee(userId: string, expectedStartTime: string | null = null) {
      return {
        userId,
        name: userId,
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
        expectedStartTime,
      };
    }

    it('is "folga" on a Saturday, even if expectedStartTime would otherwise make it "atrasado"', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-29T15:00:00.000Z')); // Saturday, 12:00 SP
      await prisma.employee.create({
        data: baseEmployee('presence-folga-sat', '09:00'),
      });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-folga-sat')?.status).toBe('folga');
    });

    it('is "folga" on a Sunday', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-30T15:00:00.000Z')); // Sunday, 12:00 SP
      await prisma.employee.create({ data: baseEmployee('presence-folga-sun') });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-folga-sun')?.status).toBe('folga');
    });

    it('is "ferias" with the period when an approved vacation covers today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-ferias') });
      await prisma.vacationRequest.create({
        data: {
          userId: 'presence-ferias',
          startDate: new Date('2026-08-25T00:00:00.000Z'),
          endDate: new Date('2026-08-29T00:00:00.000Z'),
          days: 5,
          status: 'aprovado',
        },
      });

      const results = await service.listTeamToday();

      const found = results.find((r) => r.userId === 'presence-ferias');
      expect(found?.status).toBe('ferias');
      expect(found?.periodStart?.toISOString()).toBe('2026-08-25T00:00:00.000Z');
      expect(found?.periodEnd?.toISOString()).toBe('2026-08-29T00:00:00.000Z');
    });

    it('does not count a pending (not yet approved) vacation as "ferias"', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-ferias-pendente') });
      await prisma.vacationRequest.create({
        data: {
          userId: 'presence-ferias-pendente',
          startDate: new Date('2026-08-25T00:00:00.000Z'),
          endDate: new Date('2026-08-29T00:00:00.000Z'),
          days: 5,
          status: 'pendente',
        },
      });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-ferias-pendente')?.status).toBe(
        'sem_registro',
      );
    });

    it('is "atestado" when submitted earlier today — same-day submission still covers today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-atestado-today') });
      await prisma.atestado.create({
        data: {
          userId: 'presence-atestado-today',
          userName: 'presence-atestado-today',
          dias: 2,
          status: 'aprovado',
          createdAt: WEEKDAY_NOON_SP, // submitted at noon today, not midnight
        },
      });

      const results = await service.listTeamToday();

      const found = results.find((r) => r.userId === 'presence-atestado-today');
      expect(found?.status).toBe('atestado');
      expect(found?.periodStart?.toISOString()).toBe('2026-08-27T00:00:00.000Z');
      expect(found?.periodEnd?.toISOString()).toBe('2026-08-29T00:00:00.000Z');
    });

    it('is still "atestado" on the last day of the period (início + dias - 1)', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP); // today = 2026-08-27
      await prisma.employee.create({ data: baseEmployee('presence-atestado-lastday') });
      await prisma.atestado.create({
        data: {
          userId: 'presence-atestado-lastday',
          userName: 'presence-atestado-lastday',
          dias: 2,
          status: 'aprovado',
          createdAt: new Date('2026-08-26T09:00:00.000Z'), // início = ontem, cobre ontem e hoje
        },
      });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-atestado-lastday')?.status).toBe(
        'atestado',
      );
    });

    it('is no longer "atestado" the day after the period ends', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP); // today = 2026-08-27
      await prisma.employee.create({ data: baseEmployee('presence-atestado-nextday') });
      await prisma.atestado.create({
        data: {
          userId: 'presence-atestado-nextday',
          userName: 'presence-atestado-nextday',
          dias: 2,
          status: 'aprovado',
          createdAt: new Date('2026-08-25T09:00:00.000Z'), // início 2 dias atrás, retornou ontem
        },
      });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-atestado-nextday')?.status).toBe(
        'sem_registro',
      );
    });

    it('is "nao_presente" with 4 punches today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-4-entries') });
      for (const time of ['09:00', '12:00', '13:00', '18:00']) {
        await service.create({
          userId: 'presence-4-entries',
          clockedAt: `2026-08-27T${time}:00.000Z`,
        });
      }

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-4-entries')?.status).toBe('nao_presente');
    });

    it('is "trabalhando" with 1 punch today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-odd-1') });
      await service.create({ userId: 'presence-odd-1', clockedAt: '2026-08-27T09:00:00.000Z' });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-odd-1')?.status).toBe('trabalhando');
    });

    it('is "trabalhando" with 3 punches today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-odd-3') });
      for (const time of ['09:00', '12:00', '13:00']) {
        await service.create({
          userId: 'presence-odd-3',
          clockedAt: `2026-08-27T${time}:00.000Z`,
        });
      }

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-odd-3')?.status).toBe('trabalhando');
    });

    it('is "pausa" with exactly 2 punches today', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-2-entries') });
      for (const time of ['09:00', '12:00']) {
        await service.create({
          userId: 'presence-2-entries',
          clockedAt: `2026-08-27T${time}:00.000Z`,
        });
      }

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-2-entries')?.status).toBe('pausa');
    });

    it('is "atrasado" with 0 punches, an expectedStartTime, and more than 10min past it', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP); // 12:00 SP
      await prisma.employee.create({ data: baseEmployee('presence-atrasado', '09:00') });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-atrasado')?.status).toBe('atrasado');
    });

    it('is "sem_registro" (not yet "atrasado") within the 10min tolerance', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP); // 12:00 SP
      await prisma.employee.create({ data: baseEmployee('presence-tolerancia', '11:55') });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-tolerancia')?.status).toBe('sem_registro');
    });

    it('is "sem_registro", never "atrasado", when expectedStartTime is not set', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({ data: baseEmployee('presence-sem-horario') });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-sem-horario')?.status).toBe('sem_registro');
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ponto-dcit/api test -- time-entries.service.spec.ts`
Expected: FAIL — `results.find(...)` results are `undefined`/`status` is `undefined` (the service doesn't return `status` yet), and the amended baseline test fails on the now-missing `isOpen` field.

- [ ] **Step 3: Implement in `apps/api/src/time-entries/time-entries.service.ts`**

Replace the whole file with:

```typescript
import { Injectable } from '@nestjs/common';
import { TimeEntryInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import {
  isWeekend,
  minutesSinceMidnight,
  nowSaoPauloTimeOnly,
  todaySaoPauloDateOnly,
} from '../common/sao-paulo-time';

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

  listForUser(userId: string) {
    return this.prisma.timeEntry.findMany({
      where: { userId },
      orderBy: { clockedAt: 'asc' },
    });
  }

  // Same pairing rule as the mobile app's summarizeDay (ponto-context.tsx):
  // sequential punches alternate clock-in/clock-out. Which TimeEntry rows
  // count as "today" stays UTC-based (server clock), matching the rest of
  // this method's pre-existing behavior — only the *business* notion of
  // "today" used for the weekend/férias/atestado/atraso checks below is
  // São Paulo-aware (see ../common/sao-paulo-time).
  async listTeamToday() {
    const employees = await this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
    });
    const userIds = employees.map((employee) => employee.userId);

    const todayKey = new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(`${todayKey}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayKey}T23:59:59.999Z`);

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId: { in: userIds },
        clockedAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { clockedAt: 'asc' },
    });

    const todaySP = todaySaoPauloDateOnly();
    const todaySPMidnightUTC = new Date(`${todaySP}T00:00:00.000Z`);
    const weekend = isWeekend(todaySP);
    const nowSPMinutes = minutesSinceMidnight(nowSaoPauloTimeOnly());

    const vacations = await this.prisma.vacationRequest.findMany({
      where: {
        userId: { in: userIds },
        status: 'aprovado',
        startDate: { lte: todaySPMidnightUTC },
        endDate: { gte: todaySPMidnightUTC },
      },
    });
    const vacationByUserId = new Map(vacations.map((v) => [v.userId, v]));

    // Not filtered by createdAt in the query: createdAt carries a
    // time-of-day (submission moment), so a same-day submission after
    // midnight would wrongly fail a date-only `lte` comparison at the DB
    // level. The period-coverage check below (date-only, in memory) is the
    // real filter.
    const atestados = await this.prisma.atestado.findMany({
      where: { userId: { in: userIds }, status: 'aprovado', dias: { not: null } },
    });
    const atestadoByUserId = new Map<string, { periodStart: Date; periodEnd: Date }>();
    for (const atestado of atestados) {
      const periodStart = new Date(
        `${atestado.createdAt.toISOString().slice(0, 10)}T00:00:00.000Z`,
      );
      const periodEnd = new Date(periodStart);
      periodEnd.setUTCDate(periodEnd.getUTCDate() + (atestado.dias ?? 0));
      // periodStart is always <= today (createdAt can't be in the future),
      // so the only real bound to check is the upper one.
      if (todaySPMidnightUTC < periodEnd) {
        atestadoByUserId.set(atestado.userId, { periodStart, periodEnd });
      }
    }

    return employees.map((employee) => {
      const dayEntries = entries.filter((entry) => entry.userId === employee.userId);

      let workedMinutes = 0;
      for (let i = 0; i + 1 < dayEntries.length; i += 2) {
        workedMinutes +=
          (dayEntries[i + 1].clockedAt.getTime() - dayEntries[i].clockedAt.getTime()) / 60000;
      }

      const base = {
        userId: employee.userId,
        name: employee.name,
        entries: dayEntries.map((entry) => ({ id: entry.id, clockedAt: entry.clockedAt })),
        workedMinutes: Math.round(workedMinutes),
      };

      if (weekend) {
        return { ...base, status: 'folga' as const };
      }

      const vacation = vacationByUserId.get(employee.userId);
      if (vacation) {
        return {
          ...base,
          status: 'ferias' as const,
          periodStart: vacation.startDate,
          periodEnd: vacation.endDate,
        };
      }

      const atestado = atestadoByUserId.get(employee.userId);
      if (atestado) {
        return {
          ...base,
          status: 'atestado' as const,
          periodStart: atestado.periodStart,
          periodEnd: atestado.periodEnd,
        };
      }

      if (dayEntries.length >= 4) {
        return { ...base, status: 'nao_presente' as const };
      }
      if (dayEntries.length % 2 === 1) {
        return { ...base, status: 'trabalhando' as const };
      }
      if (dayEntries.length === 2) {
        return { ...base, status: 'pausa' as const };
      }

      if (
        employee.expectedStartTime &&
        nowSPMinutes > minutesSinceMidnight(employee.expectedStartTime) + 10
      ) {
        return { ...base, status: 'atrasado' as const };
      }
      return { ...base, status: 'sem_registro' as const };
    });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ponto-dcit/api test -- time-entries.service.spec.ts`
Expected: PASS — all tests green, including the amended baseline test and all 15 new status-derivation tests.

- [ ] **Step 5: Run the full API test suite**

Run: `pnpm --filter @ponto-dcit/api run test`
Expected: PASS — every spec green. `time-entries.controller.spec.ts` needs no change (it mocks the service and never asserts on the exact shape of its return value beyond `toHaveLength(1)`).

- [ ] **Step 6: Lint**

Run: `pnpm --filter @ponto-dcit/api exec eslint "{src,test}/**/*.ts" --fix`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/time-entries
git commit -m "feat(api): derive presence status (trabalhando/pausa/atrasado/folga/ferias/atestado) in listTeamToday"
```

---

### Task 6: `apps/web` — `/colaboradores` page (RH cadastro)

**Files:**
- Modify: `apps/web/src/components/nav-links.tsx`
- Create: `apps/web/src/app/(app)/colaboradores/page.tsx`
- Create: `apps/web/src/app/(app)/colaboradores/actions.ts`
- Create: `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`
- Create: `apps/web/src/app/(app)/colaboradores/colaboradores.module.css`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Modify: `apps/web/e2e/test-session.ts`
- Modify: `apps/web/e2e/app-shell.spec.ts`
- Create: `apps/web/e2e/colaboradores.spec.ts`

**Interfaces:**
- Consumes: `apiFetch` from `@/lib/api`; `getSession` from `@/lib/session`; `EmptyState` from `@/components/empty-state`. Calls `GET /employees`, `PATCH /employees/:userId` (Task 4) over HTTP.
- Produces: the `/colaboradores` route; `seedResponse()` (test helper), also consumed by Task 8's polling-failure test.

- [ ] **Step 1: Generalize seeding in `apps/web/e2e/fake-api-server.mjs`**

Read the current file first. Replace:

```javascript
let seeded = {};
let recordedRequests = [];
```

with:

```javascript
let seeded = {};
let recordedRequests = [];

function seedKey(method, path) {
  return `${method} ${path}`;
}
```

Replace:

```javascript
  if (req.method === "POST" && url.pathname === "/__seed") {
    seeded[body.path] = body.response;
    return sendJson(res, 204, null);
  }
```

with:

```javascript
  if (req.method === "POST" && url.pathname === "/__seed") {
    const method = body.method ?? "GET";
    seeded[seedKey(method, body.path)] = {
      response: body.response,
      status: body.status ?? 200,
    };
    return sendJson(res, 204, null);
  }
```

Replace:

```javascript
  if (req.method === "GET" && url.pathname in seeded) {
    return sendJson(res, 200, seeded[url.pathname]);
  }
```

with:

```javascript
  const seedEntry = seeded[seedKey(req.method, url.pathname)];
  if (seedEntry) {
    return sendJson(res, seedEntry.status, seedEntry.response);
  }
```

Every existing `mockApi` call in `test-session.ts` seeds without a `method`/`status` (defaults to `"GET"`/`200`), so this is backward compatible with every existing seeded `GET` path.

- [ ] **Step 2: Add the `PATCH /employees/:userId` fallback branch to `apps/web/e2e/fake-api-server.mjs`**

Add this near the other `PATCH` branch at the bottom of the handler, before the final 404 fallback:

```javascript
  if (req.method === "PATCH" && /^\/employees\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 200, { userId: url.pathname.split("/")[2], ...body });
  }
```

This only fires when a test hasn't seeded a specific status for that exact `PATCH /employees/:userId` path (the generalized `seedEntry` check above it takes priority) — same pattern as the existing `POST /operacional/escala` fallback.

- [ ] **Step 3: Add `seedResponse` to `apps/web/e2e/test-session.ts`**

Read the current file first. Add this export at the end of the file:

```typescript
// General-purpose seeding for a specific method+path+status, used where the
// typed mockApi() helper's GET-only, always-200 seeding isn't expressive
// enough (e.g. simulating a failed PATCH, or a specific poll response).
export async function seedResponse(
  request: APIRequestContext,
  options: { method: string; path: string; status?: number; response: unknown }
) {
  await request.post(`${FAKE_API_URL}/__seed`, {
    data: {
      method: options.method,
      path: options.path,
      status: options.status ?? 200,
      response: options.response,
    },
  });
}
```

Also extend `mockApi`'s `data` parameter type to include employees with the new field — no code change needed (it's already `employees?: unknown[]`), but note for later tasks: fixtures can now include `expectedStartTime`.

- [ ] **Step 4: Add the "Colaboradores" nav link — `apps/web/src/components/nav-links.tsx`**

Read the current file first. Change `NAV_SECTIONS` from:

```typescript
const NAV_SECTIONS = [
  { href: "/", label: "Ponto" },
  { href: "/escala", label: "Escala" },
  ...
```

to:

```typescript
const NAV_SECTIONS = [
  { href: "/", label: "Ponto" },
  { href: "/colaboradores", label: "Colaboradores" },
  { href: "/escala", label: "Escala" },
  ...
```

(keep every other entry unchanged).

- [ ] **Step 5: Assert the new link in `apps/web/e2e/app-shell.spec.ts`**

In the `"sidebar renders both sections and navigates between them"` test, add this line right after the existing `await expect(page.getByRole("link", { name: "Ponto" })).toBeVisible();`:

```typescript
  await expect(page.getByRole("link", { name: "Colaboradores" })).toBeVisible();
```

- [ ] **Step 6: Write `apps/web/src/app/(app)/colaboradores/colaboradores.module.css`**

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

.subheading {
  font-size: 14px;
  color: var(--color-text-secondary);
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

.itemName {
  font-weight: 600;
  color: var(--color-text);
}

.form {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeInput {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-background-selected);
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
}

.saveButton {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-background);
  background: var(--color-text);
  cursor: pointer;
}

.saveButton:hover {
  opacity: 0.85;
}

.saveButton:disabled {
  opacity: 0.5;
  cursor: default;
}

.error {
  font-size: 13px;
  color: var(--color-text);
}
```

- [ ] **Step 7: Write `apps/web/src/app/(app)/colaboradores/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export type UpdateScheduleState = { error: string | null };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function updateSchedule(
  _prevState: UpdateScheduleState,
  formData: FormData
): Promise<UpdateScheduleState> {
  const userId = formData.get("userId");
  const rawExpectedStartTime = formData.get("expectedStartTime");
  if (typeof userId !== "string" || typeof rawExpectedStartTime !== "string") {
    return { error: "Dados do formulário inválidos." };
  }

  const expectedStartTime = rawExpectedStartTime === "" ? null : rawExpectedStartTime;
  if (expectedStartTime !== null && !TIME_PATTERN.test(expectedStartTime)) {
    return { error: "Horário inválido. Use o formato HH:mm." };
  }

  const res = await apiFetch(`/employees/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedStartTime }),
  });
  if (!res.ok) {
    return { error: `Não foi possível salvar (código ${res.status}).` };
  }

  revalidatePath("/colaboradores");
  revalidatePath("/");
  return { error: null };
}
```

- [ ] **Step 8: Write `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`**

```tsx
"use client";

import { useActionState } from "react";

import { updateSchedule } from "./actions";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  expectedStartTime: string | null;
};

export function ColaboradoresRow({ employee }: { employee: Employee }) {
  const [state, formAction, pending] = useActionState(updateSchedule, { error: null });

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>{employee.name}</span>
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="userId" value={employee.userId} />
        <input
          type="time"
          name="expectedStartTime"
          defaultValue={employee.expectedStartTime ?? ""}
          aria-label={`Horário esperado de entrada de ${employee.name}`}
          className={styles.timeInput}
        />
        <button type="submit" className={styles.saveButton} disabled={pending}>
          Salvar
        </button>
      </form>
      {state.error ? <span className={styles.error}>{state.error}</span> : null}
    </li>
  );
}
```

- [ ] **Step 9: Write `apps/web/src/app/(app)/colaboradores/page.tsx`**

```tsx
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ColaboradoresRow } from "./colaboradores-row";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  expectedStartTime: string | null;
};

export default async function ColaboradoresPage() {
  const session = await getSession();
  if (!session || session.role !== "rh") {
    return <EmptyState title="Sem permissão" description="Esta página é restrita ao RH." />;
  }

  const employees = await apiFetchJson<Employee[]>("/employees");

  if (employees.length === 0) {
    return (
      <EmptyState title="Colaboradores" description="Nenhum colaborador cadastrado ainda." />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Colaboradores</h1>
      <p className={styles.subheading}>
        Defina o horário esperado de entrada de cada colaborador — usado para marcá-lo como
        atrasado no painel de presença.
      </p>
      <ul className={styles.list}>
        {employees.map((employee) => (
          <ColaboradoresRow key={employee.userId} employee={employee} />
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 10: Write `apps/web/e2e/colaboradores.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

test("colaborador sees a permission message instead of the roster", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/colaboradores");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("gestor sees a permission message instead of the roster", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/colaboradores");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("rh sees the roster with the current expected start time prefilled", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });

  await page.goto("/colaboradores");

  await expect(page.getByText("Ana Colaboradora")).toBeVisible();
  await expect(
    page.getByLabel("Horário esperado de entrada de Ana Colaboradora")
  ).toHaveValue("09:00");
});

test("saving a valid schedule calls the API with the new time", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: null }],
  });

  await page.goto("/colaboradores");
  await page.getByLabel("Horário esperado de entrada de Ana Colaboradora").fill("08:30");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "PATCH" && r.path === "/employees/colaborador-1")
        ?.body;
    })
    .toEqual({ expectedStartTime: "08:30" });
});

test("clearing the schedule calls the API with null", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });

  await page.goto("/colaboradores");
  await page.getByLabel("Horário esperado de entrada de Ana Colaboradora").fill("");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "PATCH" && r.path === "/employees/colaborador-1")
        ?.body;
    })
    .toEqual({ expectedStartTime: null });
});

test("a failed save shows an inline error instead of crashing the page", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });
  await seedResponse(request, {
    method: "PATCH",
    path: "/employees/colaborador-1",
    status: 500,
    response: { message: "Internal server error" },
  });

  await page.goto("/colaboradores");
  await page.getByLabel("Horário esperado de entrada de Ana Colaboradora").fill("08:30");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Não foi possível salvar (código 500).")).toBeVisible();
});
```

- [ ] **Step 11: Run the build to catch type errors**

Run: `pnpm --filter @ponto-dcit/web run build`
Expected: succeeds.

- [ ] **Step 12: Run the e2e suite**

Run: `pnpm --filter @ponto-dcit/web run test`
Expected: PASS — all pre-existing suites unaffected, plus the 6 new `colaboradores.spec.ts` tests and the amended `app-shell.spec.ts` assertion. If port 3000/3001 are already bound by a leftover process, free them first (`netstat -ano | grep LISTENING | grep ':3000 '` on Windows, then kill that PID).

- [ ] **Step 13: Lint**

Run: `pnpm --filter @ponto-dcit/web run lint`
Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/components/nav-links.tsx apps/web/src/app/'(app)'/colaboradores apps/web/e2e
git commit -m "feat(web): add /colaboradores page to set expected start times"
```

---

### Task 7: `apps/web` — `/api/team-presence` Route Handler

**Files:**
- Create: `apps/web/src/app/api/team-presence/route.ts`

**Interfaces:**
- Consumes: `apiFetch` from `@/lib/api` (server-only, forwards the httpOnly session cookie as `Authorization: Bearer`).
- Produces: `GET /api/team-presence` — a same-origin JSON proxy to `GET /time-entries/team`, browser-fetchable (unlike the NestJS API directly, which the browser can't authenticate against). Task 8's Client Component polls this.

- [ ] **Step 1: Write `apps/web/src/app/api/team-presence/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Always dynamic: this proxies a per-user, auth-scoped call and must never
// be served from a cached response.
export const dynamic = "force-dynamic";

// The browser can't call the NestJS API directly to poll for live presence
// updates — the session JWT lives in an httpOnly cookie only this Next.js
// server can read (see apiFetch in lib/api.ts). This route is a thin
// same-origin proxy so presence-panel.tsx has something to fetch from the
// client.
export async function GET() {
  const res = await apiFetch("/time-entries/team");
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 2: Run the build to catch type errors**

Run: `pnpm --filter @ponto-dcit/web run build`
Expected: succeeds.

- [ ] **Step 3: Manually verify against the fake API server**

Run: `node apps/web/e2e/fake-api-server.mjs &` then, in another shell, `pnpm --filter @ponto-dcit/web dev` — visiting `http://localhost:3001/api/team-presence` directly in a browser without a session cookie should return the fake server's default `[]` for `/time-entries/team` wrapped as-is (status 200, `Content-Type: application/json`). Stop both processes afterward (`kill %1` for the backgrounded fake server, `Ctrl+C` for `next dev`).

- [ ] **Step 4: Lint**

Run: `pnpm --filter @ponto-dcit/web run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api
git commit -m "feat(web): add /api/team-presence proxy route for client-side polling"
```

---

### Task 8: `apps/web` — presence panel (home page) with polling

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/(app)/ponto.module.css`
- Modify: `apps/web/src/app/(app)/page.tsx`
- Create: `apps/web/src/app/(app)/presence-panel.tsx`
- Modify: `apps/web/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `EmptyState` from `@/components/empty-state`; `apiFetchJson` from `@/lib/api`; `getSession` from `@/lib/session`; `GET /time-entries/team` (Task 5's new response shape) for the initial server render; `GET /api/team-presence` (Task 7) for client-side polling.
- Produces: the redesigned `/` presence panel. Nothing else in this plan consumes it.

- [ ] **Step 1: Add 5 status color tokens to `apps/web/src/app/globals.css`**

Read the current file first. Change:

```css
:root {
  --color-background: #ffffff;
  --color-text: #000000;
  --color-background-element: #f0f0f3;
  --color-background-selected: #e0e1e6;
  --color-text-secondary: #60646c;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #000000;
    --color-text: #ffffff;
    --color-background-element: #212225;
    --color-background-selected: #2e3135;
    --color-text-secondary: #b0b4ba;
  }
}
```

to:

```css
:root {
  --color-background: #ffffff;
  --color-text: #000000;
  --color-background-element: #f0f0f3;
  --color-background-selected: #e0e1e6;
  --color-text-secondary: #60646c;
  --color-status-success: #1a7f37;
  --color-status-warning: #9a6700;
  --color-status-danger: #cf222e;
  --color-status-info: #0969da;
  --color-status-special: #8250df;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #000000;
    --color-text: #ffffff;
    --color-background-element: #212225;
    --color-background-selected: #2e3135;
    --color-text-secondary: #b0b4ba;
    --color-status-success: #238636;
    --color-status-warning: #9e6a03;
    --color-status-danger: #da3633;
    --color-status-info: #1f6feb;
    --color-status-special: #8957e5;
  }
}
```

- [ ] **Step 2: Replace the status classes in `apps/web/src/app/(app)/ponto.module.css`**

Read the current file first. Replace:

```css
.statusOpen {
  color: var(--color-background);
  background: var(--color-text);
}

.statusClosed,
.statusNone {
  color: var(--color-text-secondary);
  background: var(--color-background-selected);
}
```

with:

```css
.statusTrabalhando {
  color: #ffffff;
  background: var(--color-status-success);
}

.statusPausa {
  color: #ffffff;
  background: var(--color-status-warning);
}

.statusAtrasado {
  color: #ffffff;
  background: var(--color-status-danger);
}

.statusNeutro {
  color: var(--color-text-secondary);
  background: var(--color-background-selected);
}

.statusFerias {
  color: #ffffff;
  background: var(--color-status-info);
}

.statusAtestado {
  color: #ffffff;
  background: var(--color-status-special);
}
```

- [ ] **Step 3: Write `apps/web/src/app/(app)/presence-panel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

import styles from "./ponto.module.css";

export type TeamMemberStatus =
  | "trabalhando"
  | "pausa"
  | "atrasado"
  | "folga"
  | "sem_registro"
  | "nao_presente"
  | "ferias"
  | "atestado";

export type TeamMember = {
  userId: string;
  name: string;
  entries: { id: string; clockedAt: string }[];
  workedMinutes: number;
  status: TeamMemberStatus;
  periodStart?: string;
  periodEnd?: string;
};

const POLL_INTERVAL_MS = 60_000;

const STATUS_LABEL: Record<TeamMemberStatus, string> = {
  trabalhando: "Trabalhando",
  pausa: "Em pausa",
  atrasado: "Atrasado",
  folga: "De folga",
  sem_registro: "Sem registro",
  nao_presente: "Não presente",
  ferias: "Férias",
  atestado: "Atestado",
};

const STATUS_CLASS: Record<TeamMemberStatus, string> = {
  trabalhando: styles.statusTrabalhando,
  pausa: styles.statusPausa,
  atrasado: styles.statusAtrasado,
  folga: styles.statusNeutro,
  sem_registro: styles.statusNeutro,
  nao_presente: styles.statusNeutro,
  ferias: styles.statusFerias,
  atestado: styles.statusAtestado,
};

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateOnly(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function detailFor(member: TeamMember): string {
  if ((member.status === "ferias" || member.status === "atestado") && member.periodStart && member.periodEnd) {
    return `${formatDateOnly(member.periodStart)} até ${formatDateOnly(member.periodEnd)}`;
  }
  return member.entries.length > 0
    ? `${member.entries.map((entry) => formatTime(entry.clockedAt)).join(", ")} · ${formatMinutes(member.workedMinutes)} hoje`
    : "Nenhuma batida hoje";
}

export function PresencePanel({ initialTeam }: { initialTeam: TeamMember[] }) {
  const [team, setTeam] = useState(initialTeam);

  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/team-presence")
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
        .then((data: TeamMember[]) => setTeam(data))
        .catch(() => {
          // Transient failure (network blip, API hiccup): keep showing the
          // last known-good data rather than clearing the panel or
          // surfacing an error to the gestor.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Ponto dos funcionários</h1>
      <ul className={styles.list}>
        {team.map((member) => (
          <li key={member.userId} className={styles.item}>
            <div className={styles.itemInfo}>
              <span className={styles.itemName}>{member.name}</span>
              <span className={styles.itemDetail}>{detailFor(member)}</span>
            </div>
            <span className={`${styles.status} ${STATUS_CLASS[member.status]}`}>
              {STATUS_LABEL[member.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `apps/web/src/app/(app)/page.tsx`**

Replace the whole file with:

```tsx
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { PresencePanel, type TeamMember } from "./presence-panel";

export default async function Home() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
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

- [ ] **Step 5: Rewrite the seeded-data test in `apps/web/e2e/home.spec.ts`**

Read the current file first. Replace the whole `"lists each employee's presence and worked time for a gestor"` test with tests covering every status. Replace it with:

```typescript
test("lists each employee's presence and worked time for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    team: [
      {
        userId: "colaborador-1",
        name: "Ana Colaboradora",
        entries: [{ id: "1", clockedAt: "2026-08-27T09:00:00.000Z" }],
        workedMinutes: 0,
        status: "trabalhando",
      },
      {
        userId: "colaborador-2",
        name: "Beto Colaborador",
        entries: [
          { id: "2", clockedAt: "2026-08-27T09:00:00.000Z" },
          { id: "3", clockedAt: "2026-08-27T13:00:00.000Z" },
        ],
        workedMinutes: 240,
        status: "pausa",
      },
    ],
  });

  await page.goto("/");

  await expect(page.getByText("Ana Colaboradora")).toBeVisible();
  await expect(page.getByText("Trabalhando", { exact: true })).toBeVisible();
  await expect(page.getByText("Beto Colaborador")).toBeVisible();
  await expect(page.getByText("Em pausa", { exact: true })).toBeVisible();
  await expect(page.getByText("4h 00min hoje")).toBeVisible();
});

test("shows the remaining statuses: atrasado, de folga, férias, atestado, não presente", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    team: [
      { userId: "u-1", name: "Atrasada", entries: [], workedMinutes: 0, status: "atrasado" },
      { userId: "u-2", name: "De Folga", entries: [], workedMinutes: 0, status: "folga" },
      {
        userId: "u-3",
        name: "De Férias",
        entries: [],
        workedMinutes: 0,
        status: "ferias",
        periodStart: "2026-08-25T00:00:00.000Z",
        periodEnd: "2026-08-29T00:00:00.000Z",
      },
      {
        userId: "u-4",
        name: "De Atestado",
        entries: [],
        workedMinutes: 0,
        status: "atestado",
        periodStart: "2026-08-26T00:00:00.000Z",
        periodEnd: "2026-08-28T00:00:00.000Z",
      },
      { userId: "u-5", name: "Encerrou o Dia", entries: [], workedMinutes: 480, status: "nao_presente" },
    ],
  });

  await page.goto("/");

  await expect(page.getByText("Atrasado", { exact: true })).toBeVisible();
  await expect(page.getByText("De folga", { exact: true })).toBeVisible();
  await expect(page.getByText("Férias", { exact: true })).toBeVisible();
  await expect(page.getByText("25/08/2026 até 29/08/2026")).toBeVisible();
  await expect(page.getByText("Atestado", { exact: true })).toBeVisible();
  await expect(page.getByText("26/08/2026 até 28/08/2026")).toBeVisible();
  await expect(page.getByText("Não presente", { exact: true })).toBeVisible();
});

test("polls for updates and re-renders with the new data after 60s", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    team: [{ userId: "u-1", name: "Ana", entries: [], workedMinutes: 0, status: "sem_registro" }],
  });

  await page.clock.install();
  await page.goto("/");
  await expect(page.getByText("Sem registro", { exact: true })).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/time-entries/team",
    response: [{ userId: "u-1", name: "Ana", entries: [], workedMinutes: 0, status: "trabalhando" }],
  });
  await page.clock.fastForward(60_000);

  await expect(page.getByText("Trabalhando", { exact: true })).toBeVisible();
});

test("keeps showing the last known data when a poll fails", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    team: [{ userId: "u-1", name: "Ana", entries: [], workedMinutes: 0, status: "trabalhando" }],
  });

  await page.clock.install();
  await page.goto("/");
  await expect(page.getByText("Trabalhando", { exact: true })).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/time-entries/team",
    status: 500,
    response: { message: "Internal server error" },
  });
  await page.clock.fastForward(60_000);

  // The failed poll must not clear or blank the panel.
  await expect(page.getByText("Ana")).toBeVisible();
  await expect(page.getByText("Trabalhando", { exact: true })).toBeVisible();
});
```

Add `seedResponse` to the file's existing import line:

```typescript
import { addSessionCookie, mockApi, seedResponse } from "./test-session";
```

- [ ] **Step 6: Run the build to catch type errors**

Run: `pnpm --filter @ponto-dcit/web run build`
Expected: succeeds.

- [ ] **Step 7: Run the e2e suite**

Run: `pnpm --filter @ponto-dcit/web run test`
Expected: PASS — every suite green, including the 4 rewritten/new `home.spec.ts` tests (the pre-existing `"colaborador sees a permission message..."` and `"renders its empty state..."` tests are untouched and still pass). If port 3000/3001 are already bound by a leftover process, free them first.

- [ ] **Step 8: Lint**

Run: `pnpm --filter @ponto-dcit/web run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/'(app)'/ponto.module.css apps/web/src/app/'(app)'/page.tsx apps/web/src/app/'(app)'/presence-panel.tsx apps/web/e2e/home.spec.ts
git commit -m "feat(web): replace the presence list with a live, color-coded status panel"
```

---

### Task 9: Full-repo verification

**Files:** none (verification only).

- [ ] **Step 1: Run every workspace's build**

Run: `pnpm turbo run build`
Expected: PASS. If `turbo` fails to spawn, fall back to `pnpm --filter @ponto-dcit/shared-types run build && pnpm --filter @ponto-dcit/api run build && pnpm --filter @ponto-dcit/web run build`.

- [ ] **Step 2: Run every workspace's tests**

Run: `pnpm turbo run test`
Expected: PASS. If `turbo` fails to spawn, fall back to `pnpm --filter @ponto-dcit/shared-types test && pnpm --filter @ponto-dcit/api run test && pnpm --filter @ponto-dcit/web run test`.

- [ ] **Step 3: Manually exercise the golden path in a running app**

With `apps/api`, `infra/mock-idp`, and `apps/web` all running (see `README.md`'s "Running each app in development"): log in as `rh-1`, open `/colaboradores`, set an expected start time for a seeded employee, then open `/` and confirm the panel reflects it (e.g. mark that employee as `atrasado` if the current time is past their new start time + 10min in São Paulo). Confirm the sidebar shows "Colaboradores" and that a `colaborador` login is denied both new pages with "Sem permissão".

- [ ] **Step 4: Report status update to the spec**

Update `docs/superpowers/specs/2026-08-28-mapa-de-presenca-design.md`'s `**Status:**` line from "Aprovado para implementação" to "Implementado" once every task above is committed and Steps 1–3 pass.

```bash
git add docs/superpowers/specs/2026-08-28-mapa-de-presenca-design.md
git commit -m "docs: mark mapa de presença spec as implemented"
```
