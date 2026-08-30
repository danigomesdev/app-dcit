# Holerites (RH/gestor cadastro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the payslip (`Payslip`) self-service loop — today the model, the mobile self-service view (`fetchPayslips`), and the `GET /documentos/holerites` endpoint all exist, but there is no way anywhere to create one. Give gestor/RH a cadastro (create/edit/delete) so the mobile self-service view actually has data to show.

**Architecture:** No new Prisma model, no new API module — extends the existing `apps/api/src/documentos` module (which already hosts `AdmissionDocument`/`Certification` in the same file) with four new `Payslip` routes. Web gets a new `/holerites` gestor+RH page mirroring `/convencoes`'s CRUD-dialog pattern (list + "Novo holerite" dialog + edit/delete per row via Server Actions), not the read-only `/documentos` page.

**Tech Stack:** NestJS + Prisma (SQLite) API, Next.js Server Components + Server Actions web, Zod (`packages/shared-types`) — all already established in this repo.

**Spec:** `docs/superpowers/specs/2026-08-29-holerites-design.md`

## Global Constraints

- No Prisma migration in this plan — `Payslip { id, userId, label, gross, inss, irrf, benefits }` already exists exactly as needed.
- Numeric fields submitted from web forms arrive as strings (FormData → Server Action → `JSON.stringify`) — every numeric Zod field in this feature (`gross`, `inss`, `irrf`, `benefits`) MUST use `z.coerce.number()`, not `z.number()`.
- `GET /documentos/holerites/equipe`, `POST /documentos/holerites`, `PATCH /documentos/holerites/:id`, `DELETE /documentos/holerites/:id` — all `AuthGuard` + `RolesGuard` + `@Roles('gestor', 'rh')`. The existing `GET /documentos/holerites` (self-service) keeps only `AuthGuard`, unchanged.
- Deleting a `Payslip` is idempotent — `prisma.payslip.deleteMany({ where: { id } })`, not `.delete()`, matching `ConvencoesService.delete`'s precedent (calling delete twice, or on an already-gone id, must not throw).
- `PATCH` never accepts `userId` — a holerite doesn't change owner after creation. The create schema requires `userId`; the update schema omits it.
- `label` stays a free-text string — no structured period field, no uniqueness constraint.
- Follow existing module conventions exactly: `AuthGuard`+`RolesGuard`+`@Roles(...)` for RBAC, Server Actions + `revalidatePath` for web mutations, `EmptyState` for the permission gate.

---

### Task 1: `packages/shared-types` — `PayslipInputSchema`/`PayslipUpdateSchema`

**Files:**
- Create: `packages/shared-types/src/payslip.ts`
- Create: `packages/shared-types/src/payslip.test.ts`
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Produces: `PayslipInputSchema`, `PayslipInput` (type), `PayslipUpdateSchema`, `PayslipUpdate` (type) — exported from `@ponto-dcit/shared-types`. Task 2 (API controller) consumes both schemas by these exact names.

- [ ] **Step 1: Write the failing test**

Create `packages/shared-types/src/payslip.test.ts`:

```typescript
import { PayslipInputSchema, PayslipUpdateSchema } from "./payslip";

const VALID_INPUT = {
  userId: "user-1",
  label: "Agosto/2026",
  gross: 6200,
  inss: 682,
  irrf: 410,
  benefits: 380,
};

describe("PayslipInputSchema", () => {
  it("accepts a fully populated valid payload", () => {
    const result = PayslipInputSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("coerces monetary fields from strings (form submissions)", () => {
    const result = PayslipInputSchema.safeParse({
      ...VALID_INPUT,
      gross: "6200",
      inss: "682",
      irrf: "410",
      benefits: "380",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gross).toBe(6200);
      expect(result.data.benefits).toBe(380);
    }
  });

  it("rejects a missing userId", () => {
    const { userId: _userId, ...rest } = VALID_INPUT;
    const result = PayslipInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an empty label", () => {
    const result = PayslipInputSchema.safeParse({ ...VALID_INPUT, label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative gross value", () => {
    const result = PayslipInputSchema.safeParse({ ...VALID_INPUT, gross: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative inss/irrf/benefits value", () => {
    expect(PayslipInputSchema.safeParse({ ...VALID_INPUT, inss: -1 }).success).toBe(false);
    expect(PayslipInputSchema.safeParse({ ...VALID_INPUT, irrf: -1 }).success).toBe(false);
    expect(PayslipInputSchema.safeParse({ ...VALID_INPUT, benefits: -1 }).success).toBe(false);
  });
});

describe("PayslipUpdateSchema", () => {
  it("accepts the same payload without userId", () => {
    const { userId: _userId, ...rest } = VALID_INPUT;
    const result = PayslipUpdateSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("ignores a userId field if present (not part of the schema's shape)", () => {
    const result = PayslipUpdateSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).userId).toBeUndefined();
    }
  });

  it("rejects a negative gross value", () => {
    const { userId: _userId, ...rest } = VALID_INPUT;
    const result = PayslipUpdateSchema.safeParse({ ...rest, gross: -100 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/shared-types && npx jest payslip
```

Expected: FAIL — `Cannot find module './payslip'`.

- [ ] **Step 3: Write `packages/shared-types/src/payslip.ts`**

```typescript
import { z } from "zod";

export const PayslipInputSchema = z.object({
  userId: z.string().min(1),
  label: z.string().min(1),
  // z.coerce (não z.number()): o formulário web manda esses campos via
  // FormData → Server Action → JSON.stringify, então chegam como string
  // ("6200", não 6200) — mesmo raciocínio de expectedDailyMinutes em
  // convencao.ts.
  gross: z.coerce.number().nonnegative(),
  inss: z.coerce.number().nonnegative(),
  irrf: z.coerce.number().nonnegative(),
  benefits: z.coerce.number().nonnegative(),
});
export type PayslipInput = z.infer<typeof PayslipInputSchema>;

// Sem userId: um holerite não muda de dono depois de criado.
export const PayslipUpdateSchema = PayslipInputSchema.omit({ userId: true });
export type PayslipUpdate = z.infer<typeof PayslipUpdateSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd packages/shared-types && npx jest payslip
```

Expected: PASS, all 9 tests.

- [ ] **Step 5: Update `packages/shared-types/src/index.ts`**

Add, alongside the other schema exports:

```typescript
export { PayslipInputSchema, PayslipUpdateSchema } from "./payslip";
export type { PayslipInput, PayslipUpdate } from "./payslip";
```

- [ ] **Step 6: Run the full shared-types test suite**

```bash
pnpm --filter @ponto-dcit/shared-types test
```

Expected: all suites pass, including the new `payslip.test.ts`.

- [ ] **Step 7: Build the package**

```bash
pnpm --filter @ponto-dcit/shared-types run build
```

Expected: succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-types/src/payslip.ts packages/shared-types/src/payslip.test.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add PayslipInputSchema/PayslipUpdateSchema"
```

---

### Task 2: `apps/api/src/documentos` — holerite CRUD routes

**Files:**
- Modify: `apps/api/src/documentos/documentos.service.ts`
- Modify: `apps/api/src/documentos/documentos.service.spec.ts`
- Modify: `apps/api/src/documentos/documentos.controller.ts`
- Modify: `apps/api/src/documentos/documentos.controller.spec.ts`

**Interfaces:**
- Consumes: `PayslipInput`/`PayslipInputSchema`, `PayslipUpdate`/`PayslipUpdateSchema` (Task 1).
- Produces: `DocumentosService.createPayslip(input: PayslipInput)`, `.updatePayslip(id: string, input: PayslipUpdate)`, `.deletePayslip(id: string)`, `.listAllPayslips()`. `POST /documentos/holerites`, `GET /documentos/holerites/equipe`, `PATCH /documentos/holerites/:id`, `DELETE /documentos/holerites/:id` — Task 3 (web) consumes all four by these exact paths/methods.

- [ ] **Step 1: Write the failing service tests**

In `apps/api/src/documentos/documentos.service.spec.ts`, add these tests inside the existing `describe('DocumentosService', ...)` block, right after the `"lists only the given user's payslips"` test:

```typescript
  it('creates, updates, and lists a payslip across the whole team', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-g',
        name: 'Gabriela Holerite',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });

    const created = await service.createPayslip({
      userId: 'user-g',
      label: 'Agosto/2026',
      gross: 6200,
      inss: 682,
      irrf: 410,
      benefits: 380,
    });

    expect(created.label).toBe('Agosto/2026');
    expect(created.gross).toBe(6200);

    const listed = await service.listAllPayslips();
    expect(listed.find((p) => p.id === created.id)?.userName).toBe('Gabriela Holerite');

    const updated = await service.updatePayslip(created.id, {
      label: 'Agosto/2026 (corrigido)',
      gross: 6500,
      inss: 700,
      irrf: 420,
      benefits: 380,
    });
    expect(updated.label).toBe('Agosto/2026 (corrigido)');
    expect(updated.gross).toBe(6500);

    await prisma.employee.delete({ where: { userId: 'user-g' } });
  });

  it('deletes a payslip idempotently', async () => {
    const created = await service.createPayslip({
      userId: 'user-h',
      label: 'Setembro/2026',
      gross: 5000,
      inss: 500,
      irrf: 300,
      benefits: 200,
    });

    await service.deletePayslip(created.id);
    // Calling it a second time, or on an id that never existed, must not throw.
    await service.deletePayslip(created.id);
    await service.deletePayslip('never-existed');

    const listed = await service.listAllPayslips();
    expect(listed.find((p) => p.id === created.id)).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js documentos.service
```

Expected: FAIL — `service.createPayslip is not a function`.

- [ ] **Step 3: Implement in `apps/api/src/documentos/documentos.service.ts`**

Update the import at the top of the file:

```typescript
import { Injectable } from '@nestjs/common';
import type {
  AdmissionDocumentInput,
  CertificationInput,
  PayslipInput,
  PayslipUpdate,
} from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
```

Add four methods to the `DocumentosService` class, right after `listPayslips`:

```typescript
  createPayslip(input: PayslipInput) {
    return this.prisma.payslip.create({ data: input });
  }

  updatePayslip(id: string, input: PayslipUpdate) {
    return this.prisma.payslip.update({ where: { id }, data: input });
  }

  // Idempotent — calling this twice, or on an id that never existed, must
  // not throw. Same pattern as ConvencoesService.delete.
  deletePayslip(id: string) {
    return this.prisma.payslip.deleteMany({ where: { id } });
  }

  async listAllPayslips() {
    const payslips = await this.prisma.payslip.findMany();
    return this.withRequesterNames(payslips);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js documentos.service
```

Expected: PASS, every test in the file.

- [ ] **Step 5: Write the failing controller tests**

In `apps/api/src/documentos/documentos.controller.spec.ts`:

Update `GUARDED_HANDLERS` to include the new handlers:

```typescript
const GUARDED_HANDLERS = [
  'listPayslips',
  'createAdmissionDocument',
  'listAdmissionDocuments',
  'createCertification',
  'listCertifications',
  'listAllAdmissionDocuments',
  'listAllCertifications',
  'createPayslip',
  'updatePayslip',
  'removePayslip',
  'listAllPayslips',
] as const;
```

Update the `it.each(['listAllAdmissionDocuments', 'listAllCertifications'] as const)` block's array to also include the three gestor/rh-only payslip handlers:

```typescript
  it.each([
    'listAllAdmissionDocuments',
    'listAllCertifications',
    'createPayslip',
    'updatePayslip',
    'removePayslip',
    'listAllPayslips',
  ] as const)(
```

Add `createPayslip: jest.fn(), updatePayslip: jest.fn(), deletePayslip: jest.fn(), listAllPayslips: jest.fn(),` to `serviceMock`, alongside the other mocked methods.

Add these tests inside the existing `describe('DocumentosController', ...)` block, right after the `"lists certifications across the whole team"` test:

```typescript
  it('creates a payslip with a valid payload', async () => {
    serviceMock.createPayslip.mockResolvedValue({ id: '1' });

    await controller.createPayslip({
      userId: 'user-1',
      label: 'Agosto/2026',
      gross: 6200,
      inss: 682,
      irrf: 410,
      benefits: 380,
    });

    expect(serviceMock.createPayslip).toHaveBeenCalledWith({
      userId: 'user-1',
      label: 'Agosto/2026',
      gross: 6200,
      inss: 682,
      irrf: 410,
      benefits: 380,
    });
  });

  it('rejects a payslip payload missing userId', async () => {
    await expect(
      controller.createPayslip({
        label: 'Agosto/2026',
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createPayslip).not.toHaveBeenCalled();
  });

  it('rejects a payslip payload with a negative value', async () => {
    await expect(
      controller.createPayslip({
        userId: 'user-1',
        label: 'Agosto/2026',
        gross: -1,
        inss: 682,
        irrf: 410,
        benefits: 380,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createPayslip).not.toHaveBeenCalled();
  });

  it('updates a payslip with a valid payload, without a userId field', async () => {
    serviceMock.updatePayslip.mockResolvedValue({ id: 'p1' });

    await controller.updatePayslip('p1', {
      label: 'Agosto/2026 (corrigido)',
      gross: 6500,
      inss: 700,
      irrf: 420,
      benefits: 380,
    });

    expect(serviceMock.updatePayslip).toHaveBeenCalledWith('p1', {
      label: 'Agosto/2026 (corrigido)',
      gross: 6500,
      inss: 700,
      irrf: 420,
      benefits: 380,
    });
  });

  it('deletes a payslip', async () => {
    serviceMock.deletePayslip.mockResolvedValue(undefined);

    await controller.removePayslip('p1');

    expect(serviceMock.deletePayslip).toHaveBeenCalledWith('p1');
  });

  it('lists payslips across the whole team', async () => {
    serviceMock.listAllPayslips.mockResolvedValue([
      { id: '1', userId: 'user-1', userName: 'Ana' },
    ]);

    const result = await controller.listAllPayslips();

    expect(result).toEqual([{ id: '1', userId: 'user-1', userName: 'Ana' }]);
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js documentos.controller
```

Expected: FAIL — `controller.createPayslip is not a function`.

- [ ] **Step 7: Implement in `apps/api/src/documentos/documentos.controller.ts`**

Update the import at the top:

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AdmissionDocumentInputSchema,
  CertificationInputSchema,
  PayslipInputSchema,
  PayslipUpdateSchema,
} from '@ponto-dcit/shared-types';
import { DocumentosService } from './documentos.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };
```

Add four routes to the `DocumentosController` class, right after the existing `listPayslips` handler:

```typescript
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Post('holerites')
  @HttpCode(201)
  createPayslip(@Body() body: unknown) {
    const result = PayslipInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.createPayslip(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('holerites/equipe')
  listAllPayslips() {
    return this.documentos.listAllPayslips();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch('holerites/:id')
  updatePayslip(@Param('id') id: string, @Body() body: unknown) {
    const result = PayslipUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.updatePayslip(id, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Delete('holerites/:id')
  @HttpCode(204)
  async removePayslip(@Param('id') id: string) {
    await this.documentos.deletePayslip(id);
  }
```

Note: `Get('holerites/equipe')` must be registered — it already is, per the order above — but NestJS matches routes in declaration order within a controller, and `@Get('holerites')` (the pre-existing self-service route, unaffected by this task) has no path parameter so it cannot shadow `holerites/equipe`. No reordering needed.

- [ ] **Step 8: Run the tests to verify they pass**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js documentos
```

Expected: PASS, every test in both `documentos.service.spec.ts` and `documentos.controller.spec.ts`.

- [ ] **Step 9: Run the full API test suite**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js
```

Expected: all suites pass (a pre-existing, unrelated cross-suite flake may appear in some unrelated `*.service.spec.ts` file when running the full suite together — if so, re-run that one file alone to confirm it passes in isolation).

- [ ] **Step 10: Lint**

```bash
cd apps/api && npx eslint src/documentos
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/documentos/documentos.service.ts apps/api/src/documentos/documentos.service.spec.ts apps/api/src/documentos/documentos.controller.ts apps/api/src/documentos/documentos.controller.spec.ts
git commit -m "feat(api): add holerite CRUD routes to DocumentosController"
```

---

### Task 3: Web — `/holerites` page (gestor+RH CRUD)

**Files:**
- Modify: `apps/web/src/components/nav-links.tsx`
- Create: `apps/web/src/app/(app)/holerites/page.tsx`
- Create: `apps/web/src/app/(app)/holerites/holerite-form-fields.tsx`
- Create: `apps/web/src/app/(app)/holerites/novo-holerite-dialog.tsx`
- Create: `apps/web/src/app/(app)/holerites/editar-holerite-dialog.tsx`
- Create: `apps/web/src/app/(app)/holerites/holerites-row.tsx`
- Create: `apps/web/src/app/(app)/holerites/actions.ts`
- Create: `apps/web/src/app/(app)/holerites/holerites.module.css`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Modify: `apps/web/e2e/test-session.ts`
- Create: `apps/web/e2e/holerites.spec.ts`
- Modify: `apps/web/e2e/app-shell.spec.ts`

**Interfaces:**
- Consumes: `GET /documentos/holerites/equipe`, `POST /documentos/holerites`, `PATCH /documentos/holerites/:id`, `DELETE /documentos/holerites/:id` (Task 2), `GET /employees` (existing), `apiFetch`/`apiFetchJson` (`@/lib/api`), `getSession` (`@/lib/session`), `EmptyState` (`@/components/empty-state`), `getRecordedRequests`/`mockApi` (`./test-session`).

- [ ] **Step 1: Add the nav item to `apps/web/src/components/nav-links.tsx`**

Add `{ href: "/holerites", label: "Holerites" }` as the last entry in `NAV_SECTIONS`, right after `"/banco-de-horas"`.

- [ ] **Step 2: Write `apps/web/src/app/(app)/holerites/holerite-form-fields.tsx`**

```tsx
"use client";

import styles from "./holerites.module.css";

export type HoleriteFormDefaults = {
  label: string;
  gross: number | null;
  inss: number | null;
  irrf: number | null;
  benefits: number | null;
};

type Employee = { userId: string; name: string };

// employeeSelect is omitted (undefined) when editing an existing holerite —
// a holerite doesn't change owner after creation, so the edit dialog never
// renders the colaborador picker.
export function HoleriteFormFields({
  defaults,
  employeeSelect,
}: {
  defaults: HoleriteFormDefaults;
  employeeSelect?: Employee[];
}) {
  return (
    <div className={styles.fieldGrid}>
      {employeeSelect ? (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Colaborador</span>
          <select name="userId" required defaultValue="" className={styles.fieldSelect}>
            <option value="" disabled>
              Escolha um colaborador
            </option>
            {employeeSelect.map((employee) => (
              <option key={employee.userId} value={employee.userId}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Rótulo</span>
        <input
          type="text"
          name="label"
          required
          placeholder="ex: Agosto/2026"
          defaultValue={defaults.label}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Bruto (R$)</span>
        <input
          type="number"
          name="gross"
          required
          min="0"
          step="0.01"
          defaultValue={defaults.gross ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>INSS (R$)</span>
        <input
          type="number"
          name="inss"
          required
          min="0"
          step="0.01"
          defaultValue={defaults.inss ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>IRRF (R$)</span>
        <input
          type="number"
          name="irrf"
          required
          min="0"
          step="0.01"
          defaultValue={defaults.irrf ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Benefícios (R$)</span>
        <input
          type="number"
          name="benefits"
          required
          min="0"
          step="0.01"
          defaultValue={defaults.benefits ?? ""}
          className={styles.fieldInput}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Write `apps/web/src/app/(app)/holerites/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export type HoleriteState = { error: string | null; success: boolean; successToken: number };

function buildPayload(formData: FormData): Record<string, string> | null {
  const label = formData.get("label");
  const gross = formData.get("gross");
  const inss = formData.get("inss");
  const irrf = formData.get("irrf");
  const benefits = formData.get("benefits");
  if (
    typeof label !== "string" ||
    typeof gross !== "string" ||
    typeof inss !== "string" ||
    typeof irrf !== "string" ||
    typeof benefits !== "string"
  ) {
    return null;
  }
  return { label, gross, inss, irrf, benefits };
}

export async function createHolerite(
  _prevState: HoleriteState,
  formData: FormData
): Promise<HoleriteState> {
  const userId = formData.get("userId");
  const payload = buildPayload(formData);
  if (typeof userId !== "string" || !userId || !payload) {
    return {
      error: "Dados do formulário inválidos.",
      success: false,
      successToken: _prevState.successToken,
    };
  }

  const res = await apiFetch("/documentos/holerites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  });
  if (!res.ok) {
    return {
      error: `Não foi possível salvar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }

  revalidatePath("/holerites");
  return { error: null, success: true, successToken: Date.now() };
}

export async function updateHolerite(
  _prevState: HoleriteState,
  formData: FormData
): Promise<HoleriteState> {
  const id = formData.get("id");
  const payload = buildPayload(formData);
  if (typeof id !== "string" || !payload) {
    return {
      error: "Dados do formulário inválidos.",
      success: false,
      successToken: _prevState.successToken,
    };
  }

  const res = await apiFetch(`/documentos/holerites/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return {
      error: `Não foi possível salvar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }

  revalidatePath("/holerites");
  return { error: null, success: true, successToken: Date.now() };
}

export async function deleteHolerite(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/documentos/holerites/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/documentos/holerites/${id} responded with ${res.status}`);
  }
  revalidatePath("/holerites");
}
```

- [ ] **Step 4: Write `apps/web/src/app/(app)/holerites/novo-holerite-dialog.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";

import { createHolerite } from "./actions";
import { HoleriteFormFields, type HoleriteFormDefaults } from "./holerite-form-fields";
import styles from "./holerites.module.css";

const EMPTY_DEFAULTS: HoleriteFormDefaults = {
  label: "",
  gross: null,
  inss: null,
  irrf: null,
  benefits: null,
};

type Employee = { userId: string; name: string };

export function NovoHoleriteDialog({ employees }: { employees: Employee[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createHolerite, {
    error: null,
    success: false,
    successToken: 0,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successToken]);

  return (
    <>
      <button
        type="button"
        className={styles.addButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        + Novo holerite
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Novo holerite</p>
        <form ref={formRef} action={formAction}>
          <HoleriteFormFields defaults={EMPTY_DEFAULTS} employeeSelect={employees} />
          {state.error ? <span className={styles.error}>{state.error}</span> : null}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => {
                dialogRef.current?.close();
                formRef.current?.reset();
              }}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.saveButton} disabled={pending}>
              Cadastrar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
```

- [ ] **Step 5: Write `apps/web/src/app/(app)/holerites/editar-holerite-dialog.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";

import { updateHolerite } from "./actions";
import { HoleriteFormFields, type HoleriteFormDefaults } from "./holerite-form-fields";
import styles from "./holerites.module.css";

type Holerite = {
  id: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

export function EditarHoleriteDialog({ holerite }: { holerite: Holerite }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(updateHolerite, {
    error: null,
    success: false,
    successToken: 0,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successToken]);

  const defaults: HoleriteFormDefaults = {
    label: holerite.label,
    gross: holerite.gross,
    inss: holerite.inss,
    irrf: holerite.irrf,
    benefits: holerite.benefits,
  };

  return (
    <>
      <button
        type="button"
        className={styles.saveButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        Editar
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Editar {holerite.label}</p>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={holerite.id} />
          <HoleriteFormFields defaults={defaults} />
          {state.error ? <span className={styles.error}>{state.error}</span> : null}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.saveButton} disabled={pending}>
              Salvar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
```

- [ ] **Step 6: Write `apps/web/src/app/(app)/holerites/holerites-row.tsx`**

```tsx
"use client";

import { useRef } from "react";

import { deleteHolerite } from "./actions";
import { EditarHoleriteDialog } from "./editar-holerite-dialog";
import styles from "./holerites.module.css";

type Holerite = {
  id: string;
  userName: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function HoleritesRow({ holerite }: { holerite: Holerite }) {
  const confirmDeleteRef = useRef<HTMLDialogElement>(null);

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>
        {holerite.userName} · {holerite.label}
      </span>
      <span className={styles.itemDetail}>
        Bruto: {formatBRL(holerite.gross)} · INSS: {formatBRL(holerite.inss)} · IRRF:{" "}
        {formatBRL(holerite.irrf)} · Benefícios: {formatBRL(holerite.benefits)}
      </span>
      <EditarHoleriteDialog holerite={holerite} />
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => confirmDeleteRef.current?.showModal()}
      >
        Excluir
      </button>

      <dialog ref={confirmDeleteRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>
          Excluir o holerite de {holerite.userName} ({holerite.label})?
        </p>
        <p className={styles.subheading}>Esta ação não pode ser desfeita.</p>
        <form action={deleteHolerite}>
          <input type="hidden" name="id" value={holerite.id} />
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => confirmDeleteRef.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.deleteButton}>
              Excluir
            </button>
          </div>
        </form>
      </dialog>
    </li>
  );
}
```

- [ ] **Step 7: Write `apps/web/src/app/(app)/holerites/page.tsx`**

```tsx
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { HoleritesRow } from "./holerites-row";
import { NovoHoleriteDialog } from "./novo-holerite-dialog";
import styles from "./holerites.module.css";

type Holerite = {
  id: string;
  userId: string;
  userName: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

type Employee = { userId: string; name: string };

export default async function HoleritesPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState title="Sem permissão" description="Esta página é restrita a gestores e RH." />
    );
  }

  const [holerites, employees] = await Promise.all([
    apiFetchJson<Holerite[]>("/documentos/holerites/equipe"),
    apiFetchJson<Employee[]>("/employees"),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Holerites</h1>
        <NovoHoleriteDialog employees={employees} />
      </div>
      {holerites.length === 0 ? (
        <p className={styles.subheading}>Nenhum holerite cadastrado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {holerites.map((holerite) => (
            <HoleritesRow key={holerite.id} holerite={holerite} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Write `apps/web/src/app/(app)/holerites/holerites.module.css`**

Copy `apps/web/src/app/(app)/convencoes/convencoes.module.css` verbatim to this new path — every class this page/its components reference (`page`, `heading`, `headingRow`, `subheading`, `addButton`, `list`, `item`, `itemName`, `itemDetail`, `dialog`, `dialogTitle`, `dialogActions`, `dialogClose`, `saveButton`, `error`, `fieldGrid`, `field`, `fieldLabel`, `fieldInput`, `fieldSelect`, `deleteButton`) already exists there with the right rules.

- [ ] **Step 9: Add the `/documentos/holerites/equipe` and CRUD handlers to `apps/web/e2e/fake-api-server.mjs`**

Add a default `GET /documentos/holerites/equipe → []` fallback alongside the other unconditional-`[]` handlers (e.g. right after the `/documentos/certificacoes/equipe` block):

```javascript
  if (req.method === "GET" && url.pathname === "/documentos/holerites/equipe") {
    return sendJson(res, 200, []);
  }
```

Add `POST`/`PATCH`/`DELETE` handlers alongside the equivalent `/convencoes` ones:

```javascript
  if (req.method === "POST" && url.pathname === "/documentos/holerites") {
    return sendJson(res, 201, { id: "generated-id", ...body });
  }
  if (req.method === "PATCH" && /^\/documentos\/holerites\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 200, { id: url.pathname.split("/")[3], ...body });
  }
  if (req.method === "DELETE" && /^\/documentos\/holerites\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
```

- [ ] **Step 10: Add the `holerites` seed key to `apps/web/e2e/test-session.ts`**

Add `holerites?: unknown[];` to the `data` parameter's type in `mockApi`, alongside the other optional keys. Add this block right before the closing brace of `mockApi`:

```typescript
  if (data.holerites) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/holerites/equipe", response: data.holerites },
    });
  }
```

- [ ] **Step 11: Write the new tests — `apps/web/e2e/holerites.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the holerites cadastro", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/holerites");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("gestor sees the holerites list", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    holerites: [
      {
        id: "hol-1",
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        label: "Agosto/2026",
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      },
    ],
  });

  await page.goto("/holerites");

  await expect(page.getByRole("heading", { name: "Holerites" })).toBeVisible();
  await expect(page.getByText(/Fernanda Colaboradora.*Agosto\/2026/)).toBeVisible();
  await expect(page.getByText(/Bruto: R\$\s?6\.200,00/)).toBeVisible();
});

test("shows an empty state when no holerite is cadastrado", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { holerites: [] });

  await page.goto("/holerites");

  await expect(page.getByText("Nenhum holerite cadastrado ainda.")).toBeVisible();
});

test("opens the dialog and creates a new holerite with the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    holerites: [],
    employees: [{ userId: "user-1", name: "Fernanda Colaboradora" }],
  });

  await page.goto("/holerites");
  await page.getByRole("button", { name: "+ Novo holerite" }).click();
  await page.getByLabel("Colaborador").selectOption("user-1");
  await page.getByLabel("Rótulo").fill("Setembro/2026");
  await page.getByLabel("Bruto (R$)").fill("6200");
  await page.getByLabel("INSS (R$)").fill("682");
  await page.getByLabel("IRRF (R$)").fill("410");
  await page.getByLabel("Benefícios (R$)").fill("380");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/holerites")
        ?.body;
    })
    .toEqual({
      userId: "user-1",
      label: "Setembro/2026",
      gross: "6200",
      inss: "682",
      irrf: "410",
      benefits: "380",
    });
});

test("editing a holerite calls the API with the updated values", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    holerites: [
      {
        id: "hol-edit",
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        label: "Agosto/2026",
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      },
    ],
  });

  await page.goto("/holerites");
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Bruto (R$)").fill("6500");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/documentos/holerites/hol-edit",
      )?.body;
    })
    .toEqual({
      label: "Agosto/2026",
      gross: "6500",
      inss: "682",
      irrf: "410",
      benefits: "380",
    });
});

test("removing a holerite calls the API", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    holerites: [
      {
        id: "hol-del",
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        label: "Agosto/2026",
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      },
    ],
  });

  await page.goto("/holerites");
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some(
        (r) => r.method === "DELETE" && r.path === "/documentos/holerites/hol-del",
      );
    })
    .toBe(true);
});
```

- [ ] **Step 12: Add "Holerites" to the full nav-link assertion in `apps/web/e2e/app-shell.spec.ts`**

Add `await expect(page.getByRole("link", { name: "Holerites" })).toBeVisible();` right after the existing `"Banco de Horas"` assertion.

- [ ] **Step 13: Run the build to catch type errors**

```bash
pnpm --filter @ponto-dcit/web run build
```

Expected: succeeds, `/holerites` listed in the route output.

- [ ] **Step 14: Run the e2e suite**

Check port 3000 is free first, then from `apps/web`:

```bash
npx playwright test e2e/holerites.spec.ts e2e/app-shell.spec.ts
```

Expected: all pass (6 new + 3 existing app-shell tests).

- [ ] **Step 15: Lint**

```bash
cd apps/web && npx eslint "src/app/(app)/holerites" src/components/nav-links.tsx e2e/holerites.spec.ts e2e/app-shell.spec.ts e2e/fake-api-server.mjs e2e/test-session.ts
```

Expected: no errors.

- [ ] **Step 16: Commit**

```bash
git add apps/web/src/components/nav-links.tsx "apps/web/src/app/(app)/holerites" apps/web/e2e/fake-api-server.mjs apps/web/e2e/test-session.ts apps/web/e2e/holerites.spec.ts apps/web/e2e/app-shell.spec.ts
git commit -m "feat(web): add Holerites nav item and gestor/RH cadastro page"
```

---

### Task 4: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run every workspace's build**

```bash
pnpm --filter @ponto-dcit/shared-types run build
pnpm --filter @ponto-dcit/api exec tsc --noEmit -p tsconfig.build.json
pnpm --filter @ponto-dcit/web run build
```

Expected: all succeed with no type errors.

- [ ] **Step 2: Run the API and web test suites**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js
```

```bash
cd apps/web && npx playwright test
```

Expected: all pass. If a single, unrelated test fails only when the full API suite runs together (pre-existing cross-suite `test.db` flakiness), re-run it alone to confirm it isn't caused by this plan's changes.

- [ ] **Step 3: Manually exercise the golden path in a running app**

With the mock IdP, API, and web dev servers running:

1. Log in as `rh-1`, go to the new "Holerites" nav item, click "+ Novo holerite", pick a colaborador, fill in the four monetary fields and a rótulo, save.
2. Confirm the new row appears in the list with the values formatted in R$.
3. Click "Editar" on that row, change the "Bruto" value, save, and confirm the row updates.
4. Click "Excluir", confirm, and confirm the row disappears.
5. Log in as `gestor-1`: confirm the same cadastro works end-to-end (gestor has the same access level as RH here).
6. Log in as the colaborador whose holerite was created (the mobile app's "Documentos" screen, self-service holerite view): confirm the holerite created in step 1 now appears there — this is the loop this plan closes.

- [ ] **Step 4: Report status update to the spec**

Add a `**Status:**` line at the top of `docs/superpowers/specs/2026-08-29-holerites-design.md` set to `Implementado`, and commit:

```bash
git add docs/superpowers/specs/2026-08-29-holerites-design.md
git commit -m "docs: mark holerites spec as implemented"
```
