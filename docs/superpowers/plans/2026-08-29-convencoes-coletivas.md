# Convenções Coletivas e Dados de Jornada/Salário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `ConvencaoColetiva` (collective agreement) cadastro — nome, CNPJ, categoria sindical, jornada esperada, percentual de hora extra — managed by RH, plus `salarioMensal` and an optional convenção link on `Employee`. This is data-only: no banco de horas calculation changes here (that's a separate, later spec that will consume this data).

**Architecture:** New `apps/api/src/convencoes` module (full CRUD, RH-only writes, gestor+rh reads) mirrors the existing module pattern (e.g. `employees`, `operacional`). `Employee` gains two plain fields (no Prisma `@relation`, matching this codebase's established convention of joining by bare id in the service layer). Web gets a new RH-only `/convencoes` admin page (mirrors `/colaboradores`'s CRUD dialogs) and the existing colaborador form gains two fields, fed by a new `GET /convencoes` fetched in parallel with `GET /employees`.

**Tech Stack:** NestJS + Prisma (SQLite) API, Next.js Server Components + Server Actions web, Zod (`packages/shared-types`) — all already established in this repo.

**Spec:** `docs/superpowers/specs/2026-08-29-convencoes-coletivas-design.md`

## Global Constraints

- `GET /convencoes` — any authenticated `gestor` or `rh` (read-only, needed to populate the colaborador form's dropdown). `POST`/`PATCH`/`DELETE /convencoes` — `rh` only.
- Numeric fields submitted from web forms arrive as strings (FormData → Server Action → `JSON.stringify`) — every numeric Zod field in this feature (`expectedDailyMinutes`, `overtimePercent`, `salarioMensal`) MUST use `z.coerce.number()`, not `z.number()`, or validation breaks on real form submissions even though object-literal test fixtures (which pass real numbers) would still pass.
- Deleting a `ConvencaoColetiva` that's still referenced by an `Employee.convencaoId` is allowed unconditionally — no referential check, no cascade. A dangling `convencaoId` is later treated as "no convenção" (that logic lives in the banco de horas spec, not this one).
- `salarioMensal` visibility/edit rights follow the exact same rule as `cpf`/`rg` today: RH and gestor both, via the existing colaborador cadastro/edit forms.
- Follow existing module conventions exactly: `AuthGuard`+`RolesGuard`+`@Roles(...)` for RBAC, Server Actions + `revalidatePath` for web mutations, `EmptyState` for permission/empty states.

---

### Task 1: Data model — `ConvencaoColetiva` + `Employee` fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_convencao_coletiva/migration.sql` (generated, not hand-written)

**Interfaces:**
- Produces: Prisma model `ConvencaoColetiva { id, nome, cnpj, categoriaSindical, expectedDailyMinutes, overtimePercent, createdAt }`, and `Employee.convencaoId: String?`, `Employee.salarioMensal: Float?` — accessible in later tasks as `this.prisma.convencaoColetiva` / `employee.convencaoId` / `employee.salarioMensal`.

- [ ] **Step 1: Add the model to `apps/api/prisma/schema.prisma`**

Add this model anywhere alongside the other standalone models (e.g. right after `JornadaAlert`):

```prisma
model ConvencaoColetiva {
  id                   String   @id @default(uuid())
  nome                 String
  cnpj                 String?
  categoriaSindical    String?
  expectedDailyMinutes Int      // jornada esperada por dia, em minutos (ex: 480 = 8h)
  overtimePercent      Float    // percentual de acréscimo da hora extra, ex: 50 = 50%
  createdAt            DateTime @default(now())
}
```

- [ ] **Step 2: Add the two new fields to the `Employee` model**

In `apps/api/prisma/schema.prisma`, inside the existing `model Employee { ... }` block, add these two lines (anywhere among the other optional fields — e.g. right after `nivel`):

```prisma
  convencaoId       String?   // id de ConvencaoColetiva, sem FK — resolvido na camada de serviço
  salarioMensal     Float?    // R$, mesma visibilidade de cpf/rg (RH e gestor)
```

- [ ] **Step 3: Generate and apply the migration (dev database)**

Run from the repo root:

```bash
pnpm --filter @ponto-dcit/api exec prisma migrate dev --name add_convencao_coletiva
```

Expected: "The following migration(s) have been created and applied", Prisma Client regenerated.

- [ ] **Step 4: Apply the same migration to the test database**

```bash
pnpm --filter @ponto-dcit/api run migrate-test-db
```

Expected: "All migrations have been successfully applied" against `test.db`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add ConvencaoColetiva model and Employee.convencaoId/salarioMensal"
```

---

### Task 2: `packages/shared-types` — Zod schemas

**Files:**
- Create: `packages/shared-types/src/convencao.ts`
- Create: `packages/shared-types/src/convencao.test.ts`
- Modify: `packages/shared-types/src/employee-create.ts`
- Modify: `packages/shared-types/src/employee-create.test.ts`
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Produces: `ConvencaoInputSchema` (Zod), `ConvencaoInput` (type) — exported from `@ponto-dcit/shared-types`. `EmployeeCreateSchema` gains `convencaoId`/`salarioMensal` — every existing caller/fixture that builds a full `EmployeeCreateInput` object now needs these two keys present (later tasks handle each caller).

- [ ] **Step 1: Write the failing test for the new schema**

Create `packages/shared-types/src/convencao.test.ts`:

```typescript
import { ConvencaoInputSchema } from "./convencao";

const VALID_PAYLOAD = {
  nome: "Convenção Sindicato dos Metalúrgicos",
  cnpj: "12345678000199",
  categoriaSindical: "Metalúrgicos",
  expectedDailyMinutes: 480,
  overtimePercent: 50,
};

describe("ConvencaoInputSchema", () => {
  it("accepts a fully populated valid payload", () => {
    const result = ConvencaoInputSchema.safeParse(VALID_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("accepts cnpj and categoriaSindical as null", () => {
    const result = ConvencaoInputSchema.safeParse({
      ...VALID_PAYLOAD,
      cnpj: null,
      categoriaSindical: null,
    });
    expect(result.success).toBe(true);
  });

  it("coerces expectedDailyMinutes and overtimePercent from strings (form submissions)", () => {
    const result = ConvencaoInputSchema.safeParse({
      ...VALID_PAYLOAD,
      expectedDailyMinutes: "480",
      overtimePercent: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expectedDailyMinutes).toBe(480);
      expect(result.data.overtimePercent).toBe(50);
    }
  });

  it("rejects a missing nome", () => {
    const { nome: _nome, ...rest } = VALID_PAYLOAD;
    const result = ConvencaoInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative expectedDailyMinutes", () => {
    const result = ConvencaoInputSchema.safeParse({ ...VALID_PAYLOAD, expectedDailyMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative overtimePercent", () => {
    const result = ConvencaoInputSchema.safeParse({ ...VALID_PAYLOAD, overtimePercent: -10 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/shared-types && npx jest convencao
```

Expected: FAIL — `Cannot find module './convencao'`.

- [ ] **Step 3: Write `packages/shared-types/src/convencao.ts`**

```typescript
import { z } from "zod";

export const ConvencaoInputSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string().min(1).nullable(),
  categoriaSindical: z.string().min(1).nullable(),
  // z.coerce (não z.number()): o formulário web manda esses campos via
  // FormData → Server Action → JSON.stringify, então chegam como string
  // ("480", não 480).
  expectedDailyMinutes: z.coerce.number().int().positive(),
  overtimePercent: z.coerce.number().nonnegative(),
});
export type ConvencaoInput = z.infer<typeof ConvencaoInputSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd packages/shared-types && npx jest convencao
```

Expected: PASS, all 6 tests.

- [ ] **Step 5: Extend `EmployeeCreateSchema` in `packages/shared-types/src/employee-create.ts`**

Add these two lines to the `EmployeeCreateSchema` object, anywhere among the other nullable fields (e.g. right after `nivel: z.enum(NIVEIS).nullable(),`):

```typescript
  convencaoId: z.string().nullable(),
  // z.coerce.number() (não z.number()): o formulário de colaborador
  // reaproveita o mesmo array OPTIONAL_FIELDS que já monta o payload como
  // string a partir de FormData (apps/web/src/app/(app)/colaboradores/actions.ts)
  // — sem coerção, um salário "5000.50" (string) falharia a validação de
  // z.number(). nullable() intercepta null antes de tentar coagir, então o
  // caso "campo vazio" continua funcionando normalmente.
  salarioMensal: z.coerce.number().nonnegative().nullable(),
```

- [ ] **Step 6: Update `packages/shared-types/src/employee-create.test.ts`**

Add `convencaoId` and `salarioMensal` to `VALID_PAYLOAD`:

```typescript
  convencaoId: "convencao-1" as const,
  salarioMensal: 5000,
```

Add them (as `null`) to the "accepts every personal field as null" test's payload object too, alongside the other `null` fields:

```typescript
      convencaoId: null,
      salarioMensal: null,
```

Add two new tests, near the existing `estadoCivil`/`enderecoEstado` rejection tests:

```typescript
  it("coerces salarioMensal from a string (form submission)", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, salarioMensal: "5000.50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.salarioMensal).toBe(5000.5);
    }
  });

  it("rejects a negative salarioMensal", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, salarioMensal: -100 });
    expect(result.success).toBe(false);
  });
```

- [ ] **Step 7: Update `packages/shared-types/src/index.ts`**

Add, alongside the other schema exports:

```typescript
export { ConvencaoInputSchema } from "./convencao";
export type { ConvencaoInput } from "./convencao";
```

- [ ] **Step 8: Run the full shared-types test suite**

```bash
pnpm --filter @ponto-dcit/shared-types test
```

Expected: all suites pass, including `convencao.test.ts` and the updated `employee-create.test.ts`.

- [ ] **Step 9: Build the package**

```bash
pnpm --filter @ponto-dcit/shared-types run build
```

Expected: succeeds with no type errors.

- [ ] **Step 10: Commit**

```bash
git add packages/shared-types/src/convencao.ts packages/shared-types/src/convencao.test.ts packages/shared-types/src/employee-create.ts packages/shared-types/src/employee-create.test.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add ConvencaoInputSchema, extend EmployeeCreateSchema"
```

---

### Task 3: `apps/api/src/convencoes` — CRUD module

**Files:**
- Create: `apps/api/src/convencoes/convencoes.service.ts`
- Create: `apps/api/src/convencoes/convencoes.service.spec.ts`
- Create: `apps/api/src/convencoes/convencoes.controller.ts`
- Create: `apps/api/src/convencoes/convencoes.controller.spec.ts`
- Create: `apps/api/src/convencoes/convencoes.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `ConvencaoInputSchema`/`ConvencaoInput` (Task 2), `PrismaService`, `AuthGuard` (`../auth/auth-guard`), `RolesGuard` (`../auth/roles.guard`), `Roles`/`ROLES_KEY` (`../auth/roles.decorator`).
- Produces: `ConvencoesService` with `list()`, `create(input: ConvencaoInput)`, `update(id: string, input: ConvencaoInput)`, `delete(id: string)`. `GET /convencoes` (gestor/rh), `POST /convencoes` (rh), `PATCH /convencoes/:id` (rh), `DELETE /convencoes/:id` (rh, 204).

- [ ] **Step 1: Write the failing service tests**

Create `apps/api/src/convencoes/convencoes.service.spec.ts`:

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { ConvencoesService } from './convencoes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ConvencoesService', () => {
  let service: ConvencoesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConvencoesService, PrismaService],
    }).compile();

    service = module.get(ConvencoesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.convencaoColetiva.deleteMany({
      where: { nome: { startsWith: 'Convenção Teste ' } },
    });
    await prisma.onModuleDestroy();
  });

  const VALID_INPUT = {
    nome: 'Convenção Teste A',
    cnpj: '12345678000199',
    categoriaSindical: 'Metalúrgicos',
    expectedDailyMinutes: 480,
    overtimePercent: 50,
  };

  it('creates and lists a convenção', async () => {
    const created = await service.create(VALID_INPUT);

    expect(created.nome).toBe('Convenção Teste A');
    expect(created.expectedDailyMinutes).toBe(480);

    const all = await service.list();
    expect(all.find((c) => c.id === created.id)?.nome).toBe('Convenção Teste A');
  });

  it('lists ordered by nome ascending', async () => {
    await service.create({ ...VALID_INPUT, nome: 'Convenção Teste Zebra' });
    await service.create({ ...VALID_INPUT, nome: 'Convenção Teste Abelha' });

    const all = await service.list();
    const names = all
      .map((c) => c.nome)
      .filter((n) => n.startsWith('Convenção Teste'));
    expect(names).toEqual([...names].sort());
  });

  it('updates a convenção', async () => {
    const created = await service.create({ ...VALID_INPUT, nome: 'Convenção Teste B' });

    const updated = await service.update(created.id, {
      ...VALID_INPUT,
      nome: 'Convenção Teste B Editada',
      overtimePercent: 100,
    });

    expect(updated.nome).toBe('Convenção Teste B Editada');
    expect(updated.overtimePercent).toBe(100);
  });

  it('deletes a convenção', async () => {
    const created = await service.create({ ...VALID_INPUT, nome: 'Convenção Teste C' });

    await service.delete(created.id);

    const all = await service.list();
    expect(all.find((c) => c.id === created.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js convencoes.service
```

Expected: FAIL — `Cannot find module './convencoes.service'`.

- [ ] **Step 3: Implement `apps/api/src/convencoes/convencoes.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ConvencaoInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConvencoesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.convencaoColetiva.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  create(input: ConvencaoInput) {
    return this.prisma.convencaoColetiva.create({ data: input });
  }

  update(id: string, input: ConvencaoInput) {
    return this.prisma.convencaoColetiva.update({ where: { id }, data: input });
  }

  delete(id: string) {
    return this.prisma.convencaoColetiva.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js convencoes.service
```

Expected: PASS, all 4 tests.

- [ ] **Step 5: Write the failing controller tests**

Create `apps/api/src/convencoes/convencoes.controller.spec.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConvencoesController } from './convencoes.controller';
import { ConvencoesService } from './convencoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('ConvencoesController guard metadata', () => {
  it('applies AuthGuard and RolesGuard to list, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.list,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.list,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to create, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.create,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.create,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('applies AuthGuard and RolesGuard to update, restricted to rh only', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.update,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('applies AuthGuard and RolesGuard to remove, restricted to rh only', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.remove,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });
});

describe('ConvencoesController', () => {
  let controller: ConvencoesController;
  const serviceMock = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConvencoesController],
      providers: [{ provide: ConvencoesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ConvencoesController);
  });

  const VALID_BODY = {
    nome: 'Convenção X',
    cnpj: null,
    categoriaSindical: null,
    expectedDailyMinutes: 480,
    overtimePercent: 50,
  };

  it('returns the convenção list', async () => {
    serviceMock.list.mockResolvedValue([{ id: 'c1' }]);

    const result = await controller.list();

    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('creates a convenção with a valid payload', async () => {
    serviceMock.create.mockResolvedValue({ id: 'generated-id', ...VALID_BODY });

    await controller.create(VALID_BODY);

    expect(serviceMock.create).toHaveBeenCalledWith(VALID_BODY);
  });

  it('rejects an invalid payload before calling the service on create', async () => {
    await expect(
      controller.create({ ...VALID_BODY, expectedDailyMinutes: -1 }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  it('updates a convenção with a valid payload', async () => {
    serviceMock.update.mockResolvedValue({ id: 'c1', ...VALID_BODY });

    await controller.update('c1', VALID_BODY);

    expect(serviceMock.update).toHaveBeenCalledWith('c1', VALID_BODY);
  });

  it('deletes a convenção', async () => {
    serviceMock.delete.mockResolvedValue(undefined);

    await controller.remove('c1');

    expect(serviceMock.delete).toHaveBeenCalledWith('c1');
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js convencoes.controller
```

Expected: FAIL — `Cannot find module './convencoes.controller'`.

- [ ] **Step 7: Implement `apps/api/src/convencoes/convencoes.controller.ts`**

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
import { ConvencaoInputSchema } from '@ponto-dcit/shared-types';
import { ConvencoesService } from './convencoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('convencoes')
export class ConvencoesController {
  constructor(private readonly convencoes: ConvencoesService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get()
  list() {
    return this.convencoes.list();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Post()
  @HttpCode(201)
  create(@Body() body: unknown) {
    const result = ConvencaoInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.convencoes.create(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const result = ConvencaoInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.convencoes.update(id, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.convencoes.delete(id);
  }
}
```

- [ ] **Step 8: Create `apps/api/src/convencoes/convencoes.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConvencoesController } from './convencoes.controller';
import { ConvencoesService } from './convencoes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConvencoesController],
  providers: [ConvencoesService],
})
export class ConvencoesModule {}
```

- [ ] **Step 9: Register `ConvencoesModule` in `apps/api/src/app.module.ts`**

Add the import:

```typescript
import { ConvencoesModule } from './convencoes/convencoes.module';
```

Add `ConvencoesModule` to the `imports` array (anywhere, e.g. right after `AlertasModule`).

- [ ] **Step 10: Run the tests to verify they pass**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js convencoes
```

Expected: PASS, all 9 tests (4 service + 5 controller/guard).

- [ ] **Step 11: Lint**

```bash
cd apps/api && npx eslint src/convencoes src/app.module.ts
```

Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/convencoes apps/api/src/app.module.ts
git commit -m "feat(api): add ConvencoesController — CRUD for convenções coletivas"
```

---

### Task 4: `apps/api/src/employees` — persist `convencaoId`/`salarioMensal`

**Files:**
- Modify: `apps/api/src/employees/employees.service.ts`
- Modify: `apps/api/src/employees/employees.service.spec.ts`
- Modify: `apps/api/src/employees/employees.controller.spec.ts`

**Interfaces:**
- Consumes: `EmployeeCreateInput.convencaoId`/`.salarioMensal` (Task 2).

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/employees/employees.service.spec.ts`, add these two tests. One inside the existing `describe('create', ...)` block (right after `'persists a new employee with every personal field null'`):

```typescript
    it('persists convencaoId and salarioMensal', async () => {
      const created = await service.create({
        name: 'Fabio Convenio',
        role: 'colaborador',
        cargo: null,
        nivel: null,
        hireDate: '2026-03-01',
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
        convencaoId: 'convencao-abc',
        salarioMensal: 5000.5,
      });

      expect(created.convencaoId).toBe('convencao-abc');
      expect(created.salarioMensal).toBe(5000.5);

      await prisma.employee.delete({ where: { userId: created.userId } });
    });
```

One inside the existing `describe('updatePersonalData', ...)` block (right after the first test in that block):

```typescript
    it('updates convencaoId and salarioMensal', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-edit-convencao',
          name: 'Antes Do Convenio',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      const updated = await service.updatePersonalData('emp-edit-convencao', {
        name: 'Depois Do Convenio',
        role: 'colaborador',
        cargo: null,
        nivel: null,
        hireDate: '2024-01-01',
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
        convencaoId: 'convencao-xyz',
        salarioMensal: 6200,
      });

      expect(updated.convencaoId).toBe('convencao-xyz');
      expect(updated.salarioMensal).toBe(6200);

      await prisma.employee.delete({ where: { userId: 'emp-edit-convencao' } });
    });
```

In `apps/api/src/employees/employees.controller.spec.ts`, add `convencaoId: null, salarioMensal: null,` to the existing `VALID_CREATE_BODY` object, right after `nivel: null,`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js employees
```

Expected: the two new service tests FAIL (`created.convencaoId`/`updated.convencaoId` is `undefined`, not the expected value) — everything else still passes.

- [ ] **Step 3: Implement in `apps/api/src/employees/employees.service.ts`**

In both `create` and `updatePersonalData`'s `data: { ... }` blocks, add these two lines right after `nivel: input.nivel,`:

```typescript
          convencaoId: input.convencaoId,
          salarioMensal: input.salarioMensal,
```

(Two occurrences — one in `create`, one in `updatePersonalData`. Both blocks are otherwise identical in structure, per the existing `cargo`/`nivel` lines right above them.)

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js employees
```

Expected: PASS, every test in both `employees.service.spec.ts` and `employees.controller.spec.ts`.

- [ ] **Step 5: Run the full API test suite**

```bash
cd apps/api && node ./node_modules/jest/bin/jest.js
```

Expected: all suites pass (a pre-existing, unrelated cross-suite flake may appear in some unrelated `*.service.spec.ts` file when running the full suite together — if so, re-run that one file alone to confirm it passes in isolation, confirming it isn't caused by this task).

- [ ] **Step 6: Lint**

```bash
cd apps/api && npx eslint src/employees
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/employees/employees.service.ts apps/api/src/employees/employees.service.spec.ts apps/api/src/employees/employees.controller.spec.ts
git commit -m "feat(api): persist convencaoId/salarioMensal on colaborador create/edit"
```

---

### Task 5: Web — `/convencoes` admin page (RH-only CRUD)

**Files:**
- Modify: `apps/web/src/components/nav-links.tsx`
- Create: `apps/web/src/app/(app)/convencoes/page.tsx`
- Create: `apps/web/src/app/(app)/convencoes/convencao-form-fields.tsx`
- Create: `apps/web/src/app/(app)/convencoes/nova-convencao-dialog.tsx`
- Create: `apps/web/src/app/(app)/convencoes/editar-convencao-dialog.tsx`
- Create: `apps/web/src/app/(app)/convencoes/convencoes-row.tsx`
- Create: `apps/web/src/app/(app)/convencoes/actions.ts`
- Create: `apps/web/src/app/(app)/convencoes/convencoes.module.css`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Modify: `apps/web/e2e/test-session.ts`
- Create: `apps/web/e2e/convencoes.spec.ts`
- Modify: `apps/web/e2e/app-shell.spec.ts`

**Interfaces:**
- Consumes: `GET /convencoes`, `POST /convencoes`, `PATCH /convencoes/:id`, `DELETE /convencoes/:id` (Task 3), `apiFetchJson`/`apiFetch` (`@/lib/api`), `getSession` (`@/lib/session`), `EmptyState` (`@/components/empty-state`).
- Produces: the `mockApi()` `convencoes?: unknown[]` seed key and the `GET /convencoes → []` default fallback in `fake-api-server.mjs` — Task 6 (colaborador form) reuses both.

- [ ] **Step 1: Add the nav item to `apps/web/src/components/nav-links.tsx`**

Add `{ href: "/convencoes", label: "Convenções" }` as the last entry in `NAV_SECTIONS`, right after `"/alertas"`.

- [ ] **Step 2: Write `apps/web/src/app/(app)/convencoes/convencao-form-fields.tsx`**

```tsx
"use client";

import styles from "./convencoes.module.css";

export type ConvencaoFormDefaults = {
  nome: string;
  cnpj: string | null;
  categoriaSindical: string | null;
  expectedDailyMinutes: number | null;
  overtimePercent: number | null;
};

export function ConvencaoFormFields({ defaults }: { defaults: ConvencaoFormDefaults }) {
  return (
    <div className={styles.fieldGrid}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Nome</span>
        <input
          type="text"
          name="nome"
          required
          defaultValue={defaults.nome}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>CNPJ</span>
        <input
          type="text"
          name="cnpj"
          defaultValue={defaults.cnpj ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Categoria sindical</span>
        <input
          type="text"
          name="categoriaSindical"
          defaultValue={defaults.categoriaSindical ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Jornada esperada por dia (minutos)</span>
        <input
          type="number"
          name="expectedDailyMinutes"
          required
          min="1"
          placeholder="ex: 480 = 8h"
          defaultValue={defaults.expectedDailyMinutes ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Percentual de hora extra</span>
        <input
          type="number"
          name="overtimePercent"
          required
          min="0"
          step="0.01"
          placeholder="ex: 50 = 50%"
          defaultValue={defaults.overtimePercent ?? ""}
          className={styles.fieldInput}
        />
      </label>
    </div>
  );
}
```

`convencoes.module.css` (written in Step 8) must define `fieldGrid`/`field`/`fieldLabel`/`fieldInput` with the same rules as `apps/web/src/app/(app)/colaboradores/colaboradores.module.css` — Step 8 copies that file verbatim, so these class names already resolve correctly once Step 8 is done.

- [ ] **Step 3: Write `apps/web/src/app/(app)/convencoes/nova-convencao-dialog.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";

import { createConvencao } from "./actions";
import { ConvencaoFormFields, type ConvencaoFormDefaults } from "./convencao-form-fields";
import styles from "./convencoes.module.css";

const EMPTY_DEFAULTS: ConvencaoFormDefaults = {
  nome: "",
  cnpj: null,
  categoriaSindical: null,
  expectedDailyMinutes: null,
  overtimePercent: null,
};

export function NovaConvencaoDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createConvencao, {
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
        + Nova convenção
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Nova convenção coletiva</p>
        <form ref={formRef} action={formAction}>
          <ConvencaoFormFields defaults={EMPTY_DEFAULTS} />
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

- [ ] **Step 4: Write `apps/web/src/app/(app)/convencoes/editar-convencao-dialog.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";

import { updateConvencao } from "./actions";
import { ConvencaoFormFields, type ConvencaoFormDefaults } from "./convencao-form-fields";
import styles from "./convencoes.module.css";

type Convencao = {
  id: string;
  nome: string;
  cnpj: string | null;
  categoriaSindical: string | null;
  expectedDailyMinutes: number;
  overtimePercent: number;
};

export function EditarConvencaoDialog({ convencao }: { convencao: Convencao }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(updateConvencao, {
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

  const defaults: ConvencaoFormDefaults = {
    nome: convencao.nome,
    cnpj: convencao.cnpj,
    categoriaSindical: convencao.categoriaSindical,
    expectedDailyMinutes: convencao.expectedDailyMinutes,
    overtimePercent: convencao.overtimePercent,
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
        <p className={styles.dialogTitle}>Editar {convencao.nome}</p>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={convencao.id} />
          <ConvencaoFormFields defaults={defaults} />
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

- [ ] **Step 5: Write `apps/web/src/app/(app)/convencoes/convencoes-row.tsx`**

```tsx
"use client";

import { useRef } from "react";

import { deleteConvencao } from "./actions";
import { EditarConvencaoDialog } from "./editar-convencao-dialog";
import styles from "./convencoes.module.css";

type Convencao = {
  id: string;
  nome: string;
  cnpj: string | null;
  categoriaSindical: string | null;
  expectedDailyMinutes: number;
  overtimePercent: number;
};

function formatJornada(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

export function ConvencoesRow({ convencao }: { convencao: Convencao }) {
  const confirmDeleteRef = useRef<HTMLDialogElement>(null);

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>{convencao.nome}</span>
      <span className={styles.itemDetail}>
        {formatJornada(convencao.expectedDailyMinutes)} · {convencao.overtimePercent}% hora extra
        {convencao.categoriaSindical ? ` · ${convencao.categoriaSindical}` : ""}
      </span>
      <EditarConvencaoDialog convencao={convencao} />
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => confirmDeleteRef.current?.showModal()}
      >
        Excluir
      </button>

      <dialog ref={confirmDeleteRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Excluir {convencao.nome}?</p>
        <p className={styles.subheading}>
          Esta ação não pode ser desfeita. Colaboradores vinculados a esta convenção ficam sem
          convenção.
        </p>
        <form action={deleteConvencao}>
          <input type="hidden" name="id" value={convencao.id} />
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

- [ ] **Step 6: Write `apps/web/src/app/(app)/convencoes/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export type ConvencaoState = { error: string | null; success: boolean; successToken: number };

function buildPayload(formData: FormData): Record<string, string | null> | null {
  const nome = formData.get("nome");
  const expectedDailyMinutes = formData.get("expectedDailyMinutes");
  const overtimePercent = formData.get("overtimePercent");
  if (
    typeof nome !== "string" ||
    typeof expectedDailyMinutes !== "string" ||
    typeof overtimePercent !== "string"
  ) {
    return null;
  }

  const cnpj = formData.get("cnpj");
  const categoriaSindical = formData.get("categoriaSindical");
  return {
    nome,
    expectedDailyMinutes,
    overtimePercent,
    cnpj: typeof cnpj === "string" && cnpj !== "" ? cnpj : null,
    categoriaSindical:
      typeof categoriaSindical === "string" && categoriaSindical !== "" ? categoriaSindical : null,
  };
}

export async function createConvencao(
  _prevState: ConvencaoState,
  formData: FormData
): Promise<ConvencaoState> {
  const payload = buildPayload(formData);
  if (!payload) {
    return { error: "Dados do formulário inválidos.", success: false, successToken: _prevState.successToken };
  }

  const res = await apiFetch("/convencoes", {
    method: "POST",
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

  revalidatePath("/convencoes");
  return { error: null, success: true, successToken: Date.now() };
}

export async function updateConvencao(
  _prevState: ConvencaoState,
  formData: FormData
): Promise<ConvencaoState> {
  const id = formData.get("id");
  const payload = buildPayload(formData);
  if (typeof id !== "string" || !payload) {
    return { error: "Dados do formulário inválidos.", success: false, successToken: _prevState.successToken };
  }

  const res = await apiFetch(`/convencoes/${id}`, {
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

  revalidatePath("/convencoes");
  return { error: null, success: true, successToken: Date.now() };
}

export async function deleteConvencao(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") {
    throw new Error("Invalid form data");
  }
  const res = await apiFetch(`/convencoes/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`/convencoes/${id} responded with ${res.status}`);
  }
  revalidatePath("/convencoes");
}
```

- [ ] **Step 7: Write `apps/web/src/app/(app)/convencoes/page.tsx`**

```tsx
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ConvencoesRow } from "./convencoes-row";
import { NovaConvencaoDialog } from "./nova-convencao-dialog";
import styles from "./convencoes.module.css";

type Convencao = {
  id: string;
  nome: string;
  cnpj: string | null;
  categoriaSindical: string | null;
  expectedDailyMinutes: number;
  overtimePercent: number;
};

export default async function ConvencoesPage() {
  const session = await getSession();
  if (!session || session.role !== "rh") {
    return <EmptyState title="Sem permissão" description="Esta página é restrita ao RH." />;
  }

  const convencoes = await apiFetchJson<Convencao[]>("/convencoes");

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Convenções coletivas</h1>
        <NovaConvencaoDialog />
      </div>
      {convencoes.length === 0 ? (
        <p className={styles.subheading}>Nenhuma convenção cadastrada ainda.</p>
      ) : (
        <ul className={styles.list}>
          {convencoes.map((convencao) => (
            <ConvencoesRow key={convencao.id} convencao={convencao} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Write `apps/web/src/app/(app)/convencoes/convencoes.module.css`**

Copy `apps/web/src/app/(app)/colaboradores/colaboradores.module.css` verbatim to this new path (same classes are needed here: `page`, `heading`, `headingRow`, `subheading`, `addButton`, `list`, `item`, `itemName`, `itemDetail` — add `itemDetail` if missing, matching the alertas/operacional pages' `.itemDetail` class, `{ font-size: 14px; color: var(--color-text-secondary); }` — `dialog`, `dialogTitle`, `dialogActions`, `dialogClose`, `saveButton`, `error`, `fieldGrid`, `field`, `fieldLabel`, `fieldInput`, `deleteButton`). Remove any classes not used on this page (`timeInput`, `form`, `trash`, `trashSummary`, `fieldSelect` are colaboradores-specific and not needed here — safe to drop, but leaving them doesn't break anything either if it's simpler to just copy the whole file).

- [ ] **Step 9: Add the `/convencoes` handlers to `apps/web/e2e/fake-api-server.mjs`**

Add a default `GET /convencoes → []` fallback alongside the other unconditional-`[]` handlers (e.g. right after the `/employees` block):

```javascript
  if (req.method === "GET" && url.pathname === "/convencoes") {
    return sendJson(res, 200, []);
  }
```

Add `POST`/`PATCH`/`DELETE` handlers alongside the equivalent `/operacional/escala` ones:

```javascript
  if (req.method === "POST" && url.pathname === "/convencoes") {
    return sendJson(res, 201, { id: "generated-id", ...body });
  }
  if (req.method === "PATCH" && /^\/convencoes\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 200, { id: url.pathname.split("/")[2], ...body });
  }
  if (req.method === "DELETE" && /^\/convencoes\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
```

- [ ] **Step 10: Add the `convencoes` seed key to `apps/web/e2e/test-session.ts`**

Add `convencoes?: unknown[];` to the `data` parameter's type in `mockApi`, alongside the other optional keys. Add this block right before the closing brace of `mockApi`:

```typescript
  if (data.convencoes) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/convencoes", response: data.convencoes },
    });
  }
```

- [ ] **Step 11: Write the new tests — `apps/web/e2e/convencoes.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi } from "./test-session";

test("colaborador sees a permission message instead of the convenções list", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/convencoes");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("gestor sees a permission message instead of the convenções list", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/convencoes");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("rh sees the convenções list", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    convencoes: [
      {
        id: "conv-1",
        nome: "Convenção Metalúrgicos",
        cnpj: "12345678000199",
        categoriaSindical: "Metalúrgicos",
        expectedDailyMinutes: 480,
        overtimePercent: 50,
      },
    ],
  });

  await page.goto("/convencoes");

  await expect(page.getByRole("heading", { name: "Convenções coletivas" })).toBeVisible();
  await expect(page.getByText("Convenção Metalúrgicos")).toBeVisible();
  await expect(page.getByText(/8h.*50%/)).toBeVisible();
});

test("opens the dialog and creates a new convenção with the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { convencoes: [] });

  await page.goto("/convencoes");
  await page.getByRole("button", { name: "+ Nova convenção" }).click();
  await page.getByLabel("Nome").fill("Convenção Nova");
  await page.getByLabel("Jornada esperada por dia (minutos)").fill("440");
  await page.getByLabel("Percentual de hora extra").fill("60");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/convencoes")?.body;
    })
    .toEqual({
      nome: "Convenção Nova",
      cnpj: null,
      categoriaSindical: null,
      expectedDailyMinutes: "440",
      overtimePercent: "60",
    });
});

test("removing a convenção calls the API", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    convencoes: [
      {
        id: "conv-del",
        nome: "Convenção A Remover",
        cnpj: null,
        categoriaSindical: null,
        expectedDailyMinutes: 480,
        overtimePercent: 50,
      },
    ],
  });

  await page.goto("/convencoes");
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some((r) => r.method === "DELETE" && r.path === "/convencoes/conv-del");
    })
    .toBe(true);
});
```

- [ ] **Step 12: Add "Convenções" to the full nav-link assertion in `apps/web/e2e/app-shell.spec.ts`**

Add `await expect(page.getByRole("link", { name: "Convenções" })).toBeVisible();` right after the existing `"Alertas"` assertion.

- [ ] **Step 13: Run the build to catch type errors**

```bash
pnpm --filter @ponto-dcit/web run build
```

Expected: succeeds, `/convencoes` listed in the route output.

- [ ] **Step 14: Run the e2e suite**

Check port 3000 is free first (`netstat -ano | grep ":3000 "`; `taskkill //F //PID <pid>` if something's there), then from `apps/web`:

```bash
npx playwright test e2e/convencoes.spec.ts e2e/app-shell.spec.ts
```

Expected: all pass (6 new + 3 existing app-shell tests).

- [ ] **Step 15: Lint**

```bash
cd apps/web && npx eslint "src/app/(app)/convencoes" src/components/nav-links.tsx e2e/convencoes.spec.ts e2e/app-shell.spec.ts e2e/fake-api-server.mjs e2e/test-session.ts
```

Expected: no errors.

- [ ] **Step 16: Commit**

```bash
git add apps/web/src/components/nav-links.tsx "apps/web/src/app/(app)/convencoes" apps/web/e2e/fake-api-server.mjs apps/web/e2e/test-session.ts apps/web/e2e/convencoes.spec.ts apps/web/e2e/app-shell.spec.ts
git commit -m "feat(web): add Convenções nav item and RH-only CRUD page"
```

---

### Task 6: Web — colaborador form gains `convencaoId`/`salarioMensal`

**Files:**
- Modify: `apps/web/src/app/(app)/colaboradores/colaborador-form-fields.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/novo-colaborador-dialog.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/editar-colaborador-dialog.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/page.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/employee-optional-fields.ts`
- Modify: `apps/web/e2e/colaboradores.spec.ts`

**Interfaces:**
- Consumes: `GET /convencoes` (Task 3), the `mockApi()` `convencoes` seed key and `fake-api-server.mjs` default (Task 5).

- [ ] **Step 1: Update `apps/web/src/app/(app)/colaboradores/employee-optional-fields.ts`**

Add `"convencaoId"` and `"salarioMensal"` to the `OPTIONAL_FIELDS` array, anywhere (e.g. right after `"nivel"`).

- [ ] **Step 2: Update `apps/web/src/app/(app)/colaboradores/colaborador-form-fields.tsx`**

Add a new prop `convencoes: { id: string; nome: string }[]` to the component's props (alongside the existing `defaults` prop) — the function signature becomes:

```tsx
export function ColaboradorFormFields({
  defaults,
  convencoes,
}: {
  defaults: ColaboradorFormDefaults;
  convencoes: { id: string; nome: string }[];
}) {
```

Add `convencaoId: string | null;` and `salarioMensal: number | null;` to the `ColaboradorFormDefaults` type.

Add two new fields right after the "Nível" `<label>` block, before "Data de admissão":

```tsx
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Convenção coletiva</span>
        <select
          name="convencaoId"
          defaultValue={defaults.convencaoId ?? ""}
          className={styles.fieldSelect}
        >
          <option value="">—</option>
          {convencoes.map((convencao) => (
            <option key={convencao.id} value={convencao.id}>
              {convencao.nome}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Salário mensal</span>
        <input
          type="number"
          name="salarioMensal"
          min="0"
          step="0.01"
          placeholder="R$"
          defaultValue={defaults.salarioMensal ?? ""}
          className={styles.fieldInput}
        />
      </label>
```

- [ ] **Step 3: Update `apps/web/src/app/(app)/colaboradores/novo-colaborador-dialog.tsx`**

Add `convencaoId: null,` and `salarioMensal: null,` to `EMPTY_DEFAULTS`, anywhere among the other `null` fields.

Add a new prop `convencoes: { id: string; nome: string }[]` to `NovoColaboradorDialog`'s props, and pass it through to `<ColaboradorFormFields defaults={EMPTY_DEFAULTS} convencoes={convencoes} />`. The component signature becomes:

```tsx
export function NovoColaboradorDialog({ convencoes }: { convencoes: { id: string; nome: string }[] }) {
```

- [ ] **Step 4: Update `apps/web/src/app/(app)/colaboradores/editar-colaborador-dialog.tsx`**

Add `convencaoId: string | null;` and `salarioMensal: number | null;` to the local `Employee` type.

Add a new prop `convencoes: { id: string; nome: string }[]` to `EditarColaboradorDialog`'s props:

```tsx
export function EditarColaboradorDialog({
  employee,
  convencoes,
}: {
  employee: Employee;
  convencoes: { id: string; nome: string }[];
}) {
```

Add `convencaoId: employee.convencaoId ?? null,` and `salarioMensal: employee.salarioMensal ?? null,` to the `defaults` object, and pass `convencoes={convencoes}` to `<ColaboradorFormFields defaults={defaults} convencoes={convencoes} />`.

- [ ] **Step 5: Update `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`**

Add `convencaoId: string | null;` and `salarioMensal: number | null;` to the local `Employee` type.

Add a new prop `convencoes: { id: string; nome: string }[]` to `ColaboradoresRow`'s props, and pass it to `<EditarColaboradorDialog employee={employee} convencoes={convencoes} />`. Signature becomes:

```tsx
export function ColaboradoresRow({
  employee,
  convencoes,
}: {
  employee: Employee;
  convencoes: { id: string; nome: string }[];
}) {
```

- [ ] **Step 6: Update `apps/web/src/app/(app)/colaboradores/page.tsx`**

Add `convencaoId: string | null;` and `salarioMensal: number | null;` to the local `Employee` type.

Fetch `/convencoes` in parallel with `/employees`:

```tsx
  const [employees, convencoes] = await Promise.all([
    apiFetchJson<Employee[]>("/employees"),
    apiFetchJson<{ id: string; nome: string }[]>("/convencoes"),
  ]);
```

Pass `convencoes` down to `<NovoColaboradorDialog convencoes={convencoes} />` and to each `<ColaboradoresRow key={employee.userId} employee={employee} convencoes={convencoes} />`.

- [ ] **Step 7: Update `apps/web/e2e/colaboradores.spec.ts`**

Add `convencaoId: null,` and `salarioMensal: null,` to the two existing `.toEqual({...})` payload-assertion blocks (the create test and the edit test), right after each block's `nivel: null,` line — both are at the two locations that currently read `cargo: null,\n      nivel: null,`.

- [ ] **Step 8: Run the build to catch type errors**

```bash
pnpm --filter @ponto-dcit/web run build
```

Expected: succeeds.

- [ ] **Step 9: Run the e2e suite**

```bash
cd apps/web && npx playwright test e2e/colaboradores.spec.ts
```

Expected: all pass (this file has ~16 tests; the default `GET /convencoes → []` fallback from Task 5 means tests that don't explicitly seed `convencoes` still work, since the new `<select>` just renders empty).

- [ ] **Step 10: Lint**

```bash
cd apps/web && npx eslint "src/app/(app)/colaboradores" e2e/colaboradores.spec.ts
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add "apps/web/src/app/(app)/colaboradores" apps/web/e2e/colaboradores.spec.ts
git commit -m "feat(web): add Convenção coletiva and Salário mensal to the colaborador form"
```

---

### Task 7: Final verification

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

Expected: all pass. If a single, unrelated test fails only when the full API suite runs together (pre-existing cross-suite `test.db` flakiness — see Task 4 Step 5), re-run it alone to confirm.

- [ ] **Step 3: Manually exercise the golden path in a running app**

With the mock IdP, API, and web dev servers running:

1. Log in as `rh-1`, go to the new "Convenções" nav item, create a convenção (e.g. "Convenção Teste", 480 min, 50%).
2. Go to "Colaboradores", open "+ Novo colaborador", confirm the "Convenção coletiva" dropdown lists the one just created, and "Salário mensal" accepts a value.
3. Save, then edit the same colaborador and confirm both fields round-trip (show the saved value on reopen).
4. Log in as `gestor-1`: confirm they can see and use the "Convenção coletiva" dropdown on the colaborador form (read access), but get "Sem permissão" on `/convencoes` directly (management is RH-only).

- [ ] **Step 4: Report status update to the spec**

Add/update the `**Status:**` line at the top of `docs/superpowers/specs/2026-08-29-convencoes-coletivas-design.md` to `Implementado`, and commit:

```bash
git add docs/superpowers/specs/2026-08-29-convencoes-coletivas-design.md
git commit -m "docs: mark convenções coletivas spec as implemented"
```
