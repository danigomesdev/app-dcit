# Cadastro de Colaborador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "+" dialog to the RH-only `/colaboradores` page that creates a new `Employee` with personal data (CPF, RG, data de nascimento, estado civil, endereço), a soft-delete "Excluir" button and a "Lixeira" (trash) section to restore or permanently delete (both delete actions confirmed via a dialog), an "Editar" dialog to change personal data after creation, CEP-based address autofill, and a CPF format validator.

**Architecture:** `Employee` gains 10 nullable personal-data columns plus `deletedAt` (soft-delete marker). A new `POST /employees` endpoint (role `rh`) generates a random `userId` server-side (decoupled from any OIDC login identity — see spec §1) and persists the record, translating a duplicate-CPF unique-constraint violation into a 409. Four more `rh`-only endpoints handle the trash lifecycle (`GET /employees/trash`, `DELETE /employees/:userId`, `PATCH /employees/:userId/restore`, `DELETE /employees/:userId/permanent`); three "active roster" queries across the codebase (employees list, presence panel, onboarding team view) are filtered to exclude soft-deleted employees, while name-lookup joins for historical records are deliberately left unfiltered. A sixth endpoint, `PATCH /employees/:userId/personal-data`, reuses `EmployeeCreateSchema` to let RH edit any personal field (including cargo and admissão) after creation. The web side extracts the 13-field form into a shared `colaborador-form-fields.tsx` component (used by both the create and edit dialogs) that also owns CEP→ViaCEP address autofill and the CPF format validator; delete/permanent-delete both route through a confirmation `<dialog>` before submitting.

**Tech Stack:** NestJS + Prisma (SQLite) for the API, Next.js App Router (Server Component + Client Component + Server Actions) for web — no new dependencies.

**Spec:** [`docs/superpowers/specs/2026-08-28-cadastro-colaborador-design.md`](../specs/2026-08-28-cadastro-colaborador-design.md)

## Global Constraints

- New `Employee` columns, all nullable, no default: `cpf String? @unique`, `rg String?`, `dataNascimento DateTime?`, `estadoCivil String?`, `enderecoRua String?`, `enderecoNumero String?`, `enderecoBairro String?`, `enderecoCidade String?`, `enderecoEstado String?`, `enderecoCep String?`, `deletedAt DateTime?` (null = ativo).
- `ESTADOS_CIVIS` (shared-types, fixed list): `["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"]`.
- `UFS` (shared-types, fixed list, the 27 Brazilian states): `["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]`.
- CPF validated as exactly 11 digits, no punctuation (`/^\d{11}$/`); CEP as exactly 8 digits (`/^\d{8}$/`); no CPF check-digit algorithm.
- `POST /employees`, `DELETE /employees/:userId`, `GET /employees/trash`, `PATCH /employees/:userId/restore`, `DELETE /employees/:userId/permanent` are all `@Roles('rh')` only — not `gestor`.
- `userId` for a newly created employee is generated server-side via `randomUUID()` from `node:crypto` — never taken from the request body.
- No masking of the new personal fields by role — `GET /employees` returns them identically to gestor and RH.
- `EmployeesService.list()`, `TimeEntriesService.listTeamToday()`, and `OnboardingService.listTeamProgress()` filter `deletedAt: null`. Every other `prisma.employee.findMany` in the codebase (documentos, benefícios, solicitações, operacional's 3 call sites) is a name-lookup join for pre-existing records and is left unfiltered — do not add the filter there, it would erase names from historical records instead of just hiding an inactive employee.
- `permanentlyDelete` must reject (400) an attempt to permanently delete an employee that isn't already soft-deleted.
- "Excluir" (soft-delete) and "Excluir permanentemente" both require confirmation via a `<dialog>` before submitting — not a native `window.confirm()`. "Restaurar" stays a direct action, no confirmation.
- `PATCH /employees/:userId/personal-data` (`@Roles('rh')`) reuses `EmployeeCreateSchema` for its body — same 13 fields as creation, including `role`/`hireDate`. No new shared-types schema needed for editing.
- CEP autofill calls `https://viacep.com.br/ws/{cep}/json/` directly from the browser (CORS-enabled, no API key) when the CEP field reaches 8 digits, on blur. On success, fills rua/bairro/cidade/estado (never número). On failure (network error or `{erro: true}`), leaves fields untouched — no error message.
- The CPF input carries the native HTML `pattern="\d{11}"` attribute (plus a `title`) for browser-native format feedback — this is in addition to, not a replacement for, the backend's `EmployeeCreateSchema` validation.
- Double-quote style in `apps/web`; single-quote in `apps/api`.

---

## File Structure

```
packages/
  shared-types/
    src/
      employee-create.ts                              # new — EmployeeCreateSchema, ESTADOS_CIVIS, UFS
      employee-create.test.ts                          # new
      index.ts                                          # modified — export new schema/types/consts
apps/
  api/
    prisma/
      schema.prisma                                     # modified — 11 new Employee columns
      migrations/<generated>_add_employee_personal_data_and_soft_delete/ # generated
    src/
      employees/
        employees.service.ts                            # modified — create(), listTrash(), softDelete(), restore(), permanentlyDelete(); list() filtered
        employees.service.spec.ts                        # modified
        employees.controller.ts                          # modified — POST /employees + 4 trash endpoints
        employees.controller.spec.ts                      # modified
      time-entries/
        time-entries.service.ts                           # modified — listTeamToday() filtered
        time-entries.service.spec.ts                       # modified
      onboarding/
        onboarding.service.ts                             # modified — listTeamProgress() filtered
        onboarding.service.spec.ts                         # modified
  web/
    src/
      app/
        (app)/
          colaboradores/
            page.tsx                                      # modified — always-visible "+" button, restructured empty state, renders LixeiraSection, widened Employee type
            actions.ts                                     # modified — createEmployee, updateEmployeePersonalData, deleteEmployee, restoreEmployee, permanentlyDeleteEmployee
            colaborador-form-fields.tsx                    # new — shared 13-field form, CEP autofill, CPF pattern (used by create + edit)
            novo-colaborador-dialog.tsx                    # new (Task 5), modified (Task 8 — reuses colaborador-form-fields)
            editar-colaborador-dialog.tsx                  # new (Task 8)
            colaboradores-row.tsx                          # modified — "Excluir" (with confirm dialog) + "Editar" buttons
            lixeira-section.tsx                            # new — Server Component, fetches + maps to LixeiraRow
            lixeira-row.tsx                                # new — Client Component, "Restaurar" + "Excluir permanentemente" (with confirm dialog)
            colaboradores.module.css                       # modified — dialog/grid/button/trash/confirm styles
    e2e/
      fake-api-server.mjs                                 # modified — serve POST/DELETE/PATCH /employees* routes
      test-session.ts                                      # modified — mockApi supports `trash`
      colaboradores.spec.ts                                # modified — new tests
```

---

### Task 1: `apps/api` — `Employee` personal-data + soft-delete columns

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Generated: `apps/api/prisma/migrations/<timestamp>_add_employee_personal_data_and_soft_delete/`

**Interfaces:**
- Consumes: nothing.
- Produces: the 11 new nullable columns on `prisma.employee`, used by Tasks 3 and 4.

- [ ] **Step 1: Update the `Employee` model in `apps/api/prisma/schema.prisma`**

Find:

```prisma
model Employee {
  userId            String   @id
  name              String
  role              String
  hireDate          DateTime
  expectedStartTime String?  // "HH:mm", 24h, América/São_Paulo. null = never "atrasado".
}
```

Replace with:

```prisma
model Employee {
  userId            String    @id
  name              String
  role              String
  hireDate          DateTime
  expectedStartTime String?   // "HH:mm", 24h, América/São_Paulo. null = never "atrasado".
  cpf               String?   @unique // 11 dígitos, sem pontuação
  rg                String?
  dataNascimento    DateTime?
  estadoCivil       String?   // "solteiro" | "casado" | "divorciado" | "viuvo" | "uniao_estavel"
  enderecoRua       String?
  enderecoNumero    String?
  enderecoBairro    String?
  enderecoCidade    String?
  enderecoEstado    String?   // UF, 2 letras
  enderecoCep       String?   // 8 dígitos, sem hífen
  deletedAt         DateTime? // null = ativo. Não-nulo = na lixeira.
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `pnpm --filter @ponto-dcit/api exec prisma migrate dev --name add_employee_personal_data_and_soft_delete`
Expected: creates `apps/api/prisma/migrations/<timestamp>_add_employee_personal_data_and_soft_delete/migration.sql`, applies it to `dev.db`, regenerates the Prisma Client.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): add personal-data and soft-delete columns to Employee"
```

---

### Task 2: `packages/shared-types` — `EmployeeCreateSchema`

**Files:**
- Create: `packages/shared-types/src/employee-create.ts`
- Test: `packages/shared-types/src/employee-create.test.ts`
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Consumes: `RoleSchema` from `./role` (already exists, exported as `"colaborador" | "gestor" | "rh"`).
- Produces: `EmployeeCreateSchema` (Zod schema), `EmployeeCreateInput` (inferred type), `ESTADOS_CIVIS`, `UFS` (readonly string-tuple consts), all exported from `@ponto-dcit/shared-types`. Task 3 imports `EmployeeCreateSchema`/`EmployeeCreateInput`; Task 5 imports `ESTADOS_CIVIS`/`UFS` for the form's `<select>` options.

- [ ] **Step 1: Write the failing test — `packages/shared-types/src/employee-create.test.ts`**

```typescript
import { EmployeeCreateSchema } from "./employee-create";

const VALID_PAYLOAD = {
  name: "Ana Colaboradora",
  role: "colaborador" as const,
  hireDate: "2026-01-15",
  cpf: "12345678901",
  rg: "1234567",
  dataNascimento: "1990-05-20",
  estadoCivil: "casado" as const,
  enderecoRua: "Rua das Flores",
  enderecoNumero: "100",
  enderecoBairro: "Centro",
  enderecoCidade: "São Paulo",
  enderecoEstado: "SP" as const,
  enderecoCep: "01310100",
};

describe("EmployeeCreateSchema", () => {
  it("accepts a fully populated valid payload", () => {
    const result = EmployeeCreateSchema.safeParse(VALID_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("accepts every personal field as null", () => {
    const result = EmployeeCreateSchema.safeParse({
      name: "Ana Colaboradora",
      role: "colaborador",
      hireDate: "2026-01-15",
      cpf: null,
      rg: null,
      dataNascimento: null,
      estadoCivil: null,
      enderecoRua: null,
      enderecoNumero: null,
      enderecoBairro: null,
      enderecoCidade: null,
      enderecoEstado: null,
      enderecoCep: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a CPF with punctuation", () => {
    const result = EmployeeCreateSchema.safeParse({
      ...VALID_PAYLOAD,
      cpf: "123.456.789-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a CPF shorter than 11 digits", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, cpf: "123456789" });
    expect(result.success).toBe(false);
  });

  it("rejects a CEP with a hyphen", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, enderecoCep: "01310-100" });
    expect(result.success).toBe(false);
  });

  it("rejects an estadoCivil outside the fixed list", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, estadoCivil: "namorando" });
    expect(result.success).toBe(false);
  });

  it("rejects an enderecoEstado that isn't a real UF", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, enderecoEstado: "ZZ" });
    expect(result.success).toBe(false);
  });

  it("rejects a role outside colaborador/gestor/rh", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, role: "admin" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const { name: _name, ...rest } = VALID_PAYLOAD;
    const result = EmployeeCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a full ISO datetime instead of a plain date for hireDate", () => {
    const result = EmployeeCreateSchema.safeParse({
      ...VALID_PAYLOAD,
      hireDate: "2026-01-15T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/shared-types test -- employee-create.test.ts`
Expected: FAIL — `Cannot find module './employee-create'`.

- [ ] **Step 3: Write `packages/shared-types/src/employee-create.ts`**

```typescript
import { z } from "zod";

import { RoleSchema } from "./role";

export const ESTADOS_CIVIS = [
  "solteiro",
  "casado",
  "divorciado",
  "viuvo",
  "uniao_estavel",
] as const;

// As 27 UFs do Brasil — lista fixa, mesmo raciocínio de ESTADOS_CIVIS: evitar
// dado sujo ("ZZ" não deve ser um estado válido).
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

export const EmployeeCreateSchema = z.object({
  name: z.string().min(1),
  role: RoleSchema,
  hireDate: z.string().date(),
  cpf: z.string().regex(/^\d{11}$/).nullable(),
  rg: z.string().min(1).nullable(),
  dataNascimento: z.string().date().nullable(),
  estadoCivil: z.enum(ESTADOS_CIVIS).nullable(),
  enderecoRua: z.string().min(1).nullable(),
  enderecoNumero: z.string().min(1).nullable(),
  enderecoBairro: z.string().min(1).nullable(),
  enderecoCidade: z.string().min(1).nullable(),
  enderecoEstado: z.enum(UFS).nullable(),
  enderecoCep: z.string().regex(/^\d{8}$/).nullable(),
});
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateSchema>;
```

- [ ] **Step 4: Update `packages/shared-types/src/index.ts`**

Add these lines (keep everything else in the file as-is):

```typescript
export { EmployeeCreateSchema, ESTADOS_CIVIS, UFS } from "./employee-create";
export type { EmployeeCreateInput } from "./employee-create";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/shared-types test -- employee-create.test.ts`
Expected: PASS — 10 tests green.

- [ ] **Step 6: Build the package**

Run: `pnpm --filter @ponto-dcit/shared-types run build`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types
git commit -m "feat(shared-types): add EmployeeCreateSchema"
```

---

### Task 3: `apps/api` — `POST /employees`

**Files:**
- Modify: `apps/api/src/employees/employees.service.ts`
- Modify: `apps/api/src/employees/employees.service.spec.ts`
- Modify: `apps/api/src/employees/employees.controller.ts`
- Modify: `apps/api/src/employees/employees.controller.spec.ts`

**Interfaces:**
- Consumes: `EmployeeCreateSchema`/`EmployeeCreateInput` from `@ponto-dcit/shared-types` (Task 2); the 11 new columns on `prisma.employee` (Task 1); `AuthGuard`/`RolesGuard`/`Roles` from `../auth/*` (already used elsewhere in this file).
- Produces: `EmployeesService.create(input: EmployeeCreateInput)` (throws `ConflictException` on duplicate CPF); `POST /employees` (`@Roles('rh')`). Task 5 (web) calls `POST /employees` over HTTP. Task 4 adds more methods/routes to these same files — read the result of this task before starting Task 4.

- [ ] **Step 1: Write the failing tests — append to `apps/api/src/employees/employees.service.spec.ts`**

Read the current file first. Change the `afterAll` from:

```typescript
  afterAll(async () => {
    await prisma.employee.deleteMany({
      where: { userId: { in: ['emp-b', 'emp-a', 'emp-schedule'] } },
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
    await prisma.employee.deleteMany({
      where: { cpf: { in: ['11111111111', '22222222222'] } },
    });
    await prisma.onModuleDestroy();
  });
```

Then add this `describe` block at the end of the file, inside the outer `describe('EmployeesService', ...)` (immediately before its closing `});`):

```typescript
  describe('create', () => {
    it('persists a new employee with a generated userId and all personal fields populated', async () => {
      const created = await service.create({
        name: 'Carlos Novo',
        role: 'colaborador',
        hireDate: '2026-01-15',
        cpf: '11111111111',
        rg: '1234567',
        dataNascimento: '1990-05-20',
        estadoCivil: 'casado',
        enderecoRua: 'Rua das Flores',
        enderecoNumero: '100',
        enderecoBairro: 'Centro',
        enderecoCidade: 'São Paulo',
        enderecoEstado: 'SP',
        enderecoCep: '01310100',
      });

      expect(created.userId).toHaveLength(36); // uuid
      expect(created.name).toBe('Carlos Novo');
      expect(created.cpf).toBe('11111111111');
      expect(created.dataNascimento?.toISOString()).toBe('1990-05-20T00:00:00.000Z');
      expect(created.estadoCivil).toBe('casado');
      expect(created.enderecoEstado).toBe('SP');

      const found = await prisma.employee.findUnique({ where: { userId: created.userId } });
      expect(found?.cpf).toBe('11111111111');
    });

    it('persists a new employee with every personal field null', async () => {
      const created = await service.create({
        name: 'Debora Sem Dados',
        role: 'colaborador',
        hireDate: '2026-02-01',
        cpf: null,
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      });

      expect(created.cpf).toBeNull();
      expect(created.dataNascimento).toBeNull();

      await prisma.employee.delete({ where: { userId: created.userId } });
    });

    it('throws ConflictException when a second employee reuses an existing CPF', async () => {
      await service.create({
        name: 'Primeiro',
        role: 'colaborador',
        hireDate: '2026-01-01',
        cpf: '22222222222',
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      });

      await expect(
        service.create({
          name: 'Segundo',
          role: 'colaborador',
          hireDate: '2026-01-02',
          cpf: '22222222222',
          rg: null,
          dataNascimento: null,
          estadoCivil: null,
          enderecoRua: null,
          enderecoNumero: null,
          enderecoBairro: null,
          enderecoCidade: null,
          enderecoEstado: null,
          enderecoCep: null,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
```

Add this import to the top of the file:

```typescript
import { ConflictException } from '@nestjs/common';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ponto-dcit/api test -- employees.service.spec.ts`
Expected: FAIL — `service.create is not a function`.

- [ ] **Step 3: Implement in `apps/api/src/employees/employees.service.ts`**

Replace the whole file with:

```typescript
import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmployeeCreateInput, EmployeeScheduleUpdate } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
    });
  }

  updateSchedule(userId: string, input: EmployeeScheduleUpdate) {
    return this.prisma.employee.update({
      where: { userId },
      data: { expectedStartTime: input.expectedStartTime },
    });
  }

  async create(input: EmployeeCreateInput) {
    try {
      return await this.prisma.employee.create({
        data: {
          userId: randomUUID(),
          name: input.name,
          role: input.role,
          hireDate: new Date(input.hireDate),
          cpf: input.cpf,
          rg: input.rg,
          dataNascimento: input.dataNascimento ? new Date(input.dataNascimento) : null,
          estadoCivil: input.estadoCivil,
          enderecoRua: input.enderecoRua,
          enderecoNumero: input.enderecoNumero,
          enderecoBairro: input.enderecoBairro,
          enderecoCidade: input.enderecoCidade,
          enderecoEstado: input.enderecoEstado,
          enderecoCep: input.enderecoCep,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um colaborador cadastrado com esse CPF.');
      }
      throw error;
    }
  }
}
```

`list()`'s explicit `select` is removed — it would need updating every time a new personal field is added, and returning the full row is already the pattern used by other `findMany` calls in this codebase. Task 4 will add a `where` clause to this same method — don't add one now, that's a separate reviewable change.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ponto-dcit/api test -- employees.service.spec.ts`
Expected: PASS — all tests green, including the pre-existing `list`/`updateSchedule` tests (unaffected).

- [ ] **Step 5: Write the failing tests — append to `apps/api/src/employees/employees.controller.spec.ts`**

Read the current file first. Add this test inside `describe('EmployeesController guard metadata', ...)`, immediately after the existing `updateSchedule` guard test and before that block's closing `});`:

```typescript
  it('applies AuthGuard and RolesGuard to create, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.create,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.create,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });
```

In the behavioral `describe('EmployeesController', ...)` block, change `serviceMock` from:

```typescript
  const serviceMock = { list: jest.fn(), updateSchedule: jest.fn() };
```

to:

```typescript
  const serviceMock = { list: jest.fn(), updateSchedule: jest.fn(), create: jest.fn() };
```

Then add these tests inside that same `describe` block, after the existing `updateSchedule` tests:

```typescript
  const VALID_CREATE_BODY = {
    name: 'Ana Colaboradora',
    role: 'colaborador',
    hireDate: '2026-01-15',
    cpf: null,
    rg: null,
    dataNascimento: null,
    estadoCivil: null,
    enderecoRua: null,
    enderecoNumero: null,
    enderecoBairro: null,
    enderecoCidade: null,
    enderecoEstado: null,
    enderecoCep: null,
  };

  it('creates an employee with a valid payload', async () => {
    serviceMock.create.mockResolvedValue({ userId: 'generated-id', ...VALID_CREATE_BODY });

    await controller.create(VALID_CREATE_BODY);

    expect(serviceMock.create).toHaveBeenCalledWith(VALID_CREATE_BODY);
  });

  it('rejects an invalid payload before calling the service', async () => {
    await expect(
      controller.create({ ...VALID_CREATE_BODY, role: 'admin' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  it('rejects a payload missing required fields', async () => {
    await expect(controller.create({})).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm --filter @ponto-dcit/api test -- employees.controller.spec.ts`
Expected: FAIL — `controller.create is not a function`.

- [ ] **Step 7: Implement in `apps/api/src/employees/employees.controller.ts`**

Replace the whole file with:

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EmployeeCreateSchema, EmployeeScheduleUpdateSchema } from '@ponto-dcit/shared-types';
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
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const result = EmployeeCreateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.create(result.data);
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
Expected: PASS — all tests green, including the pre-existing `list`/`updateSchedule` tests (unaffected).

- [ ] **Step 9: Run the full API test suite**

Run: `pnpm --filter @ponto-dcit/api run test`
Expected: PASS — every spec green.

- [ ] **Step 10: Lint (scoped to the files this task touched)**

Run: `pnpm --filter @ponto-dcit/api exec eslint src/employees/employees.service.ts src/employees/employees.service.spec.ts src/employees/employees.controller.ts src/employees/employees.controller.spec.ts --fix`
Expected: no errors. Do not run a blanket `--fix` over the whole `src` tree — a prior plan's task did that and reformatted unrelated files, which had to be reverted.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/employees
git commit -m "feat(api): add POST /employees to register a new colaborador"
```

---

### Task 4: `apps/api` — exclusão lógica (lixeira)

**Files:**
- Modify: `apps/api/src/employees/employees.service.ts`
- Modify: `apps/api/src/employees/employees.service.spec.ts`
- Modify: `apps/api/src/employees/employees.controller.ts`
- Modify: `apps/api/src/employees/employees.controller.spec.ts`
- Modify: `apps/api/src/time-entries/time-entries.service.ts`
- Modify: `apps/api/src/time-entries/time-entries.service.spec.ts`
- Modify: `apps/api/src/onboarding/onboarding.service.ts`
- Modify: `apps/api/src/onboarding/onboarding.service.spec.ts`

**Interfaces:**
- Consumes: the `deletedAt` column on `prisma.employee` (Task 1); the `EmployeesService`/`EmployeesController` shape left by Task 3 (this task adds to the same files, so Task 3 must be complete first).
- Produces: `EmployeesService.listTrash()`, `.softDelete(userId)`, `.restore(userId)`, `.permanentlyDelete(userId)`; `GET /employees/trash`, `DELETE /employees/:userId`, `PATCH /employees/:userId/restore`, `DELETE /employees/:userId/permanent` (all `@Roles('rh')`). `list()` and two other services' active-roster queries now exclude soft-deleted employees. Task 6 (web) calls all four new routes over HTTP.

- [ ] **Step 1: Write the failing tests — append to `apps/api/src/employees/employees.service.spec.ts`**

Read the current file first (it now has the `create` describe block from Task 3). Add this import to the top:

```typescript
import { BadRequestException } from '@nestjs/common';
```

(alongside the existing `import { ConflictException } from '@nestjs/common';` — combine into one import statement: `import { BadRequestException, ConflictException } from '@nestjs/common';`).

Add this `describe` block at the end of the file, inside the outer `describe('EmployeesService', ...)` (immediately before its closing `});`):

```typescript
  describe('listTrash / softDelete / restore / permanentlyDelete', () => {
    it('excludes a soft-deleted employee from list() and includes it in listTrash()', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-trash-a',
          name: 'Trash Ana',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      await service.softDelete('emp-trash-a');

      const active = await service.list();
      expect(active.find((e) => e.userId === 'emp-trash-a')).toBeUndefined();

      const trashed = await service.listTrash();
      const found = trashed.find((e) => e.userId === 'emp-trash-a');
      expect(found).toBeDefined();
      expect(found?.deletedAt).not.toBeNull();
    });

    it('restores a soft-deleted employee back into list() and out of listTrash()', async () => {
      await service.restore('emp-trash-a');

      const active = await service.list();
      expect(active.find((e) => e.userId === 'emp-trash-a')).toBeDefined();

      const trashed = await service.listTrash();
      expect(trashed.find((e) => e.userId === 'emp-trash-a')).toBeUndefined();
    });

    it('permanently deletes an employee that is already in the trash', async () => {
      await service.softDelete('emp-trash-a');

      await service.permanentlyDelete('emp-trash-a');

      const found = await prisma.employee.findUnique({ where: { userId: 'emp-trash-a' } });
      expect(found).toBeNull();
    });

    it('throws BadRequestException when permanently deleting an active (non-trashed) employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-trash-b',
          name: 'Trash Beto',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      await expect(service.permanentlyDelete('emp-trash-b')).rejects.toThrow(
        BadRequestException,
      );

      await prisma.employee.delete({ where: { userId: 'emp-trash-b' } });
    });

    it('throws BadRequestException when permanently deleting a userId that does not exist', async () => {
      await expect(service.permanentlyDelete('emp-does-not-exist')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
```

Note: `emp-trash-a` is permanently deleted by the third test in this block, so it never needs to appear in the file's `afterAll` cleanup list — the test suite leaves it already gone. `emp-trash-b` is deleted inline at the end of its own test.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ponto-dcit/api test -- employees.service.spec.ts`
Expected: FAIL — `service.softDelete is not a function`.

- [ ] **Step 3: Implement in `apps/api/src/employees/employees.service.ts`**

Read the current file first (from Task 3). Change `list()` from:

```typescript
  list() {
    return this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
    });
  }
```

to:

```typescript
  list() {
    return this.prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  listTrash() {
    return this.prisma.employee.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  softDelete(userId: string) {
    return this.prisma.employee.update({
      where: { userId },
      data: { deletedAt: new Date() },
    });
  }

  restore(userId: string) {
    return this.prisma.employee.update({
      where: { userId },
      data: { deletedAt: null },
    });
  }

  async permanentlyDelete(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee || employee.deletedAt === null) {
      throw new BadRequestException(
        'Só é possível excluir permanentemente um colaborador que já está na lixeira.',
      );
    }
    await this.prisma.employee.delete({ where: { userId } });
  }
```

(Insert these new methods right after `list()`, before `updateSchedule`. Add `BadRequestException` to the existing `@nestjs/common` import line at the top of the file.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ponto-dcit/api test -- employees.service.spec.ts`
Expected: PASS — all tests green, including Task 3's `create` tests (unaffected).

- [ ] **Step 5: Write the failing tests — append to `apps/api/src/employees/employees.controller.spec.ts`**

Read the current file first (from Task 3). Add these 4 tests inside `describe('EmployeesController guard metadata', ...)`, immediately after the `create` guard test and before that block's closing `});`:

```typescript
  it('applies AuthGuard and RolesGuard to listTrash, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.listTrash,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.listTrash,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('applies AuthGuard and RolesGuard to softDelete, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.softDelete,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.softDelete,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('applies AuthGuard and RolesGuard to restore, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.restore,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.restore,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('applies AuthGuard and RolesGuard to permanentlyDelete, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.permanentlyDelete,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.permanentlyDelete,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });
```

In the behavioral `describe('EmployeesController', ...)` block, change `serviceMock` from:

```typescript
  const serviceMock = { list: jest.fn(), updateSchedule: jest.fn(), create: jest.fn() };
```

to:

```typescript
  const serviceMock = {
    list: jest.fn(),
    updateSchedule: jest.fn(),
    create: jest.fn(),
    listTrash: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    permanentlyDelete: jest.fn(),
  };
```

Then add these tests inside that same `describe` block, at the end:

```typescript
  it('lists trashed employees', async () => {
    serviceMock.listTrash.mockResolvedValue([{ userId: 'user-1', deletedAt: new Date() }]);

    const result = await controller.listTrash();

    expect(result).toHaveLength(1);
    expect(serviceMock.listTrash).toHaveBeenCalledWith();
  });

  it('soft-deletes an employee', async () => {
    serviceMock.softDelete.mockResolvedValue(undefined);

    await controller.softDelete('user-1');

    expect(serviceMock.softDelete).toHaveBeenCalledWith('user-1');
  });

  it('restores an employee', async () => {
    serviceMock.restore.mockResolvedValue({ userId: 'user-1', deletedAt: null });

    await controller.restore('user-1');

    expect(serviceMock.restore).toHaveBeenCalledWith('user-1');
  });

  it('permanently deletes an employee', async () => {
    serviceMock.permanentlyDelete.mockResolvedValue(undefined);

    await controller.permanentlyDelete('user-1');

    expect(serviceMock.permanentlyDelete).toHaveBeenCalledWith('user-1');
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm --filter @ponto-dcit/api test -- employees.controller.spec.ts`
Expected: FAIL — `controller.listTrash is not a function`.

- [ ] **Step 7: Implement in `apps/api/src/employees/employees.controller.ts`**

Read the current file first (from Task 3). Add these imports to the existing `@nestjs/common` import line: `Delete`. Add `EmployeeScheduleUpdateSchema` stays as-is. Add these 4 methods after `create` and before `updateSchedule`:

```typescript
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Get('trash')
  listTrash() {
    return this.employees.listTrash();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Delete(':userId')
  @HttpCode(204)
  async softDelete(@Param('userId') userId: string) {
    await this.employees.softDelete(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Patch(':userId/restore')
  restore(@Param('userId') userId: string) {
    return this.employees.restore(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Delete(':userId/permanent')
  @HttpCode(204)
  async permanentlyDelete(@Param('userId') userId: string) {
    await this.employees.permanentlyDelete(userId);
  }
```

The full updated import line at the top of the file should read:

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
  UseGuards,
} from '@nestjs/common';
```

`@Get('trash')` is declared before any `@Get(':userId')`-shaped route would be (there is none in this controller), so there's no ambiguity with Nest's routing. `:userId/restore` and `:userId/permanent` are distinct path shapes from bare `:userId`, so `DELETE /employees/abc` (soft-delete) and `DELETE /employees/abc/permanent` never collide.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @ponto-dcit/api test -- employees.controller.spec.ts`
Expected: PASS — all tests green.

- [ ] **Step 9: Write the failing test — append to `apps/api/src/time-entries/time-entries.service.spec.ts`**

Read the current file first. Inside the existing `describe('listTeamToday status derivation', ...)` block, add this test (it uses the file's own `baseEmployee` helper and `WEEKDAY_NOON_SP` constant already defined in that block):

```typescript
    it('excludes a soft-deleted employee entirely from the results', async () => {
      jest.useFakeTimers().setSystemTime(WEEKDAY_NOON_SP);
      await prisma.employee.create({
        data: { ...baseEmployee('presence-deleted'), deletedAt: new Date('2026-08-01') },
      });

      const results = await service.listTeamToday();

      expect(results.find((r) => r.userId === 'presence-deleted')).toBeUndefined();
    });
```

Add `'presence-deleted'` to this file's `afterAll` employee-id cleanup list (find the array of ids like `'presence-folga-sat'`, `'presence-atrasado'`, etc. and add `'presence-deleted'` to it).

- [ ] **Step 10: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/api test -- time-entries.service.spec.ts`
Expected: FAIL — the soft-deleted employee still appears in the results.

- [ ] **Step 11: Implement in `apps/api/src/time-entries/time-entries.service.ts`**

Read the current file first. Inside `listTeamToday()`, change:

```typescript
    const employees = await this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
    });
```

to:

```typescript
    const employees = await this.prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/api test -- time-entries.service.spec.ts`
Expected: PASS — all tests green, including every pre-existing status-derivation test (unaffected — none of them set `deletedAt`, so they default to `null`/active).

- [ ] **Step 13: Write the failing test — append to `apps/api/src/onboarding/onboarding.service.spec.ts`**

Read the current file first. Add this test at the end of the file, inside the outer `describe('OnboardingService', ...)` (before its closing `});`):

```typescript
  it('excludes a soft-deleted employee from listTeamProgress', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-e',
        name: 'Elisa Excluida',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
        deletedAt: new Date('2026-08-01'),
      },
    });

    const results = await service.listTeamProgress();

    expect(results.find((r) => r.userId === 'user-e')).toBeUndefined();
  });
```

Change the `afterAll` from:

```typescript
  afterAll(async () => {
    await prisma.onboardingProgress.deleteMany();
    await prisma.onboardingTask.deleteMany();
    await prisma.employee.deleteMany({
      where: { userId: { in: ['user-c', 'user-d'] } },
    });
    await prisma.onModuleDestroy();
  });
```

to:

```typescript
  afterAll(async () => {
    await prisma.onboardingProgress.deleteMany();
    await prisma.onboardingTask.deleteMany();
    await prisma.employee.deleteMany({
      where: { userId: { in: ['user-c', 'user-d', 'user-e'] } },
    });
    await prisma.onModuleDestroy();
  });
```

- [ ] **Step 14: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/api test -- onboarding.service.spec.ts`
Expected: FAIL — the soft-deleted employee still appears in the results.

- [ ] **Step 15: Implement in `apps/api/src/onboarding/onboarding.service.ts`**

Read the current file first. Inside `listTeamProgress()`, change:

```typescript
      this.prisma.employee.findMany(),
```

to:

```typescript
      this.prisma.employee.findMany({ where: { deletedAt: null } }),
```

(This is the second element of the `Promise.all([...])` array — the one with no arguments today.)

- [ ] **Step 16: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/api test -- onboarding.service.spec.ts`
Expected: PASS — all tests green, including every pre-existing test (unaffected).

- [ ] **Step 17: Run the full API test suite**

Run: `pnpm --filter @ponto-dcit/api run test`
Expected: PASS — every spec green.

- [ ] **Step 18: Lint (scoped to the files this task touched)**

Run: `pnpm --filter @ponto-dcit/api exec eslint src/employees/employees.service.ts src/employees/employees.service.spec.ts src/employees/employees.controller.ts src/employees/employees.controller.spec.ts src/time-entries/time-entries.service.ts src/time-entries/time-entries.service.spec.ts src/onboarding/onboarding.service.ts src/onboarding/onboarding.service.spec.ts --fix`
Expected: no errors. Do not run a blanket `--fix` over the whole `src` tree.

- [ ] **Step 19: Commit**

```bash
git add apps/api/src/employees apps/api/src/time-entries apps/api/src/onboarding
git commit -m "feat(api): add exclusão lógica (soft delete, restore, trash) for Employee"
```

---

### Task 5: `apps/web` — shared form fields + "+" dialog on `/colaboradores`

**Files:**
- Modify: `apps/web/src/app/(app)/colaboradores/page.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/actions.ts`
- Create: `apps/web/src/app/(app)/colaboradores/colaborador-form-fields.tsx`
- Create: `apps/web/src/app/(app)/colaboradores/novo-colaborador-dialog.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/colaboradores.module.css`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Modify: `apps/web/e2e/colaboradores.spec.ts`

**Interfaces:**
- Consumes: `ESTADOS_CIVIS`, `UFS` from `@ponto-dcit/shared-types` (Task 2); `apiFetch` from `@/lib/api`. Calls `POST /employees` (Task 3) over HTTP and `https://viacep.com.br/ws/{cep}/json/` directly from the browser.
- Produces: `ColaboradorFormFields` (the shared 13-field form component) and `ColaboradorFormDefaults` (its prop type), both exported from `colaborador-form-fields.tsx` — **Task 8 imports both** for the edit dialog, so their names and shape must match exactly what's built here. The "+" button and create dialog on `/colaboradores`.

- [ ] **Step 1: Rewrite `apps/web/src/app/(app)/colaboradores/page.tsx`**

Read the current file first. The empty-state branch currently replaces the entire page (heading included) when there are zero employees — that would make it impossible to ever add the first one. Replace the whole file with:

```tsx
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ColaboradoresRow } from "./colaboradores-row";
import { NovoColaboradorDialog } from "./novo-colaborador-dialog";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  role: "colaborador" | "gestor" | "rh";
  hireDate: string;
  expectedStartTime: string | null;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCidade: string | null;
  enderecoEstado: string | null;
  enderecoCep: string | null;
};

export default async function ColaboradoresPage() {
  const session = await getSession();
  if (!session || session.role !== "rh") {
    return <EmptyState title="Sem permissão" description="Esta página é restrita ao RH." />;
  }

  const employees = await apiFetchJson<Employee[]>("/employees");

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Colaboradores</h1>
        <NovoColaboradorDialog />
      </div>
      <p className={styles.subheading}>
        Defina o horário esperado de entrada de cada colaborador — usado para marcá-lo como
        atrasado no painel de presença.
      </p>
      {employees.length === 0 ? (
        <p className={styles.subheading}>Nenhum colaborador cadastrado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {employees.map((employee) => (
            <ColaboradoresRow key={employee.userId} employee={employee} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

The `Employee` type is widened to the full personal-data shape now (not just `userId`/`name`/`expectedStartTime`) because Task 8's edit dialog needs it — `GET /employees` already returns the full row (Task 3), this is purely a TypeScript-side change. `colaboradores-row.tsx` isn't touched by this task (that happens in Task 6 and again in Task 8) — it currently only destructures `userId`/`name`/`expectedStartTime` from its `employee` prop, so passing it a wider object is compatible without any change on its end.

- [ ] **Step 2: Add `createEmployee` to `apps/web/src/app/(app)/colaboradores/actions.ts`**

Read the current file first. Append this to the end (keep the existing `updateSchedule` export as-is):

```typescript
export type CreateEmployeeState = { error: string | null; success: boolean };

const OPTIONAL_FIELDS = [
  "cpf",
  "rg",
  "dataNascimento",
  "estadoCivil",
  "enderecoRua",
  "enderecoNumero",
  "enderecoBairro",
  "enderecoCidade",
  "enderecoEstado",
  "enderecoCep",
] as const;

export async function createEmployee(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const name = formData.get("name");
  const role = formData.get("role");
  const hireDate = formData.get("hireDate");
  if (typeof name !== "string" || typeof role !== "string" || typeof hireDate !== "string") {
    return { error: "Dados do formulário inválidos.", success: false };
  }

  const payload: Record<string, string | null> = { name, role, hireDate };
  for (const field of OPTIONAL_FIELDS) {
    const value = formData.get(field);
    payload[field] = typeof value === "string" && value !== "" ? value : null;
  }

  const res = await apiFetch("/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 409) {
      return { error: "Já existe um colaborador cadastrado com esse CPF.", success: false };
    }
    return { error: `Não foi possível salvar (código ${res.status}).`, success: false };
  }

  revalidatePath("/colaboradores");
  return { error: null, success: true };
}
```

`OPTIONAL_FIELDS` and `CreateEmployeeState` are exported/module-level so Task 8 can reuse both for the edit action rather than redefining them.

- [ ] **Step 3: Write `apps/web/src/app/(app)/colaboradores/colaborador-form-fields.tsx`**

This is the 13-field form, shared between the create dialog (this task) and the edit dialog (Task 8). It owns the CEP→ViaCEP autofill and the CPF format validator.

```tsx
"use client";

import { useRef } from "react";
import { ESTADOS_CIVIS, UFS } from "@ponto-dcit/shared-types";

import styles from "./colaboradores.module.css";

const ESTADO_CIVIL_LABELS: Record<(typeof ESTADOS_CIVIS)[number], string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União estável",
};

export type ColaboradorFormDefaults = {
  name: string;
  role: "colaborador" | "gestor" | "rh";
  hireDate: string;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCidade: string | null;
  enderecoEstado: string | null;
  enderecoCep: string | null;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export function ColaboradorFormFields({ defaults }: { defaults: ColaboradorFormDefaults }) {
  const ruaRef = useRef<HTMLInputElement>(null);
  const bairroRef = useRef<HTMLInputElement>(null);
  const cidadeRef = useRef<HTMLInputElement>(null);
  const estadoRef = useRef<HTMLSelectElement>(null);

  async function handleCepBlur(rawCep: string) {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) {
      return;
    }
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) {
        return;
      }
      const data: ViaCepResponse = await res.json();
      if (data.erro) {
        return;
      }
      if (ruaRef.current && data.logradouro) ruaRef.current.value = data.logradouro;
      if (bairroRef.current && data.bairro) bairroRef.current.value = data.bairro;
      if (cidadeRef.current && data.localidade) cidadeRef.current.value = data.localidade;
      if (estadoRef.current && data.uf) estadoRef.current.value = data.uf;
    } catch {
      // Network failure: leave the address fields exactly as the user left them.
    }
  }

  return (
    <div className={styles.fieldGrid}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Nome</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaults.name}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Cargo</span>
        <select name="role" required defaultValue={defaults.role} className={styles.fieldSelect}>
          <option value="colaborador">Colaborador</option>
          <option value="gestor">Gestor</option>
          <option value="rh">RH</option>
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Data de admissão</span>
        <input
          type="date"
          name="hireDate"
          required
          defaultValue={defaults.hireDate}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>CPF</span>
        <input
          type="text"
          name="cpf"
          placeholder="11 dígitos"
          pattern="\d{11}"
          title="CPF deve ter exatamente 11 dígitos, sem pontuação"
          defaultValue={defaults.cpf ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>RG</span>
        <input
          type="text"
          name="rg"
          defaultValue={defaults.rg ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Data de nascimento</span>
        <input
          type="date"
          name="dataNascimento"
          defaultValue={defaults.dataNascimento ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Estado civil</span>
        <select
          name="estadoCivil"
          defaultValue={defaults.estadoCivil ?? ""}
          className={styles.fieldSelect}
        >
          <option value="">—</option>
          {ESTADOS_CIVIS.map((value) => (
            <option key={value} value={value}>
              {ESTADO_CIVIL_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Rua</span>
        <input
          ref={ruaRef}
          type="text"
          name="enderecoRua"
          defaultValue={defaults.enderecoRua ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Número</span>
        <input
          type="text"
          name="enderecoNumero"
          defaultValue={defaults.enderecoNumero ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Bairro</span>
        <input
          ref={bairroRef}
          type="text"
          name="enderecoBairro"
          defaultValue={defaults.enderecoBairro ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Cidade</span>
        <input
          ref={cidadeRef}
          type="text"
          name="enderecoCidade"
          defaultValue={defaults.enderecoCidade ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Estado (UF)</span>
        <select
          ref={estadoRef}
          name="enderecoEstado"
          defaultValue={defaults.enderecoEstado ?? ""}
          className={styles.fieldSelect}
        >
          <option value="">—</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>CEP</span>
        <input
          type="text"
          name="enderecoCep"
          placeholder="8 dígitos"
          defaultValue={defaults.enderecoCep ?? ""}
          onBlur={(e) => handleCepBlur(e.target.value)}
          className={styles.fieldInput}
        />
      </label>
    </div>
  );
}
```

Note: only the CPF field carries `pattern`/`title` (per the plan's Global Constraints — CEP has no native-validation requirement in this plan, only CPF does).

- [ ] **Step 4: Write `apps/web/src/app/(app)/colaboradores/novo-colaborador-dialog.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";

import { createEmployee } from "./actions";
import { ColaboradorFormFields, type ColaboradorFormDefaults } from "./colaborador-form-fields";
import styles from "./colaboradores.module.css";

const EMPTY_DEFAULTS: ColaboradorFormDefaults = {
  name: "",
  role: "colaborador",
  hireDate: "",
  cpf: null,
  rg: null,
  dataNascimento: null,
  estadoCivil: null,
  enderecoRua: null,
  enderecoNumero: null,
  enderecoBairro: null,
  enderecoCidade: null,
  enderecoEstado: null,
  enderecoCep: null,
};

export function NovoColaboradorDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createEmployee, {
    error: null,
    success: false,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        className={styles.addButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        + Novo colaborador
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Novo colaborador</p>
        <form ref={formRef} action={formAction}>
          <ColaboradorFormFields defaults={EMPTY_DEFAULTS} />
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
              Cadastrar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
```

- [ ] **Step 5: Add dialog/grid/button styles to `apps/web/src/app/(app)/colaboradores/colaboradores.module.css`**

Read the current file first. Append these classes to the end of the file:

```css
.headingRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.addButton {
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

.addButton:hover {
  opacity: 0.85;
}

.dialog {
  margin: auto;
  border: none;
  border-radius: 12px;
  padding: 24px;
  width: min(640px, calc(100vw - 48px));
  max-height: 85vh;
  overflow-y: auto;
  background: var(--color-background);
  color: var(--color-text);
}

.dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}

.dialogTitle {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
}

.dialogActions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.dialogClose {
  appearance: none;
  border: 1px solid var(--color-background-selected);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
}

.dialogClose:hover {
  background: var(--color-background-selected);
}

.fieldGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fieldLabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.fieldInput,
.fieldSelect {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-background-selected);
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
}
```

- [ ] **Step 6: Add the `POST /employees` handler to `apps/web/e2e/fake-api-server.mjs`**

Read the current file first. Add this branch near the existing `PATCH /employees/:userId` branch, before the final 404 fallback:

```javascript
  if (req.method === "POST" && url.pathname === "/employees") {
    return sendJson(res, 201, { userId: "generated-employee-id", ...body });
  }
```

- [ ] **Step 7: Write the new tests — append to `apps/web/e2e/colaboradores.spec.ts`**

Read the current file first. Add these tests at the end of the file:

```typescript
test("the add-colaborador button is visible even with an empty roster", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.goto("/colaboradores");

  await expect(page.getByText("Nenhum colaborador cadastrado ainda.")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Novo colaborador" })).toBeVisible();
});

test("opens the dialog and creates a new colaborador with the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Nome").fill("Fabio Novo");
  await page.getByLabel("Data de admissão").fill("2026-03-01");
  await page.getByLabel("CPF").fill("98765432100");
  await page.getByLabel("Estado civil").selectOption("solteiro");
  await page.getByLabel("Estado (UF)").selectOption("RJ");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/employees")?.body;
    })
    .toEqual({
      name: "Fabio Novo",
      role: "colaborador",
      hireDate: "2026-03-01",
      cpf: "98765432100",
      rg: null,
      dataNascimento: null,
      estadoCivil: "solteiro",
      enderecoRua: null,
      enderecoNumero: null,
      enderecoBairro: null,
      enderecoCidade: null,
      enderecoEstado: "RJ",
      enderecoCep: null,
    });
});

test("a duplicate CPF shows an inline error without closing the dialog", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/employees",
    status: 409,
    response: { message: "Já existe um colaborador cadastrado com esse CPF." },
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();
  await page.getByLabel("Nome").fill("Duplicado");
  await page.getByLabel("Data de admissão").fill("2026-03-01");
  await page.getByLabel("CPF").fill("11111111111");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(
    page.getByText("Já existe um colaborador cadastrado com esse CPF.")
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("filling a CEP autofills the address from ViaCEP", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.route("https://viacep.com.br/ws/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        logradouro: "Rua das Flores",
        bairro: "Centro",
        localidade: "São Paulo",
        uf: "SP",
      }),
    })
  );

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();
  await page.getByLabel("CEP").fill("01310100");
  await page.getByLabel("CEP").blur();

  await expect(page.getByLabel("Rua")).toHaveValue("Rua das Flores");
  await expect(page.getByLabel("Bairro")).toHaveValue("Centro");
  await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
  await expect(page.getByLabel("Estado (UF)")).toHaveValue("SP");
});

test("a CEP not found by ViaCEP leaves the address fields unchanged", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.route("https://viacep.com.br/ws/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ erro: true }),
    })
  );

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();
  await page.getByLabel("Rua").fill("Endereço Manual");
  await page.getByLabel("CEP").fill("00000000");
  await page.getByLabel("CEP").blur();

  await expect(page.getByLabel("Rua")).toHaveValue("Endereço Manual");
});
```

- [ ] **Step 8: Run the build to catch type errors**

Run: `pnpm --filter @ponto-dcit/web run build`
Expected: succeeds.

- [ ] **Step 9: Run the e2e suite**

Run: `pnpm --filter @ponto-dcit/web run test`
Expected: PASS — every suite green, including the 5 new tests and the 6 pre-existing `colaboradores.spec.ts` tests (unaffected). If port 3000/3001 are already bound by a leftover process, free them first.

- [ ] **Step 10: Lint**

Run: `pnpm --filter @ponto-dcit/web run lint`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/'(app)'/colaboradores apps/web/e2e
git commit -m "feat(web): add a dialog to register a new colaborador, with CEP autofill and CPF validation"
```

---

### Task 6: `apps/web` — "Excluir" button (with confirmation) + "Lixeira" section

**Files:**
- Modify: `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/actions.ts`
- Create: `apps/web/src/app/(app)/colaboradores/lixeira-section.tsx`
- Create: `apps/web/src/app/(app)/colaboradores/lixeira-row.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/page.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/colaboradores.module.css`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Modify: `apps/web/e2e/test-session.ts`
- Modify: `apps/web/e2e/colaboradores.spec.ts`

**Interfaces:**
- Consumes: `apiFetch`/`apiFetchJson` from `@/lib/api`. Calls `DELETE /employees/:userId`, `GET /employees/trash`, `PATCH /employees/:userId/restore`, `DELETE /employees/:userId/permanent` (Task 4) over HTTP. Reuses `.dialog`/`.dialogTitle`/`.dialogActions`/`.dialogClose` CSS classes from Task 5 — no new dialog-shell CSS needed in this task.
- Produces: the "Excluir" button (with confirmation) per row and the "Lixeira" section. Task 8 modifies `colaboradores-row.tsx` again to add an "Editar" button — read this task's result before starting Task 8.

- [ ] **Step 1: Rewrite `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`**

Read the current file first (still the pre-existing version — Task 5 didn't touch this file). Replace the whole file with:

```tsx
"use client";

import { useActionState, useRef } from "react";

import { deleteEmployee, updateSchedule } from "./actions";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  expectedStartTime: string | null;
};

export function ColaboradoresRow({ employee }: { employee: Employee }) {
  const [state, formAction, pending] = useActionState(updateSchedule, { error: null });
  const confirmDeleteRef = useRef<HTMLDialogElement>(null);

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
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => confirmDeleteRef.current?.showModal()}
      >
        Excluir
      </button>
      {state.error ? <span className={styles.error}>{state.error}</span> : null}

      <dialog ref={confirmDeleteRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Excluir {employee.name}?</p>
        <p className={styles.subheading}>
          Ele irá para a lixeira e poderá ser restaurado depois.
        </p>
        <form action={deleteEmployee}>
          <input type="hidden" name="userId" value={employee.userId} />
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

Note this reintroduces `Employee` as a narrow type (`userId`/`name`/`expectedStartTime`) even though `page.tsx` (Task 5) now passes a wider object — TypeScript structural typing allows this (the wider object satisfies the narrower prop type). Task 8 widens this file's own `Employee` type when it needs the extra fields for the edit dialog.

- [ ] **Step 2: Add `deleteEmployee`, `restoreEmployee`, `permanentlyDeleteEmployee` to `apps/web/src/app/(app)/colaboradores/actions.ts`**

Read the current file first (from Task 5, has `updateSchedule` and `createEmployee`). Append this to the end:

```typescript
export async function deleteEmployee(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/employees/${userId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/employees/${userId} responded with ${res.status}`);
  }
  revalidatePath("/colaboradores");
  revalidatePath("/");
}

export async function restoreEmployee(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/employees/${userId}/restore`, { method: "PATCH" });
  if (!res.ok) {
    throw new Error(`/employees/${userId}/restore responded with ${res.status}`);
  }
  revalidatePath("/colaboradores");
  revalidatePath("/");
}

export async function permanentlyDeleteEmployee(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/employees/${userId}/permanent`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/employees/${userId}/permanent responded with ${res.status}`);
  }
  revalidatePath("/colaboradores");
}
```

- [ ] **Step 3: Write `apps/web/src/app/(app)/colaboradores/lixeira-row.tsx`**

```tsx
"use client";

import { useRef } from "react";

import { permanentlyDeleteEmployee, restoreEmployee } from "./actions";
import styles from "./colaboradores.module.css";

type TrashedEmployee = {
  userId: string;
  name: string;
  deletedAt: string;
};

export function LixeiraRow({ employee }: { employee: TrashedEmployee }) {
  const confirmPermanentRef = useRef<HTMLDialogElement>(null);

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>{employee.name}</span>
      <form action={restoreEmployee}>
        <input type="hidden" name="userId" value={employee.userId} />
        <button type="submit" className={styles.saveButton}>
          Restaurar
        </button>
      </form>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => confirmPermanentRef.current?.showModal()}
      >
        Excluir permanentemente
      </button>

      <dialog ref={confirmPermanentRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Excluir {employee.name} permanentemente?</p>
        <p className={styles.subheading}>Essa ação não pode ser desfeita.</p>
        <form action={permanentlyDeleteEmployee}>
          <input type="hidden" name="userId" value={employee.userId} />
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => confirmPermanentRef.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.deleteButton}>
              Excluir permanentemente
            </button>
          </div>
        </form>
      </dialog>
    </li>
  );
}
```

- [ ] **Step 4: Write `apps/web/src/app/(app)/colaboradores/lixeira-section.tsx`**

```tsx
import { apiFetchJson } from "@/lib/api";

import { LixeiraRow } from "./lixeira-row";
import styles from "./colaboradores.module.css";

type TrashedEmployee = {
  userId: string;
  name: string;
  deletedAt: string;
};

export async function LixeiraSection() {
  const trashed = await apiFetchJson<TrashedEmployee[]>("/employees/trash");

  return (
    <details className={styles.trash}>
      <summary className={styles.trashSummary}>Lixeira ({trashed.length})</summary>
      {trashed.length === 0 ? (
        <p className={styles.subheading}>Nenhum colaborador na lixeira.</p>
      ) : (
        <ul className={styles.list}>
          {trashed.map((employee) => (
            <LixeiraRow key={employee.userId} employee={employee} />
          ))}
        </ul>
      )}
    </details>
  );
}
```

- [ ] **Step 5: Render `<LixeiraSection />` in `apps/web/src/app/(app)/colaboradores/page.tsx`**

Read the current file first (from Task 5). Add this import alongside the existing ones:

```typescript
import { LixeiraSection } from "./lixeira-section";
```

Add `<LixeiraSection />` as the last child inside the outermost `<div className={styles.page}>`, right after the `{employees.length === 0 ? (...) : (...)}` block and before that `<div>`'s closing tag:

```tsx
      <LixeiraSection />
    </div>
  );
}
```

- [ ] **Step 6: Add trash/delete-button styles to `apps/web/src/app/(app)/colaboradores/colaboradores.module.css`**

Read the current file first (from Task 5). Append these classes to the end of the file:

```css
.deleteButton {
  appearance: none;
  border: 1px solid var(--color-status-danger);
  background: transparent;
  color: var(--color-status-danger);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.deleteButton:hover {
  background: var(--color-status-danger);
  color: #ffffff;
}

.trash {
  border-radius: 8px;
  background: var(--color-background-element);
  padding: 12px 16px;
}

.trashSummary {
  cursor: pointer;
  font-weight: 600;
  color: var(--color-text);
}
```

`--color-status-danger` already exists in `apps/web/src/app/globals.css` (added by the mapa-de-presença feature for the "Atrasado" badge). The confirmation dialogs opened in this task reuse `.dialog`/`.dialogTitle`/`.dialogActions`/`.dialogClose` from Task 5 — no new dialog-shell CSS needed.

- [ ] **Step 7: Extend `apps/web/e2e/fake-api-server.mjs`**

Read the current file first (from Task 5). Add these branches near the existing `POST /employees` branch, before the final 404 fallback:

```javascript
  if (req.method === "GET" && url.pathname === "/employees/trash") {
    return sendJson(res, 200, []);
  }
  if (req.method === "DELETE" && /^\/employees\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
  if (req.method === "PATCH" && /^\/employees\/[^/]+\/restore$/.test(url.pathname)) {
    return sendJson(res, 200, { userId: url.pathname.split("/")[2], deletedAt: null });
  }
  if (req.method === "DELETE" && /^\/employees\/[^/]+\/permanent$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
```

These don't collide with each other or with the existing `PATCH /^\/employees\/[^/]+$/` (updateSchedule) branch — `[^/]+$` never matches a path with an extra `/restore` or `/permanent` segment after it, since `[^/]` excludes the slash character.

- [ ] **Step 8: Add a `trash` seed key to `apps/web/e2e/test-session.ts`**

Read the current file first. Add `trash?: unknown[];` to `mockApi`'s `data` parameter type (in the same object literal as `employees?: unknown[];`), and add this block inside the function body, alongside the existing `if (data.employees) { ... }` block:

```typescript
  if (data.trash) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/employees/trash", response: data.trash },
    });
  }
```

- [ ] **Step 9: Write the new tests — append to `apps/web/e2e/colaboradores.spec.ts`**

Read the current file first (from Task 5). Add these tests at the end:

```typescript
test("clicking Excluir opens a confirmation dialog, and confirming soft-deletes the employee", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: null }],
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "Excluir", exact: true }).click();

  await expect(page.getByText("Excluir Ana Colaboradora?")).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "DELETE" && r.path === "/employees/colaborador-1"
      );
    })
    .toBeTruthy();
});

test("canceling the delete confirmation does not call the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: null }],
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

  const recorded = await getRecordedRequests(request);
  expect(recorded.find((r) => r.method === "DELETE")).toBeUndefined();
});

test("the lixeira section lists trashed employees and can restore one without confirmation", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [],
    trash: [
      { userId: "colaborador-2", name: "Beto Excluido", deletedAt: "2026-08-20T00:00:00.000Z" },
    ],
  });

  await page.goto("/colaboradores");
  await page.getByText("Lixeira (1)").click();
  await expect(page.getByText("Beto Excluido")).toBeVisible();

  await page.getByRole("button", { name: "Restaurar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/employees/colaborador-2/restore"
      );
    })
    .toBeTruthy();
});

test("excluir permanentemente requires confirmation before calling the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [],
    trash: [
      { userId: "colaborador-2", name: "Beto Excluido", deletedAt: "2026-08-20T00:00:00.000Z" },
    ],
  });

  await page.goto("/colaboradores");
  await page.getByText("Lixeira (1)").click();
  await page.getByRole("button", { name: "Excluir permanentemente", exact: true }).click();

  await expect(page.getByText("Excluir Beto Excluido permanentemente?")).toBeVisible();

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir permanentemente" })
    .click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "DELETE" && r.path === "/employees/colaborador-2/permanent"
      );
    })
    .toBeTruthy();
});
```

- [ ] **Step 10: Run the build to catch type errors**

Run: `pnpm --filter @ponto-dcit/web run build`
Expected: succeeds.

- [ ] **Step 11: Run the e2e suite**

Run: `pnpm --filter @ponto-dcit/web run test`
Expected: PASS — every suite green, including the 4 new tests and every pre-existing `colaboradores.spec.ts` test from Task 5 (unaffected).

- [ ] **Step 12: Lint**

Run: `pnpm --filter @ponto-dcit/web run lint`
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/app/'(app)'/colaboradores apps/web/e2e
git commit -m "feat(web): add confirmed Excluir + Lixeira (restore/permanent-delete) for colaboradores"
```

---

### Task 7: `apps/api` — edit personal data after creation

**Files:**
- Modify: `apps/api/src/employees/employees.service.ts`
- Modify: `apps/api/src/employees/employees.service.spec.ts`
- Modify: `apps/api/src/employees/employees.controller.ts`
- Modify: `apps/api/src/employees/employees.controller.spec.ts`

**Interfaces:**
- Consumes: `EmployeeCreateSchema`/`EmployeeCreateInput` from `@ponto-dcit/shared-types` (Task 2, same schema as creation — no new shared-types work needed).
- Produces: `EmployeesService.updatePersonalData(userId, input: EmployeeCreateInput)`; `PATCH /employees/:userId/personal-data` (`@Roles('rh')`). Task 8 (web) calls this route over HTTP.

- [ ] **Step 1: Write the failing tests — append to `apps/api/src/employees/employees.service.spec.ts`**

Read the current file first (has `create`, `listTrash`/`softDelete`/`restore`/`permanentlyDelete` from Tasks 3 and 4). Add this `describe` block at the end of the file, inside the outer `describe('EmployeesService', ...)` (immediately before its closing `});`):

```typescript
  describe('updatePersonalData', () => {
    it('updates all personal fields, including role and hireDate', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-a',
          name: 'Antes Da Edicao',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      const updated = await service.updatePersonalData('emp-edit-a', {
        name: 'Depois Da Edicao',
        role: 'gestor',
        hireDate: '2025-06-01',
        cpf: '33333333333',
        rg: '7654321',
        dataNascimento: '1985-03-10',
        estadoCivil: 'divorciado',
        enderecoRua: 'Rua Nova',
        enderecoNumero: '200',
        enderecoBairro: 'Jardins',
        enderecoCidade: 'Rio de Janeiro',
        enderecoEstado: 'RJ',
        enderecoCep: '22000000',
      });

      expect(updated.name).toBe('Depois Da Edicao');
      expect(updated.role).toBe('gestor');
      expect(updated.hireDate.toISOString()).toBe('2025-06-01T00:00:00.000Z');
      expect(updated.cpf).toBe('33333333333');
      expect(updated.enderecoEstado).toBe('RJ');

      await prisma.employee.delete({ where: { userId: 'emp-edit-a' } });
    });

    it('does not conflict when the CPF submitted is unchanged from the same employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-b',
          name: 'Mesmo CPF',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          cpf: '44444444444',
        },
      });

      const updated = await service.updatePersonalData('emp-edit-b', {
        name: 'Mesmo CPF Editado',
        role: 'colaborador',
        hireDate: '2024-01-01',
        cpf: '44444444444',
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      });

      expect(updated.name).toBe('Mesmo CPF Editado');
      expect(updated.cpf).toBe('44444444444');

      await prisma.employee.delete({ where: { userId: 'emp-edit-b' } });
    });

    it('throws ConflictException when the new CPF belongs to a different employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-c1',
          name: 'Primeiro Editor',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          cpf: '55555555555',
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-c2',
          name: 'Segundo Editor',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
          cpf: '66666666666',
        },
      });

      await expect(
        service.updatePersonalData('emp-edit-c2', {
          name: 'Segundo Editor',
          role: 'colaborador',
          hireDate: '2024-01-01',
          cpf: '55555555555',
          rg: null,
          dataNascimento: null,
          estadoCivil: null,
          enderecoRua: null,
          enderecoNumero: null,
          enderecoBairro: null,
          enderecoCidade: null,
          enderecoEstado: null,
          enderecoCep: null,
        }),
      ).rejects.toThrow(ConflictException);

      await prisma.employee.deleteMany({
        where: { userId: { in: ['emp-edit-c1', 'emp-edit-c2'] } },
      });
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ponto-dcit/api test -- employees.service.spec.ts`
Expected: FAIL — `service.updatePersonalData is not a function`.

- [ ] **Step 3: Implement in `apps/api/src/employees/employees.service.ts`**

Read the current file first. Add this method right after `create()` and before `listTrash()`:

```typescript
  async updatePersonalData(userId: string, input: EmployeeCreateInput) {
    try {
      return await this.prisma.employee.update({
        where: { userId },
        data: {
          name: input.name,
          role: input.role,
          hireDate: new Date(input.hireDate),
          cpf: input.cpf,
          rg: input.rg,
          dataNascimento: input.dataNascimento ? new Date(input.dataNascimento) : null,
          estadoCivil: input.estadoCivil,
          enderecoRua: input.enderecoRua,
          enderecoNumero: input.enderecoNumero,
          enderecoBairro: input.enderecoBairro,
          enderecoCidade: input.enderecoCidade,
          enderecoEstado: input.enderecoEstado,
          enderecoCep: input.enderecoCep,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um colaborador cadastrado com esse CPF.');
      }
      throw error;
    }
  }
```

No special-casing is needed for "the employee's own unchanged CPF shouldn't count as a conflict" — a SQL `UPDATE` that keeps a column's existing value never violates that column's unique index (no other row has just acquired that value); the index only rejects an update when the new value already belongs to a *different* row, which is exactly the case that must 409.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ponto-dcit/api test -- employees.service.spec.ts`
Expected: PASS — all tests green, including every pre-existing test from Tasks 3 and 4 (unaffected).

- [ ] **Step 5: Write the failing tests — append to `apps/api/src/employees/employees.controller.spec.ts`**

Read the current file first. Add this test inside `describe('EmployeesController guard metadata', ...)`, immediately after the `permanentlyDelete` guard test and before that block's closing `});`:

```typescript
  it('applies AuthGuard and RolesGuard to updatePersonalData, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updatePersonalData,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updatePersonalData,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });
```

In the behavioral `describe('EmployeesController', ...)` block, add `updatePersonalData: jest.fn()` to the `serviceMock` object (alongside `listTrash`/`softDelete`/`restore`/`permanentlyDelete` from Task 4). Then add these tests at the end of that block (they reuse `VALID_CREATE_BODY`, already defined in this file by Task 3):

```typescript
  it('updates personal data with a valid payload', async () => {
    serviceMock.updatePersonalData.mockResolvedValue({ userId: 'user-1', ...VALID_CREATE_BODY });

    await controller.updatePersonalData('user-1', VALID_CREATE_BODY);

    expect(serviceMock.updatePersonalData).toHaveBeenCalledWith('user-1', VALID_CREATE_BODY);
  });

  it('rejects an invalid payload before calling the service for updatePersonalData', async () => {
    await expect(
      controller.updatePersonalData('user-1', { ...VALID_CREATE_BODY, role: 'admin' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updatePersonalData).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm --filter @ponto-dcit/api test -- employees.controller.spec.ts`
Expected: FAIL — `controller.updatePersonalData is not a function`.

- [ ] **Step 7: Implement in `apps/api/src/employees/employees.controller.ts`**

Read the current file first. Add this method right after `create()` and before `listTrash()`:

```typescript
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Patch(':userId/personal-data')
  async updatePersonalData(@Param('userId') userId: string, @Body() body: unknown) {
    const result = EmployeeCreateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.updatePersonalData(userId, result.data);
  }
```

`:userId/personal-data` is a distinct path shape from the bare `:userId` (updateSchedule), `:userId/restore`, and `:userId/permanent` routes already on this controller — no ambiguity.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @ponto-dcit/api test -- employees.controller.spec.ts`
Expected: PASS — all tests green.

- [ ] **Step 9: Run the full API test suite**

Run: `pnpm --filter @ponto-dcit/api run test`
Expected: PASS — every spec green.

- [ ] **Step 10: Lint (scoped to the files this task touched)**

Run: `pnpm --filter @ponto-dcit/api exec eslint src/employees/employees.service.ts src/employees/employees.service.spec.ts src/employees/employees.controller.ts src/employees/employees.controller.spec.ts --fix`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/employees
git commit -m "feat(api): add PATCH /employees/:userId/personal-data to edit an existing colaborador"
```

---

### Task 8: `apps/web` — "Editar" dialog

**Files:**
- Create: `apps/web/src/app/(app)/colaboradores/editar-colaborador-dialog.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/actions.ts`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Modify: `apps/web/e2e/colaboradores.spec.ts`

**Interfaces:**
- Consumes: `ColaboradorFormFields`/`ColaboradorFormDefaults` from `./colaborador-form-fields` (Task 5 — same component reused, not duplicated); `PATCH /employees/:userId/personal-data` (Task 7) over HTTP.
- Produces: the "Editar" button and dialog per row. Nothing else in this plan consumes it.

- [ ] **Step 1: Add `updateEmployeePersonalData` to `apps/web/src/app/(app)/colaboradores/actions.ts`**

Read the current file first (has `updateSchedule`, `createEmployee`, `deleteEmployee`, `restoreEmployee`, `permanentlyDeleteEmployee`). Append this to the end — it reuses `CreateEmployeeState` and `OPTIONAL_FIELDS`, both already defined in this file by Task 5:

```typescript
export async function updateEmployeePersonalData(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const userId = formData.get("userId");
  const name = formData.get("name");
  const role = formData.get("role");
  const hireDate = formData.get("hireDate");
  if (
    typeof userId !== "string" ||
    typeof name !== "string" ||
    typeof role !== "string" ||
    typeof hireDate !== "string"
  ) {
    return { error: "Dados do formulário inválidos.", success: false };
  }

  const payload: Record<string, string | null> = { name, role, hireDate };
  for (const field of OPTIONAL_FIELDS) {
    const value = formData.get(field);
    payload[field] = typeof value === "string" && value !== "" ? value : null;
  }

  const res = await apiFetch(`/employees/${userId}/personal-data`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 409) {
      return { error: "Já existe um colaborador cadastrado com esse CPF.", success: false };
    }
    return { error: `Não foi possível salvar (código ${res.status}).`, success: false };
  }

  revalidatePath("/colaboradores");
  return { error: null, success: true };
}
```

- [ ] **Step 2: Write `apps/web/src/app/(app)/colaboradores/editar-colaborador-dialog.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";

import { updateEmployeePersonalData } from "./actions";
import { ColaboradorFormFields } from "./colaborador-form-fields";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  role: "colaborador" | "gestor" | "rh";
  hireDate: string;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCidade: string | null;
  enderecoEstado: string | null;
  enderecoCep: string | null;
};

export function EditarColaboradorDialog({ employee }: { employee: Employee }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(updateEmployeePersonalData, {
    error: null,
    success: false,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
    }
  }, [state.success]);

  const defaults = {
    name: employee.name,
    role: employee.role,
    hireDate: employee.hireDate.slice(0, 10),
    cpf: employee.cpf,
    rg: employee.rg,
    dataNascimento: employee.dataNascimento ? employee.dataNascimento.slice(0, 10) : null,
    estadoCivil: employee.estadoCivil,
    enderecoRua: employee.enderecoRua,
    enderecoNumero: employee.enderecoNumero,
    enderecoBairro: employee.enderecoBairro,
    enderecoCidade: employee.enderecoCidade,
    enderecoEstado: employee.enderecoEstado,
    enderecoCep: employee.enderecoCep,
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
        <p className={styles.dialogTitle}>Editar {employee.name}</p>
        <form action={formAction}>
          <input type="hidden" name="userId" value={employee.userId} />
          <ColaboradorFormFields defaults={defaults} />
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

`hireDate`/`dataNascimento` arrive from `GET /employees` as full ISO datetime strings (JSON-serialized `Date`s, e.g. `"2024-01-01T00:00:00.000Z"`) — `.slice(0, 10)` truncates to the `"YYYY-MM-DD"` shape `<input type="date">` needs, matching the same convention already used elsewhere in this app for date-only display (e.g. `escala/page.tsx`'s `formatDateBR`).

- [ ] **Step 3: Rewrite `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`**

Read the current file first (from Task 6 — has the delete-confirmation dialog). Replace the whole file with:

```tsx
"use client";

import { useActionState, useRef } from "react";

import { deleteEmployee, updateSchedule } from "./actions";
import { EditarColaboradorDialog } from "./editar-colaborador-dialog";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  role: "colaborador" | "gestor" | "rh";
  hireDate: string;
  expectedStartTime: string | null;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCidade: string | null;
  enderecoEstado: string | null;
  enderecoCep: string | null;
};

export function ColaboradoresRow({ employee }: { employee: Employee }) {
  const [state, formAction, pending] = useActionState(updateSchedule, { error: null });
  const confirmDeleteRef = useRef<HTMLDialogElement>(null);

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
      <EditarColaboradorDialog employee={employee} />
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => confirmDeleteRef.current?.showModal()}
      >
        Excluir
      </button>
      {state.error ? <span className={styles.error}>{state.error}</span> : null}

      <dialog ref={confirmDeleteRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Excluir {employee.name}?</p>
        <p className={styles.subheading}>
          Ele irá para a lixeira e poderá ser restaurado depois.
        </p>
        <form action={deleteEmployee}>
          <input type="hidden" name="userId" value={employee.userId} />
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

This `Employee` type now matches `page.tsx`'s (Task 5) exactly — the page already fetches and passes the full shape, this file just widens its own local type to actually use the extra fields.

- [ ] **Step 4: Add the `PATCH /employees/:userId/personal-data` handler to `apps/web/e2e/fake-api-server.mjs`**

Read the current file first (from Task 6). Add this branch near the other `PATCH /employees/...` branches, before the final 404 fallback:

```javascript
  if (req.method === "PATCH" && /^\/employees\/[^/]+\/personal-data$/.test(url.pathname)) {
    return sendJson(res, 200, { userId: url.pathname.split("/")[2], ...body });
  }
```

- [ ] **Step 5: Write the new test — append to `apps/web/e2e/colaboradores.spec.ts`**

Read the current file first (from Task 6). Add this test at the end:

```typescript
test("opens the edit dialog prefilled and saves personal data", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [
      {
        userId: "colaborador-1",
        name: "Ana Colaboradora",
        role: "colaborador",
        hireDate: "2024-01-01T00:00:00.000Z",
        expectedStartTime: null,
        cpf: "12345678901",
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      },
    ],
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "Editar" }).click();

  await expect(page.getByRole("dialog").getByLabel("Nome")).toHaveValue("Ana Colaboradora");
  await expect(page.getByRole("dialog").getByLabel("CPF")).toHaveValue("12345678901");

  await page.getByRole("dialog").getByLabel("Nome").fill("Ana Editada");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/employees/colaborador-1/personal-data"
      )?.body;
    })
    .toEqual({
      name: "Ana Editada",
      role: "colaborador",
      hireDate: "2024-01-01",
      cpf: "12345678901",
      rg: null,
      dataNascimento: null,
      estadoCivil: null,
      enderecoRua: null,
      enderecoNumero: null,
      enderecoBairro: null,
      enderecoCidade: null,
      enderecoEstado: null,
      enderecoCep: null,
    });
});
```

- [ ] **Step 6: Run the build to catch type errors**

Run: `pnpm --filter @ponto-dcit/web run build`
Expected: succeeds.

- [ ] **Step 7: Run the e2e suite**

Run: `pnpm --filter @ponto-dcit/web run test`
Expected: PASS — every suite green, including the 1 new test and every pre-existing test from Tasks 5/6 (unaffected).

- [ ] **Step 8: Lint**

Run: `pnpm --filter @ponto-dcit/web run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/'(app)'/colaboradores apps/web/e2e
git commit -m "feat(web): add Editar dialog to change a colaborador's personal data"
```

---

### Task 9: Full-repo verification

**Files:** none (verification only).

- [ ] **Step 1: Run every workspace's build**

Run: `pnpm --filter @ponto-dcit/shared-types run build && pnpm --filter @ponto-dcit/api run build && pnpm --filter @ponto-dcit/web run build`
Expected: PASS.

- [ ] **Step 2: Run every workspace's tests**

Run: `pnpm --filter @ponto-dcit/shared-types test && pnpm --filter @ponto-dcit/api run test && pnpm --filter @ponto-dcit/web run test`
Expected: PASS (run per-package, not `pnpm turbo run test` — running all packages concurrently has previously caused a CPU-contention timeout in the web e2e `webServer` startup unrelated to any real defect).

- [ ] **Step 3: Manually exercise the golden path in a running app**

With `apps/api`, `infra/mock-idp`, and `apps/web` all running (see `README.md`'s "Running each app in development"): log in as `rh-1`, open `/colaboradores`.

Creation: click "+ Novo colaborador", fill the CEP field with a real CEP (e.g. `01310100`) and tab/click away — confirm the address fields auto-fill from ViaCEP. Try typing a CPF with fewer than 11 digits and confirm the browser shows its native validation message on submit attempt. Fill in the rest and submit; confirm the dialog closes and the new colaborador appears in the roster.

Edição: click "Editar" on that colaborador, confirm every field is prefilled with what was just entered, change the name, and save — confirm the roster reflects the new name.

Exclusão lógica: click "Excluir" — confirm a dialog appears asking for confirmation; cancel it and confirm nothing happened; click "Excluir" again and confirm this time — confirm the colaborador disappears from the roster and from the home page's presence panel (`/`). Open "Lixeira" and confirm they appear there. Click "Restaurar" (no confirmation expected) and confirm they reappear in the roster. Click "Excluir" again, open the Lixeira, click "Excluir permanentemente" — confirm a dialog appears; confirm it — the colaborador should be gone from the Lixeira entirely.

- [ ] **Step 4: Report status update to the spec**

Update `docs/superpowers/specs/2026-08-28-cadastro-colaborador-design.md`'s `**Status:**` line from "Aprovado para implementação" to "Implementado" once every task above is committed and Steps 1–3 pass.

```bash
git add docs/superpowers/specs/2026-08-28-cadastro-colaborador-design.md
git commit -m "docs: mark cadastro de colaborador spec as implemented"
```
