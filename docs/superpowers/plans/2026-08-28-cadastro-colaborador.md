# Cadastro de Colaborador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "+" dialog to the RH-only `/colaboradores` page that creates a new `Employee` with personal data (CPF, RG, data de nascimento, estado civil, endereço), since today the only way to create an `Employee` row is a seed script.

**Architecture:** `Employee` gains 10 nullable personal-data columns. A new `POST /employees` endpoint (role `rh`) generates a random `userId` server-side (decoupled from any OIDC login identity — see spec §8) and persists the record, translating a duplicate-CPF unique-constraint violation into a 409. The web side adds a Client Component dialog (`<dialog>` + `useActionState`, same patterns already used elsewhere in this app) reachable from a new "+" button that's always visible on `/colaboradores`, including when the roster is empty (today the empty state replaces the whole page, which would make it impossible to add the very first employee — this plan fixes that).

**Tech Stack:** NestJS + Prisma (SQLite) for the API, Next.js App Router (Server Component + Client Component + Server Action) for web — no new dependencies.

**Spec:** [`docs/superpowers/specs/2026-08-28-cadastro-colaborador-design.md`](../specs/2026-08-28-cadastro-colaborador-design.md)

## Global Constraints

- New `Employee` columns, all nullable, no default: `cpf String? @unique`, `rg String?`, `dataNascimento DateTime?`, `estadoCivil String?`, `enderecoRua String?`, `enderecoNumero String?`, `enderecoBairro String?`, `enderecoCidade String?`, `enderecoEstado String?`, `enderecoCep String?`.
- `ESTADOS_CIVIS` (shared-types, fixed list): `["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"]`.
- `UFS` (shared-types, fixed list, the 27 Brazilian states): `["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]`.
- CPF validated as exactly 11 digits, no punctuation (`/^\d{11}$/`); CEP as exactly 8 digits (`/^\d{8}$/`); no CPF check-digit algorithm.
- `POST /employees` is `@Roles('rh')` only (same as the existing `PATCH /employees/:userId`) — not `gestor`.
- `userId` for a newly created employee is generated server-side via `randomUUID()` from `node:crypto` — never taken from the request body.
- No masking of the new personal fields by role — `GET /employees` returns them identically to gestor and RH (explicit product decision, do not "fix" this later without asking).
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
      schema.prisma                                     # modified — 10 new Employee columns
      migrations/<generated>_add_employee_personal_data/ # generated
    src/
      employees/
        employees.service.ts                            # modified — create()
        employees.service.spec.ts                        # modified
        employees.controller.ts                          # modified — POST /employees
        employees.controller.spec.ts                      # modified
  web/
    src/
      app/
        (app)/
          colaboradores/
            page.tsx                                      # modified — always-visible "+" button, restructured empty state
            actions.ts                                     # modified — createEmployee
            novo-colaborador-dialog.tsx                    # new
            colaboradores.module.css                       # modified — dialog/grid/button styles
    e2e/
      fake-api-server.mjs                                 # modified — serve POST /employees
      colaboradores.spec.ts                                # modified — new tests
```

---

### Task 1: `apps/api` — `Employee` personal-data columns

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Generated: `apps/api/prisma/migrations/<timestamp>_add_employee_personal_data/`

**Interfaces:**
- Consumes: nothing.
- Produces: the 10 new nullable columns on `prisma.employee`, used by Task 3.

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
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `pnpm --filter @ponto-dcit/api exec prisma migrate dev --name add_employee_personal_data`
Expected: creates `apps/api/prisma/migrations/<timestamp>_add_employee_personal_data/migration.sql`, applies it to `dev.db`, regenerates the Prisma Client.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): add personal-data columns to Employee"
```

---

### Task 2: `packages/shared-types` — `EmployeeCreateSchema`

**Files:**
- Create: `packages/shared-types/src/employee-create.ts`
- Test: `packages/shared-types/src/employee-create.test.ts`
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Consumes: `RoleSchema` from `./role` (already exists, exported as `"colaborador" | "gestor" | "rh"`).
- Produces: `EmployeeCreateSchema` (Zod schema), `EmployeeCreateInput` (inferred type), `ESTADOS_CIVIS`, `UFS` (readonly string-tuple consts), all exported from `@ponto-dcit/shared-types`. Task 3 imports `EmployeeCreateSchema`/`EmployeeCreateInput`; Task 4 imports `ESTADOS_CIVIS`/`UFS` for the form's `<select>` options.

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
- Consumes: `EmployeeCreateSchema`/`EmployeeCreateInput` from `@ponto-dcit/shared-types` (Task 2); the 10 new columns on `prisma.employee` (Task 1); `AuthGuard`/`RolesGuard`/`Roles` from `../auth/*` (already used elsewhere in this file).
- Produces: `EmployeesService.create(input: EmployeeCreateInput)` (throws `ConflictException` on duplicate CPF); `POST /employees` (`@Roles('rh')`). Task 4 (web) calls `POST /employees` over HTTP.

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

`list()`'s explicit `select` is removed — it would need updating every time a new personal field is added, and returning the full row is already the pattern used by other `findMany` calls in this codebase (e.g. `TimeEntriesService.listTeamToday`'s `employees.findMany`).

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

### Task 4: `apps/web` — "+" dialog on `/colaboradores`

**Files:**
- Modify: `apps/web/src/app/(app)/colaboradores/page.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/actions.ts`
- Create: `apps/web/src/app/(app)/colaboradores/novo-colaborador-dialog.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/colaboradores.module.css`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Modify: `apps/web/e2e/colaboradores.spec.ts`

**Interfaces:**
- Consumes: `ESTADOS_CIVIS`, `UFS` from `@ponto-dcit/shared-types` (Task 2); `apiFetch` from `@/lib/api`. Calls `POST /employees` (Task 3) over HTTP.
- Produces: the "+" button and dialog on `/colaboradores`. Nothing else in this plan consumes it.

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
  expectedStartTime: string | null;
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

Validation of exact formats (CPF 11 digits, UF a real state, etc.) is not duplicated client-side — the payload is only normalized (`"" → null`); the backend's `EmployeeCreateSchema` is the real validation, and a 400 surfaces as a generic `"Não foi possível salvar (código 400)."`. Per-field client-side validation is a reasonable follow-up, not part of this task.

- [ ] **Step 3: Write `apps/web/src/app/(app)/colaboradores/novo-colaborador-dialog.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { ESTADOS_CIVIS, UFS } from "@ponto-dcit/shared-types";

import { createEmployee } from "./actions";
import styles from "./colaboradores.module.css";

const ESTADO_CIVIL_LABELS: Record<(typeof ESTADOS_CIVIS)[number], string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União estável",
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
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Nome</span>
              <input type="text" name="name" required className={styles.fieldInput} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Cargo</span>
              <select
                name="role"
                required
                defaultValue="colaborador"
                className={styles.fieldSelect}
              >
                <option value="colaborador">Colaborador</option>
                <option value="gestor">Gestor</option>
                <option value="rh">RH</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Data de admissão</span>
              <input type="date" name="hireDate" required className={styles.fieldInput} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>CPF</span>
              <input
                type="text"
                name="cpf"
                placeholder="11 dígitos"
                className={styles.fieldInput}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>RG</span>
              <input type="text" name="rg" className={styles.fieldInput} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Data de nascimento</span>
              <input type="date" name="dataNascimento" className={styles.fieldInput} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Estado civil</span>
              <select name="estadoCivil" defaultValue="" className={styles.fieldSelect}>
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
              <input type="text" name="enderecoRua" className={styles.fieldInput} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Número</span>
              <input type="text" name="enderecoNumero" className={styles.fieldInput} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Bairro</span>
              <input type="text" name="enderecoBairro" className={styles.fieldInput} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Cidade</span>
              <input type="text" name="enderecoCidade" className={styles.fieldInput} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Estado (UF)</span>
              <select name="enderecoEstado" defaultValue="" className={styles.fieldSelect}>
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
                className={styles.fieldInput}
              />
            </label>
          </div>
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

- [ ] **Step 4: Add dialog/grid/button styles to `apps/web/src/app/(app)/colaboradores/colaboradores.module.css`**

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

- [ ] **Step 5: Add the `POST /employees` handler to `apps/web/e2e/fake-api-server.mjs`**

Read the current file first. Add this branch near the existing `PATCH /employees/:userId` branch, before the final 404 fallback:

```javascript
  if (req.method === "POST" && url.pathname === "/employees") {
    return sendJson(res, 201, { userId: "generated-employee-id", ...body });
  }
```

This only fires when a test hasn't seeded a specific status for `POST /employees` — the generalized `seedEntry` check (added in an earlier plan) still takes priority, so a test can use `seedResponse({ method: "POST", path: "/employees", status: 409, response: {...} })` to simulate a duplicate-CPF conflict.

- [ ] **Step 6: Write the new tests — append to `apps/web/e2e/colaboradores.spec.ts`**

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
```

- [ ] **Step 7: Run the build to catch type errors**

Run: `pnpm --filter @ponto-dcit/web run build`
Expected: succeeds.

- [ ] **Step 8: Run the e2e suite**

Run: `pnpm --filter @ponto-dcit/web run test`
Expected: PASS — every suite green, including the 3 new tests and the 6 pre-existing `colaboradores.spec.ts` tests (unaffected — the roster/RBAC/schedule-editing tests don't touch the new button). If port 3000/3001 are already bound by a leftover process, free them first.

- [ ] **Step 9: Lint**

Run: `pnpm --filter @ponto-dcit/web run lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/'(app)'/colaboradores apps/web/e2e
git commit -m "feat(web): add a dialog to register a new colaborador"
```

---

### Task 5: Full-repo verification

**Files:** none (verification only).

- [ ] **Step 1: Run every workspace's build**

Run: `pnpm --filter @ponto-dcit/shared-types run build && pnpm --filter @ponto-dcit/api run build && pnpm --filter @ponto-dcit/web run build`
Expected: PASS.

- [ ] **Step 2: Run every workspace's tests**

Run: `pnpm --filter @ponto-dcit/shared-types test && pnpm --filter @ponto-dcit/api run test && pnpm --filter @ponto-dcit/web run test`
Expected: PASS (run per-package, not `pnpm turbo run test` — running all packages concurrently has previously caused a CPU-contention timeout in the web e2e `webServer` startup unrelated to any real defect).

- [ ] **Step 3: Manually exercise the golden path in a running app**

With `apps/api`, `infra/mock-idp`, and `apps/web` all running (see `README.md`'s "Running each app in development"): log in as `rh-1`, open `/colaboradores`, click "+ Novo colaborador", fill in the form (including at least one personal field, e.g. CPF), submit, and confirm the dialog closes and the new colaborador appears in the roster list. Then try submitting a second colaborador with the same CPF and confirm the inline "Já existe um colaborador cadastrado com esse CPF." error appears without losing the entered data.

- [ ] **Step 4: Report status update to the spec**

Update `docs/superpowers/specs/2026-08-28-cadastro-colaborador-design.md`'s `**Status:**` line from "Aprovado para implementação" to "Implementado" once every task above is committed and Steps 1–3 pass.

```bash
git add docs/superpowers/specs/2026-08-28-cadastro-colaborador-design.md
git commit -m "docs: mark cadastro de colaborador spec as implemented"
```
