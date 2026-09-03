# Gestão de Carreiras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manager-only "Gestão de Carreiras" feature — career track/promotion eligibility, PDI goals, manager-only performance evaluations, a manual nine-box matrix, and structured 1:1 records — with an automatic promotability badge surfaced on the existing `/colaboradores` team listing.

**Architecture:** Six new Prisma models (no `@relation`, matching this schema's existing style — every cross-entity reference is a bare `String` resolved manually in the service layer), one new NestJS module (`apps/api/src/carreira/`) with one controller+service pair per sub-resource (this feature has 6 models/~18 routes, roughly double Documentos' 3-models/11-routes, which is the point past which this codebase's own file-size norms call for a split — see File Structure below), a shared-types file of Zod input schemas, one new gestor-only Next.js page (`/gestao-carreiras`) with tabs driven by `?aba=`, one sidebar change (a new collapsible group, gestor-only), and one small addition to the existing `/colaboradores` row component for the promotability badge.

**Tech Stack:** NestJS 11 + Prisma 6 (SQLite) on `apps/api`; Next.js 16 (App Router, Server Components + Server Actions) on `apps/web`; Zod schemas shared via `packages/shared-types`; Jest for backend tests.

**Spec:** [`docs/superpowers/specs/2026-09-02-gestao-carreiras-design.md`](../specs/2026-09-02-gestao-carreiras-design.md)

## Global Constraints

- RBAC for every new backend route is `@Roles('gestor')` only — **never** `'rh'`, which is a deliberate deviation from this codebase's usual gestor+rh pairing (the original request was explicit: "Apenas Gestor").
- No new `@relation`/FK in Prisma — every cross-entity reference (`userId`, `evaluatorId`, `gestorId`, `oneOnOneId`) is a plain `String`, resolved manually in the service layer, matching every existing model in this schema.
- `evaluatorId`/`gestorId` are always read from the authenticated session (`req.user.sub`), never accepted from the request body.
- `hireDate` is reused as the "tempo no cargo atual" proxy for promotability — there is no separate field for date of last promotion, and this plan does not add one.
- `NineBoxPlacement` and `PerformanceEvaluation` rows are insert-only — never updated in place. "Current" value is always the most recent by `date` for a given `userId`.
- The promotability badge and its backing request only ever run for `session.role === "gestor"` on `/colaboradores` — zero behavior change for `rh`.
- The 3-month minimum tenure and the "≥ 4 average" evaluation threshold are fixed constants in code, not configurable.

---

## File Structure

**Backend (`apps/api`):**
- `apps/api/prisma/schema.prisma` — modified, 6 new models appended.
- `apps/api/src/carreira/metas.service.ts` / `metas.controller.ts` / `metas.service.spec.ts` / `metas.controller.spec.ts` — `CareerGoal` CRUD.
- `apps/api/src/carreira/trilha.service.ts` / `trilha.controller.ts` / `trilha.service.spec.ts` / `trilha.controller.spec.ts` — `TrackRequirement` CRUD.
- `apps/api/src/carreira/avaliacoes.service.ts` / `avaliacoes.controller.ts` / `avaliacoes.service.spec.ts` / `avaliacoes.controller.spec.ts` — `PerformanceEvaluation` create+list.
- `apps/api/src/carreira/nine-box.service.ts` / `nine-box.controller.ts` / `nine-box.service.spec.ts` / `nine-box.controller.spec.ts` — `NineBoxPlacement` create+list+current.
- `apps/api/src/carreira/one-on-ones.service.ts` / `one-on-ones.controller.ts` / `one-on-ones.service.spec.ts` / `one-on-ones.controller.spec.ts` — `OneOnOne` + `OneOnOneAcao`.
- `apps/api/src/carreira/promotabilidade.service.ts` / `promotabilidade.controller.ts` / `promotabilidade.service.spec.ts` / `promotabilidade.controller.spec.ts` — the calculation, batch + single-employee lookup.
- `apps/api/src/carreira/carreira.module.ts` — declares all 6 controllers/services.
- `apps/api/src/app.module.ts` — modified, imports `CarreiraModule`.

**Shared types:**
- `packages/shared-types/src/carreira.ts` / `carreira.test.ts` — Zod schemas for every create/update input.
- `packages/shared-types/src/index.ts` — modified, re-exports the above.

**Frontend (`apps/web`):**
- `apps/web/src/lib/nav-sections.ts` — modified, new `GESTOR_CAREER_GROUP`.
- `apps/web/src/components/nav-links.tsx` — modified, new gestor branch in `NavLinks`.
- `apps/web/src/app/(app)/gestao-carreiras/page.tsx` — new, colaborador selector + tab shell.
- `apps/web/src/app/(app)/gestao-carreiras/actions.ts` — new, all Server Actions.
- `apps/web/src/app/(app)/gestao-carreiras/metas-section.tsx` — new, PDI/entregas tab UI.
- `apps/web/src/app/(app)/gestao-carreiras/trilha-section.tsx` — new, trilha tab UI.
- `apps/web/src/app/(app)/gestao-carreiras/avaliacoes-section.tsx` — new, avaliações tab UI (ciclos/1:1/nine-box sub-tabs).
- `apps/web/src/app/(app)/gestao-carreiras/gestao-carreiras.module.css` — new.
- `apps/web/src/app/(app)/colaboradores/page.tsx` — modified, fetches promotabilidade for gestor.
- `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx` — modified, renders the badge.

---

### Task 1: Prisma schema — 6 new models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Test: `apps/api/src/carreira/schema.spec.ts`

**Interfaces:**
- Produces: Prisma Client accessors `prisma.careerGoal`, `prisma.trackRequirement`, `prisma.performanceEvaluation`, `prisma.nineBoxPlacement`, `prisma.oneOnOne`, `prisma.oneOnOneAcao`, each with the fields listed below. Every later task depends on this.

- [ ] **Step 1: Write the failing smoke test**

Create `apps/api/src/carreira/schema.spec.ts`:

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';

describe('carreira Prisma models', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.employee.create({
      data: {
        userId: 'schema-spec-employee',
        name: 'Schema Spec Employee',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
      },
    });
  });

  afterAll(async () => {
    await prisma.oneOnOneAcao.deleteMany();
    await prisma.oneOnOne.deleteMany();
    await prisma.nineBoxPlacement.deleteMany();
    await prisma.performanceEvaluation.deleteMany();
    await prisma.trackRequirement.deleteMany();
    await prisma.careerGoal.deleteMany();
    await prisma.employee.delete({ where: { userId: 'schema-spec-employee' } });
    await prisma.onModuleDestroy();
  });

  it('creates and reads a CareerGoal', async () => {
    const goal = await prisma.careerGoal.create({
      data: { userId: 'schema-spec-employee', tipo: 'pdi', title: 'Tirar certificação' },
    });
    expect(goal.status).toBe('pendente');
  });

  it('creates and reads a TrackRequirement', async () => {
    const req = await prisma.trackRequirement.create({
      data: { userId: 'schema-spec-employee', title: 'Certificação AWS' },
    });
    expect(req.status).toBe('pendente');
  });

  it('creates and reads a PerformanceEvaluation', async () => {
    const evaluation = await prisma.performanceEvaluation.create({
      data: {
        userId: 'schema-spec-employee',
        evaluatorId: 'schema-spec-gestor',
        proatividade: 4,
        trabalhoEquipe: 4,
        comunicacao: 4,
        lideranca: 4,
      },
    });
    expect(evaluation.proatividade).toBe(4);
  });

  it('creates and reads a NineBoxPlacement', async () => {
    const placement = await prisma.nineBoxPlacement.create({
      data: {
        userId: 'schema-spec-employee',
        gestorId: 'schema-spec-gestor',
        desempenho: 'alto',
        potencial: 'medio',
      },
    });
    expect(placement.desempenho).toBe('alto');
  });

  it('creates a OneOnOne with its acoes', async () => {
    const oneOnOne = await prisma.oneOnOne.create({
      data: { userId: 'schema-spec-employee', gestorId: 'schema-spec-gestor', pauta: 'Alinhamento mensal' },
    });
    const acao = await prisma.oneOnOneAcao.create({
      data: { oneOnOneId: oneOnOne.id, descricao: 'Enviar relatório' },
    });
    expect(acao.status).toBe('pendente');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/schema.spec.ts`
Expected: FAIL — `prisma.careerGoal is not a function` (or equivalent, since the model doesn't exist yet).

- [ ] **Step 3: Add the 6 models to schema.prisma**

Append to `apps/api/prisma/schema.prisma`:

```prisma
model CareerGoal {
  id          String    @id @default(uuid())
  userId      String    // colaborador dono da meta
  tipo        String    // "pdi" | "entrega"
  title       String
  description String?
  dueDate     DateTime?
  status      String    @default("pendente") // "pendente" | "andamento" | "concluida"
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model TrackRequirement {
  id        String   @id @default(uuid())
  userId    String
  title     String
  status    String   @default("pendente") // "pendente" | "andamento" | "concluido"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PerformanceEvaluation {
  id             String   @id @default(uuid())
  userId         String
  evaluatorId    String
  date           DateTime @default(now())
  proatividade   Int
  trabalhoEquipe Int
  comunicacao    Int
  lideranca      Int
  comentario     String?
  createdAt      DateTime @default(now())
}

model NineBoxPlacement {
  id         String   @id @default(uuid())
  userId     String
  gestorId   String
  desempenho String   // "baixo" | "medio" | "alto"
  potencial  String   // "baixo" | "medio" | "alto"
  date       DateTime @default(now())
  createdAt  DateTime @default(now())
}

model OneOnOne {
  id          String    @id @default(uuid())
  userId      String
  gestorId    String
  date        DateTime  @default(now())
  pauta       String
  proximaData DateTime?
  createdAt   DateTime  @default(now())
}

model OneOnOneAcao {
  id         String   @id @default(uuid())
  oneOnOneId String
  descricao  String
  status     String   @default("pendente") // "pendente" | "concluido"
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 4: Run the migration**

Run (from `apps/api`): `npx prisma migrate dev --name add_carreira_models`
Expected: creates a new folder under `apps/api/prisma/migrations/`, regenerates the Prisma Client. If prompted about the SQLite dev database, allow it to apply (no data loss — purely additive).

- [ ] **Step 5: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/schema.spec.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/carreira/schema.spec.ts
git commit -m "feat(api): add carreira Prisma models"
```

---

### Task 2: Shared Zod schemas

**Files:**
- Create: `packages/shared-types/src/carreira.ts`
- Create: `packages/shared-types/src/carreira.test.ts`
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `CAREER_GOAL_TIPOS`, `STATUS_TAREFA`, `STATUS_REQUISITO`, `NIVEL_NINE_BOX`, `STATUS_ACAO` (const tuples); `CareerGoalCreateSchema`, `CareerGoalUpdateSchema`, `TrackRequirementCreateSchema`, `TrackRequirementUpdateSchema`, `PerformanceEvaluationCreateSchema`, `NineBoxPlacementCreateSchema`, `OneOnOneCreateSchema`, `OneOnOneAcaoUpdateSchema` (Zod schemas) and their inferred `*Input` types, all importable from `@ponto-dcit/shared-types`. Tasks 3–7's controllers import these.

- [ ] **Step 1: Write the failing test**

Create `packages/shared-types/src/carreira.test.ts`:

```typescript
import {
  CareerGoalCreateSchema,
  TrackRequirementCreateSchema,
  PerformanceEvaluationCreateSchema,
  NineBoxPlacementCreateSchema,
  OneOnOneCreateSchema,
  OneOnOneAcaoUpdateSchema,
} from "./carreira";

describe("CareerGoalCreateSchema", () => {
  it("accepts a valid pdi goal", () => {
    const result = CareerGoalCreateSchema.safeParse({
      userId: "user-1",
      tipo: "pdi",
      title: "Tirar certificação Azure",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid tipo", () => {
    const result = CareerGoalCreateSchema.safeParse({
      userId: "user-1",
      tipo: "okr",
      title: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("TrackRequirementCreateSchema", () => {
  it("rejects an empty title", () => {
    const result = TrackRequirementCreateSchema.safeParse({ userId: "user-1", title: "" });
    expect(result.success).toBe(false);
  });
});

describe("PerformanceEvaluationCreateSchema", () => {
  it("rejects a score above 5", () => {
    const result = PerformanceEvaluationCreateSchema.safeParse({
      userId: "user-1",
      proatividade: 6,
      trabalhoEquipe: 5,
      comunicacao: 5,
      lideranca: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all scores at the boundary values 1 and 5", () => {
    const result = PerformanceEvaluationCreateSchema.safeParse({
      userId: "user-1",
      proatividade: 1,
      trabalhoEquipe: 5,
      comunicacao: 1,
      lideranca: 5,
    });
    expect(result.success).toBe(true);
  });
});

describe("NineBoxPlacementCreateSchema", () => {
  it("rejects an invalid eixo value", () => {
    const result = NineBoxPlacementCreateSchema.safeParse({
      userId: "user-1",
      desempenho: "excelente",
      potencial: "alto",
    });
    expect(result.success).toBe(false);
  });
});

describe("OneOnOneCreateSchema", () => {
  it("defaults acoes to an empty array", () => {
    const result = OneOnOneCreateSchema.safeParse({ userId: "user-1", pauta: "Conversa mensal" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.acoes).toEqual([]);
  });
});

describe("OneOnOneAcaoUpdateSchema", () => {
  it("rejects an invalid status", () => {
    const result = OneOnOneAcaoUpdateSchema.safeParse({ status: "em_andamento" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/shared-types`): `npx jest src/carreira.test.ts`
Expected: FAIL — cannot find module `./carreira`.

- [ ] **Step 3: Write the implementation**

Create `packages/shared-types/src/carreira.ts`:

```typescript
import { z } from "zod";

export const CAREER_GOAL_TIPOS = ["pdi", "entrega"] as const;
export const STATUS_TAREFA = ["pendente", "andamento", "concluida"] as const;
export const STATUS_REQUISITO = ["pendente", "andamento", "concluido"] as const;
export const NIVEL_NINE_BOX = ["baixo", "medio", "alto"] as const;
export const STATUS_ACAO = ["pendente", "concluido"] as const;

export const CareerGoalCreateSchema = z.object({
  userId: z.string().min(1),
  tipo: z.enum(CAREER_GOAL_TIPOS),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});
export type CareerGoalCreateInput = z.infer<typeof CareerGoalCreateSchema>;

export const CareerGoalUpdateSchema = z.object({
  status: z.enum(STATUS_TAREFA),
});
export type CareerGoalUpdateInput = z.infer<typeof CareerGoalUpdateSchema>;

export const TrackRequirementCreateSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
});
export type TrackRequirementCreateInput = z.infer<typeof TrackRequirementCreateSchema>;

export const TrackRequirementUpdateSchema = z.object({
  status: z.enum(STATUS_REQUISITO),
});
export type TrackRequirementUpdateInput = z.infer<typeof TrackRequirementUpdateSchema>;

export const PerformanceEvaluationCreateSchema = z.object({
  userId: z.string().min(1),
  proatividade: z.number().int().min(1).max(5),
  trabalhoEquipe: z.number().int().min(1).max(5),
  comunicacao: z.number().int().min(1).max(5),
  lideranca: z.number().int().min(1).max(5),
  comentario: z.string().optional(),
});
export type PerformanceEvaluationCreateInput = z.infer<typeof PerformanceEvaluationCreateSchema>;

export const NineBoxPlacementCreateSchema = z.object({
  userId: z.string().min(1),
  desempenho: z.enum(NIVEL_NINE_BOX),
  potencial: z.enum(NIVEL_NINE_BOX),
});
export type NineBoxPlacementCreateInput = z.infer<typeof NineBoxPlacementCreateSchema>;

export const OneOnOneCreateSchema = z.object({
  userId: z.string().min(1),
  pauta: z.string().min(1),
  proximaData: z.string().datetime().optional(),
  acoes: z.array(z.object({ descricao: z.string().min(1) })).default([]),
});
export type OneOnOneCreateInput = z.infer<typeof OneOnOneCreateSchema>;

export const OneOnOneAcaoUpdateSchema = z.object({
  status: z.enum(STATUS_ACAO),
});
export type OneOnOneAcaoUpdateInput = z.infer<typeof OneOnOneAcaoUpdateSchema>;
```

- [ ] **Step 4: Export from index.ts**

Append to `packages/shared-types/src/index.ts`:

```typescript
export {
  CAREER_GOAL_TIPOS,
  STATUS_TAREFA,
  STATUS_REQUISITO,
  NIVEL_NINE_BOX,
  STATUS_ACAO,
  CareerGoalCreateSchema,
  CareerGoalUpdateSchema,
  TrackRequirementCreateSchema,
  TrackRequirementUpdateSchema,
  PerformanceEvaluationCreateSchema,
  NineBoxPlacementCreateSchema,
  OneOnOneCreateSchema,
  OneOnOneAcaoUpdateSchema,
} from "./carreira";
export type {
  CareerGoalCreateInput,
  CareerGoalUpdateInput,
  TrackRequirementCreateInput,
  TrackRequirementUpdateInput,
  PerformanceEvaluationCreateInput,
  NineBoxPlacementCreateInput,
  OneOnOneCreateInput,
  OneOnOneAcaoUpdateInput,
} from "./carreira";
```

- [ ] **Step 5: Run test to verify it passes**

Run (from `packages/shared-types`): `npx jest src/carreira.test.ts`
Expected: PASS, all 7 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/carreira.ts packages/shared-types/src/carreira.test.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add carreira input schemas"
```

---

### Task 3: Backend — Metas (CareerGoal)

**Files:**
- Create: `apps/api/src/carreira/metas.service.ts`
- Create: `apps/api/src/carreira/metas.controller.ts`
- Create: `apps/api/src/carreira/metas.service.spec.ts`
- Create: `apps/api/src/carreira/metas.controller.spec.ts`
- Create: `apps/api/src/carreira/carreira.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `prisma.careerGoal` (Task 1); `CareerGoalCreateSchema`, `CareerGoalUpdateSchema`, `CareerGoalCreateInput` from `@ponto-dcit/shared-types` (Task 2).
- Produces: `CareerGoalsService` with `list(userId: string)`, `create(input: CareerGoalCreateInput)`, `updateStatus(id: string, status: string)`, `remove(id: string)`. `CarreiraModule` (imported by `app.module.ts`) — Tasks 4–8 add their controllers/providers to this same module file.

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/carreira/metas.service.spec.ts`:

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { CareerGoalsService } from './metas.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CareerGoalsService', () => {
  let service: CareerGoalsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CareerGoalsService, PrismaService],
    }).compile();
    service = module.get(CareerGoalsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.careerGoal.deleteMany({ where: { userId: 'metas-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates a goal defaulting to pendente', async () => {
    const goal = await service.create({ userId: 'metas-spec-user', tipo: 'pdi', title: 'Certificação Azure' });
    expect(goal.status).toBe('pendente');
    expect(goal.tipo).toBe('pdi');
  });

  it('lists only goals for the given user', async () => {
    await service.create({ userId: 'metas-spec-other', tipo: 'entrega', title: 'Projeto X' });
    const goals = await service.list('metas-spec-user');
    expect(goals.every((g) => g.userId === 'metas-spec-user')).toBe(true);
  });

  it('updates status', async () => {
    const goal = await service.create({ userId: 'metas-spec-user', tipo: 'entrega', title: 'Projeto Y' });
    const updated = await service.updateStatus(goal.id, 'concluida');
    expect(updated.status).toBe('concluida');
  });

  it('removes a goal', async () => {
    const goal = await service.create({ userId: 'metas-spec-user', tipo: 'pdi', title: 'Temp' });
    await service.remove(goal.id);
    const goals = await service.list('metas-spec-user');
    expect(goals.find((g) => g.id === goal.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/metas.service.spec.ts`
Expected: FAIL — cannot find module `./metas.service`.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/carreira/metas.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { CareerGoalCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CareerGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.careerGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: CareerGoalCreateInput) {
    return this.prisma.careerGoal.create({
      data: {
        userId: input.userId,
        tipo: input.tipo,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
    });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.careerGoal.update({ where: { id }, data: { status } });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.careerGoal.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/metas.service.spec.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Write the failing controller test**

Create `apps/api/src/carreira/metas.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['list', 'create', 'updateStatus', 'remove'] as const;

describe('CareerGoalsController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      CareerGoalsController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      CareerGoalsController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('CareerGoalsController', () => {
  let controller: CareerGoalsController;
  const serviceMock = {
    list: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CareerGoalsController],
      providers: [{ provide: CareerGoalsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(CareerGoalsController);
  });

  function requestAs(): Request & { user: AuthenticatedUser } {
    return { user: { sub: 'gestor-1', role: 'gestor', name: 'Gestor Teste' } } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('lists goals for the given userId', async () => {
    serviceMock.list.mockResolvedValue([]);
    await controller.list('user-1');
    expect(serviceMock.list).toHaveBeenCalledWith('user-1');
  });

  it('parses and creates a valid goal', async () => {
    serviceMock.create.mockResolvedValue({ id: 'goal-1' });
    await controller.create({ userId: 'user-1', tipo: 'pdi', title: 'Meta' });
    expect(serviceMock.create).toHaveBeenCalledWith({ userId: 'user-1', tipo: 'pdi', title: 'Meta' });
  });

  it('rejects an invalid body on create', async () => {
    await expect(controller.create({ userId: 'user-1', tipo: 'invalido', title: 'x' })).rejects.toThrow();
  });

  it('updates status with a valid body', async () => {
    serviceMock.updateStatus.mockResolvedValue({ id: 'goal-1', status: 'concluida' });
    await controller.updateStatus('goal-1', { status: 'concluida' });
    expect(serviceMock.updateStatus).toHaveBeenCalledWith('goal-1', 'concluida');
  });

  it('removes a goal', async () => {
    await controller.remove('goal-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('goal-1');
  });

  void requestAs; // reserved for future session-scoped assertions in this file
});
```

- [ ] **Step 6: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/metas.controller.spec.ts`
Expected: FAIL — cannot find module `./metas.controller`.

- [ ] **Step 7: Implement the controller**

Create `apps/api/src/carreira/metas.controller.ts`:

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
  Query,
  UseGuards,
} from '@nestjs/common';
import { CareerGoalCreateSchema, CareerGoalUpdateSchema } from '@ponto-dcit/shared-types';
import { CareerGoalsService } from './metas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('carreira/metas')
export class CareerGoalsController {
  constructor(private readonly goals: CareerGoalsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.goals.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  create(@Body() body: unknown) {
    const result = CareerGoalCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.goals.create(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = CareerGoalUpdateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.goals.updateStatus(id, result.data.status);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.goals.remove(id);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/metas.controller.spec.ts`
Expected: PASS, all 7 tests green (6 guard-metadata + behavior tests).

- [ ] **Step 9: Create the module and wire it into the app**

Create `apps/api/src/carreira/carreira.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CareerGoalsController],
  providers: [CareerGoalsService],
})
export class CarreiraModule {}
```

Modify `apps/api/src/app.module.ts` — add the import and register it in the `imports` array (alongside the other feature modules, e.g. right after `PontoPerdidoModule`):

```typescript
import { CarreiraModule } from './carreira/carreira.module';
// ...
    PontoPerdidoModule,
    CarreiraModule,
```

- [ ] **Step 10: Run the full backend suite**

Run (from `apps/api`): `npx jest`
Expected: PASS — no regressions in other modules from the `app.module.ts` change.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/carreira/metas.service.ts apps/api/src/carreira/metas.controller.ts apps/api/src/carreira/metas.service.spec.ts apps/api/src/carreira/metas.controller.spec.ts apps/api/src/carreira/carreira.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): add carreira metas (CareerGoal) endpoints"
```

---

### Task 4: Backend — Trilha (TrackRequirement)

**Files:**
- Create: `apps/api/src/carreira/trilha.service.ts`
- Create: `apps/api/src/carreira/trilha.controller.ts`
- Create: `apps/api/src/carreira/trilha.service.spec.ts`
- Create: `apps/api/src/carreira/trilha.controller.spec.ts`
- Modify: `apps/api/src/carreira/carreira.module.ts`

**Interfaces:**
- Consumes: `prisma.trackRequirement` (Task 1); `TrackRequirementCreateSchema`, `TrackRequirementUpdateSchema` from `@ponto-dcit/shared-types` (Task 2); `CarreiraModule` (Task 3, to extend).
- Produces: `TrackRequirementsService` with `list(userId)`, `create(input)`, `updateStatus(id, status)`, `remove(id)`. Task 8 (Promotabilidade) reads `prisma.trackRequirement` directly, not through this service, so no other task consumes this service directly.

This mirrors Task 3 exactly, on the `TrackRequirement` model instead of `CareerGoal`.

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/carreira/trilha.service.spec.ts`:

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { TrackRequirementsService } from './trilha.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TrackRequirementsService', () => {
  let service: TrackRequirementsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrackRequirementsService, PrismaService],
    }).compile();
    service = module.get(TrackRequirementsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.trackRequirement.deleteMany({ where: { userId: 'trilha-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates a requirement defaulting to pendente', async () => {
    const req = await service.create({ userId: 'trilha-spec-user', title: 'Certificação AWS' });
    expect(req.status).toBe('pendente');
  });

  it('lists only requirements for the given user', async () => {
    await service.create({ userId: 'trilha-spec-other', title: 'Outro' });
    const reqs = await service.list('trilha-spec-user');
    expect(reqs.every((r) => r.userId === 'trilha-spec-user')).toBe(true);
  });

  it('updates status', async () => {
    const req = await service.create({ userId: 'trilha-spec-user', title: 'Curso X' });
    const updated = await service.updateStatus(req.id, 'concluido');
    expect(updated.status).toBe('concluido');
  });

  it('removes a requirement', async () => {
    const req = await service.create({ userId: 'trilha-spec-user', title: 'Temp' });
    await service.remove(req.id);
    const reqs = await service.list('trilha-spec-user');
    expect(reqs.find((r) => r.id === req.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/trilha.service.spec.ts`
Expected: FAIL — cannot find module `./trilha.service`.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/carreira/trilha.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { TrackRequirementCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackRequirementsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.trackRequirement.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: TrackRequirementCreateInput) {
    return this.prisma.trackRequirement.create({
      data: { userId: input.userId, title: input.title },
    });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.trackRequirement.update({ where: { id }, data: { status } });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.trackRequirement.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/trilha.service.spec.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Write the failing controller test**

Create `apps/api/src/carreira/trilha.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TrackRequirementsController } from './trilha.controller';
import { TrackRequirementsService } from './trilha.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

const GUARDED_HANDLERS = ['list', 'create', 'updateStatus', 'remove'] as const;

describe('TrackRequirementsController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      TrackRequirementsController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      TrackRequirementsController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('TrackRequirementsController', () => {
  let controller: TrackRequirementsController;
  const serviceMock = { list: jest.fn(), create: jest.fn(), updateStatus: jest.fn(), remove: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrackRequirementsController],
      providers: [{ provide: TrackRequirementsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TrackRequirementsController);
  });

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('parses and creates a valid requirement', async () => {
    serviceMock.create.mockResolvedValue({ id: 'req-1' });
    await controller.create({ userId: 'user-1', title: 'Curso' });
    expect(serviceMock.create).toHaveBeenCalledWith({ userId: 'user-1', title: 'Curso' });
  });

  it('rejects an invalid body on create', async () => {
    await expect(controller.create({ userId: 'user-1', title: '' })).rejects.toThrow();
  });

  it('updates status with a valid body', async () => {
    serviceMock.updateStatus.mockResolvedValue({ id: 'req-1', status: 'concluido' });
    await controller.updateStatus('req-1', { status: 'concluido' });
    expect(serviceMock.updateStatus).toHaveBeenCalledWith('req-1', 'concluido');
  });

  it('removes a requirement', async () => {
    await controller.remove('req-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('req-1');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/trilha.controller.spec.ts`
Expected: FAIL — cannot find module `./trilha.controller`.

- [ ] **Step 7: Implement the controller**

Create `apps/api/src/carreira/trilha.controller.ts`:

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
  Query,
  UseGuards,
} from '@nestjs/common';
import { TrackRequirementCreateSchema, TrackRequirementUpdateSchema } from '@ponto-dcit/shared-types';
import { TrackRequirementsService } from './trilha.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('carreira/trilha')
export class TrackRequirementsController {
  constructor(private readonly requirements: TrackRequirementsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.requirements.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  create(@Body() body: unknown) {
    const result = TrackRequirementCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.requirements.create(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = TrackRequirementUpdateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.requirements.updateStatus(id, result.data.status);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.requirements.remove(id);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/trilha.controller.spec.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 9: Register in the module**

Modify `apps/api/src/carreira/carreira.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { TrackRequirementsController } from './trilha.controller';
import { TrackRequirementsService } from './trilha.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CareerGoalsController, TrackRequirementsController],
  providers: [CareerGoalsService, TrackRequirementsService],
})
export class CarreiraModule {}
```

- [ ] **Step 10: Run the full backend suite**

Run (from `apps/api`): `npx jest`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/carreira/trilha.service.ts apps/api/src/carreira/trilha.controller.ts apps/api/src/carreira/trilha.service.spec.ts apps/api/src/carreira/trilha.controller.spec.ts apps/api/src/carreira/carreira.module.ts
git commit -m "feat(api): add carreira trilha (TrackRequirement) endpoints"
```

---

### Task 5: Backend — Avaliações (PerformanceEvaluation)

**Files:**
- Create: `apps/api/src/carreira/avaliacoes.service.ts`
- Create: `apps/api/src/carreira/avaliacoes.controller.ts`
- Create: `apps/api/src/carreira/avaliacoes.service.spec.ts`
- Create: `apps/api/src/carreira/avaliacoes.controller.spec.ts`
- Modify: `apps/api/src/carreira/carreira.module.ts`

**Interfaces:**
- Consumes: `prisma.performanceEvaluation` (Task 1); `PerformanceEvaluationCreateSchema` (Task 2); `CarreiraModule` (Task 3).
- Produces: `PerformanceEvaluationsService` with `list(userId)`, `create(evaluatorId: string, input: PerformanceEvaluationCreateInput)`. Task 8 reads `prisma.performanceEvaluation` directly (no dependency on this service).

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/carreira/avaliacoes.service.spec.ts`:

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceEvaluationsService } from './avaliacoes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PerformanceEvaluationsService', () => {
  let service: PerformanceEvaluationsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PerformanceEvaluationsService, PrismaService],
    }).compile();
    service = module.get(PerformanceEvaluationsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.performanceEvaluation.deleteMany({ where: { userId: 'avaliacoes-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates an evaluation with the given evaluatorId, never from input', async () => {
    const evaluation = await service.create('gestor-1', {
      userId: 'avaliacoes-spec-user',
      proatividade: 4,
      trabalhoEquipe: 5,
      comunicacao: 4,
      lideranca: 3,
    });
    expect(evaluation.evaluatorId).toBe('gestor-1');
  });

  it('lists evaluations for the user ordered most-recent first', async () => {
    const first = await service.create('gestor-1', {
      userId: 'avaliacoes-spec-user',
      proatividade: 3,
      trabalhoEquipe: 3,
      comunicacao: 3,
      lideranca: 3,
    });
    const second = await service.create('gestor-1', {
      userId: 'avaliacoes-spec-user',
      proatividade: 5,
      trabalhoEquipe: 5,
      comunicacao: 5,
      lideranca: 5,
    });
    const evaluations = await service.list('avaliacoes-spec-user');
    expect(evaluations[0].id).toBe(second.id);
    expect(evaluations.some((e) => e.id === first.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/avaliacoes.service.spec.ts`
Expected: FAIL — cannot find module `./avaliacoes.service`.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/carreira/avaliacoes.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { PerformanceEvaluationCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PerformanceEvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.performanceEvaluation.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  create(evaluatorId: string, input: PerformanceEvaluationCreateInput) {
    return this.prisma.performanceEvaluation.create({
      data: {
        userId: input.userId,
        evaluatorId,
        proatividade: input.proatividade,
        trabalhoEquipe: input.trabalhoEquipe,
        comunicacao: input.comunicacao,
        lideranca: input.lideranca,
        comentario: input.comentario,
      },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/avaliacoes.service.spec.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Write the failing controller test**

Create `apps/api/src/carreira/avaliacoes.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { PerformanceEvaluationsController } from './avaliacoes.controller';
import { PerformanceEvaluationsService } from './avaliacoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['list', 'create'] as const;

describe('PerformanceEvaluationsController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PerformanceEvaluationsController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PerformanceEvaluationsController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('PerformanceEvaluationsController', () => {
  let controller: PerformanceEvaluationsController;
  const serviceMock = { list: jest.fn(), create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceEvaluationsController],
      providers: [{ provide: PerformanceEvaluationsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(PerformanceEvaluationsController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return { user: { sub, role: 'gestor', name: 'Gestor Teste' } } as Request & { user: AuthenticatedUser };
  }

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('creates using evaluatorId from the session, not the body', async () => {
    serviceMock.create.mockResolvedValue({ id: 'ev-1' });
    await controller.create(
      { userId: 'user-1', proatividade: 4, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 },
      requestAs('gestor-1'),
    );
    expect(serviceMock.create).toHaveBeenCalledWith('gestor-1', {
      userId: 'user-1',
      proatividade: 4,
      trabalhoEquipe: 4,
      comunicacao: 4,
      lideranca: 4,
    });
  });

  it('rejects an invalid body on create', async () => {
    await expect(
      controller.create({ userId: 'user-1', proatividade: 9, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 }, requestAs('gestor-1')),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/avaliacoes.controller.spec.ts`
Expected: FAIL — cannot find module `./avaliacoes.controller`.

- [ ] **Step 7: Implement the controller**

Create `apps/api/src/carreira/avaliacoes.controller.ts`:

```typescript
import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PerformanceEvaluationCreateSchema } from '@ponto-dcit/shared-types';
import { PerformanceEvaluationsService } from './avaliacoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('carreira/avaliacoes')
export class PerformanceEvaluationsController {
  constructor(private readonly evaluations: PerformanceEvaluationsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.evaluations.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = PerformanceEvaluationCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.evaluations.create(req.user.sub, result.data);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/avaliacoes.controller.spec.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 9: Register in the module**

Modify `apps/api/src/carreira/carreira.module.ts` (add the import, controller, and provider alongside the existing two):

```typescript
import { PerformanceEvaluationsController } from './avaliacoes.controller';
import { PerformanceEvaluationsService } from './avaliacoes.service';
// ...
  controllers: [CareerGoalsController, TrackRequirementsController, PerformanceEvaluationsController],
  providers: [CareerGoalsService, TrackRequirementsService, PerformanceEvaluationsService],
```

- [ ] **Step 10: Run the full backend suite**

Run (from `apps/api`): `npx jest`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/carreira/avaliacoes.service.ts apps/api/src/carreira/avaliacoes.controller.ts apps/api/src/carreira/avaliacoes.service.spec.ts apps/api/src/carreira/avaliacoes.controller.spec.ts apps/api/src/carreira/carreira.module.ts
git commit -m "feat(api): add carreira avaliacoes (PerformanceEvaluation) endpoints"
```

---

### Task 6: Backend — Nine Box

**Files:**
- Create: `apps/api/src/carreira/nine-box.service.ts`
- Create: `apps/api/src/carreira/nine-box.controller.ts`
- Create: `apps/api/src/carreira/nine-box.service.spec.ts`
- Create: `apps/api/src/carreira/nine-box.controller.spec.ts`
- Modify: `apps/api/src/carreira/carreira.module.ts`

**Interfaces:**
- Consumes: `prisma.nineBoxPlacement` (Task 1); `NineBoxPlacementCreateSchema` (Task 2); `CarreiraModule` (Task 3).
- Produces: `NineBoxService` with `list(userId)`, `current(userId)`, `create(gestorId, input)`. Not consumed by other tasks.

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/carreira/nine-box.service.spec.ts`:

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { NineBoxService } from './nine-box.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NineBoxService', () => {
  let service: NineBoxService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NineBoxService, PrismaService],
    }).compile();
    service = module.get(NineBoxService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.nineBoxPlacement.deleteMany({ where: { userId: 'ninebox-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates a placement with the given gestorId', async () => {
    const placement = await service.create('gestor-1', {
      userId: 'ninebox-spec-user',
      desempenho: 'alto',
      potencial: 'medio',
    });
    expect(placement.gestorId).toBe('gestor-1');
  });

  it('never updates in place — a new placement is a new row, and current() returns the most recent', async () => {
    await service.create('gestor-1', { userId: 'ninebox-spec-user', desempenho: 'baixo', potencial: 'baixo' });
    const newest = await service.create('gestor-1', { userId: 'ninebox-spec-user', desempenho: 'alto', potencial: 'alto' });
    const current = await service.current('ninebox-spec-user');
    expect(current?.id).toBe(newest.id);
    const history = await service.list('ninebox-spec-user');
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('current() returns null when nothing was ever placed', async () => {
    const current = await service.current('ninebox-spec-nobody');
    expect(current).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/nine-box.service.spec.ts`
Expected: FAIL — cannot find module `./nine-box.service`.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/carreira/nine-box.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { NineBoxPlacementCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NineBoxService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.nineBoxPlacement.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  current(userId: string) {
    return this.prisma.nineBoxPlacement.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  create(gestorId: string, input: NineBoxPlacementCreateInput) {
    return this.prisma.nineBoxPlacement.create({
      data: {
        userId: input.userId,
        gestorId,
        desempenho: input.desempenho,
        potencial: input.potencial,
      },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/nine-box.service.spec.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Write the failing controller test**

Create `apps/api/src/carreira/nine-box.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { NineBoxController } from './nine-box.controller';
import { NineBoxService } from './nine-box.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['list', 'create'] as const;

describe('NineBoxController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NineBoxController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NineBoxController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('NineBoxController', () => {
  let controller: NineBoxController;
  const serviceMock = { list: jest.fn(), create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NineBoxController],
      providers: [{ provide: NineBoxService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(NineBoxController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return { user: { sub, role: 'gestor', name: 'Gestor Teste' } } as Request & { user: AuthenticatedUser };
  }

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('creates using gestorId from the session', async () => {
    serviceMock.create.mockResolvedValue({ id: 'nb-1' });
    await controller.create({ userId: 'user-1', desempenho: 'alto', potencial: 'medio' }, requestAs('gestor-1'));
    expect(serviceMock.create).toHaveBeenCalledWith('gestor-1', { userId: 'user-1', desempenho: 'alto', potencial: 'medio' });
  });

  it('rejects an invalid body on create', async () => {
    await expect(
      controller.create({ userId: 'user-1', desempenho: 'excelente', potencial: 'medio' }, requestAs('gestor-1')),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/nine-box.controller.spec.ts`
Expected: FAIL — cannot find module `./nine-box.controller`.

- [ ] **Step 7: Implement the controller**

Create `apps/api/src/carreira/nine-box.controller.ts`:

```typescript
import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { NineBoxPlacementCreateSchema } from '@ponto-dcit/shared-types';
import { NineBoxService } from './nine-box.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('carreira/nine-box')
export class NineBoxController {
  constructor(private readonly nineBox: NineBoxService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.nineBox.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = NineBoxPlacementCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.nineBox.create(req.user.sub, result.data);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/nine-box.controller.spec.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 9: Register in the module**

Modify `apps/api/src/carreira/carreira.module.ts` (add `NineBoxController`/`NineBoxService` alongside the existing three).

- [ ] **Step 10: Run the full backend suite**

Run (from `apps/api`): `npx jest`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/carreira/nine-box.service.ts apps/api/src/carreira/nine-box.controller.ts apps/api/src/carreira/nine-box.service.spec.ts apps/api/src/carreira/nine-box.controller.spec.ts apps/api/src/carreira/carreira.module.ts
git commit -m "feat(api): add carreira nine-box endpoints"
```

---

### Task 7: Backend — 1:1 (OneOnOne + OneOnOneAcao)

**Files:**
- Create: `apps/api/src/carreira/one-on-ones.service.ts`
- Create: `apps/api/src/carreira/one-on-ones.controller.ts`
- Create: `apps/api/src/carreira/one-on-ones.service.spec.ts`
- Create: `apps/api/src/carreira/one-on-ones.controller.spec.ts`
- Modify: `apps/api/src/carreira/carreira.module.ts`

**Interfaces:**
- Consumes: `prisma.oneOnOne`, `prisma.oneOnOneAcao` (Task 1); `OneOnOneCreateSchema`, `OneOnOneAcaoUpdateSchema` (Task 2); `CarreiraModule` (Task 3).
- Produces: `OneOnOnesService` with `list(userId)` (each item includes its `acoes: OneOnOneAcao[]`, joined manually — no Prisma relation exists), `create(gestorId, input)`, `updateAcaoStatus(id, status)`. Not consumed by other tasks.

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/carreira/one-on-ones.service.spec.ts`:

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { OneOnOnesService } from './one-on-ones.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OneOnOnesService', () => {
  let service: OneOnOnesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OneOnOnesService, PrismaService],
    }).compile();
    service = module.get(OneOnOnesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    const records = await prisma.oneOnOne.findMany({ where: { userId: 'oneonone-spec-user' } });
    await prisma.oneOnOneAcao.deleteMany({ where: { oneOnOneId: { in: records.map((r) => r.id) } } });
    await prisma.oneOnOne.deleteMany({ where: { userId: 'oneonone-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates a OneOnOne and its acoes together, with gestorId from the caller', async () => {
    const created = await service.create('gestor-1', {
      userId: 'oneonone-spec-user',
      pauta: 'Alinhamento mensal',
      acoes: [{ descricao: 'Enviar relatório' }, { descricao: 'Marcar follow-up' }],
    });
    expect(created.gestorId).toBe('gestor-1');
    expect(created.acoes).toHaveLength(2);
    expect(created.acoes.every((a) => a.status === 'pendente')).toBe(true);
  });

  it('lists each OneOnOne with its own acoes joined, not mixed with another record\'s', async () => {
    const first = await service.create('gestor-1', {
      userId: 'oneonone-spec-user',
      pauta: 'Conversa 1',
      acoes: [{ descricao: 'Ação A' }],
    });
    const second = await service.create('gestor-1', {
      userId: 'oneonone-spec-user',
      pauta: 'Conversa 2',
      acoes: [{ descricao: 'Ação B' }],
    });
    const list = await service.list('oneonone-spec-user');
    const firstListed = list.find((r) => r.id === first.id);
    const secondListed = list.find((r) => r.id === second.id);
    expect(firstListed?.acoes.map((a) => a.descricao)).toEqual(['Ação A']);
    expect(secondListed?.acoes.map((a) => a.descricao)).toEqual(['Ação B']);
  });

  it('toggling one acao status does not affect siblings from the same OneOnOne', async () => {
    const created = await service.create('gestor-1', {
      userId: 'oneonone-spec-user',
      pauta: 'Conversa 3',
      acoes: [{ descricao: 'Ação C' }, { descricao: 'Ação D' }],
    });
    await service.updateAcaoStatus(created.acoes[0].id, 'concluido');
    const list = await service.list('oneonone-spec-user');
    const record = list.find((r) => r.id === created.id);
    const updated = record?.acoes.find((a) => a.id === created.acoes[0].id);
    const untouched = record?.acoes.find((a) => a.id === created.acoes[1].id);
    expect(updated?.status).toBe('concluido');
    expect(untouched?.status).toBe('pendente');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/one-on-ones.service.spec.ts`
Expected: FAIL — cannot find module `./one-on-ones.service`.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/carreira/one-on-ones.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { OneOnOneCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OneOnOnesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const records = await this.prisma.oneOnOne.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    const acoes = await this.prisma.oneOnOneAcao.findMany({
      where: { oneOnOneId: { in: records.map((r) => r.id) } },
    });
    const acoesByRecord = new Map<string, typeof acoes>();
    for (const acao of acoes) {
      const list = acoesByRecord.get(acao.oneOnOneId) ?? [];
      list.push(acao);
      acoesByRecord.set(acao.oneOnOneId, list);
    }
    return records.map((record) => ({ ...record, acoes: acoesByRecord.get(record.id) ?? [] }));
  }

  async create(gestorId: string, input: OneOnOneCreateInput) {
    const record = await this.prisma.oneOnOne.create({
      data: {
        userId: input.userId,
        gestorId,
        pauta: input.pauta,
        proximaData: input.proximaData ? new Date(input.proximaData) : undefined,
      },
    });
    if (input.acoes.length > 0) {
      await this.prisma.oneOnOneAcao.createMany({
        data: input.acoes.map((acao) => ({ oneOnOneId: record.id, descricao: acao.descricao })),
      });
    }
    const acoes = await this.prisma.oneOnOneAcao.findMany({ where: { oneOnOneId: record.id } });
    return { ...record, acoes };
  }

  updateAcaoStatus(id: string, status: string) {
    return this.prisma.oneOnOneAcao.update({ where: { id }, data: { status } });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/one-on-ones.service.spec.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Write the failing controller test**

Create `apps/api/src/carreira/one-on-ones.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { OneOnOnesController } from './one-on-ones.controller';
import { OneOnOnesService } from './one-on-ones.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['list', 'create', 'updateAcaoStatus'] as const;

describe('OneOnOnesController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OneOnOnesController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OneOnOnesController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('OneOnOnesController', () => {
  let controller: OneOnOnesController;
  const serviceMock = { list: jest.fn(), create: jest.fn(), updateAcaoStatus: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OneOnOnesController],
      providers: [{ provide: OneOnOnesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(OneOnOnesController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return { user: { sub, role: 'gestor', name: 'Gestor Teste' } } as Request & { user: AuthenticatedUser };
  }

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('creates using gestorId from the session', async () => {
    serviceMock.create.mockResolvedValue({ id: 'oo-1', acoes: [] });
    await controller.create({ userId: 'user-1', pauta: 'Conversa' }, requestAs('gestor-1'));
    expect(serviceMock.create).toHaveBeenCalledWith('gestor-1', { userId: 'user-1', pauta: 'Conversa', acoes: [] });
  });

  it('rejects an invalid body on create', async () => {
    await expect(controller.create({ userId: 'user-1', pauta: '' }, requestAs('gestor-1'))).rejects.toThrow();
  });

  it('updates an acao status with a valid body', async () => {
    serviceMock.updateAcaoStatus.mockResolvedValue({ id: 'acao-1', status: 'concluido' });
    await controller.updateAcaoStatus('acao-1', { status: 'concluido' });
    expect(serviceMock.updateAcaoStatus).toHaveBeenCalledWith('acao-1', 'concluido');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/one-on-ones.controller.spec.ts`
Expected: FAIL — cannot find module `./one-on-ones.controller`.

- [ ] **Step 7: Implement the controller**

Create `apps/api/src/carreira/one-on-ones.controller.ts`:

```typescript
import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OneOnOneCreateSchema, OneOnOneAcaoUpdateSchema } from '@ponto-dcit/shared-types';
import { OneOnOnesService } from './one-on-ones.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('carreira/one-on-ones')
export class OneOnOnesController {
  constructor(private readonly oneOnOnes: OneOnOnesService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.oneOnOnes.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = OneOnOneCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.oneOnOnes.create(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Patch('acoes/:id')
  updateAcaoStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = OneOnOneAcaoUpdateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.oneOnOnes.updateAcaoStatus(id, result.data.status);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/one-on-ones.controller.spec.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 9: Register in the module**

Modify `apps/api/src/carreira/carreira.module.ts` (add `OneOnOnesController`/`OneOnOnesService` alongside the existing four).

- [ ] **Step 10: Run the full backend suite**

Run (from `apps/api`): `npx jest`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/carreira/one-on-ones.service.ts apps/api/src/carreira/one-on-ones.controller.ts apps/api/src/carreira/one-on-ones.service.spec.ts apps/api/src/carreira/one-on-ones.controller.spec.ts apps/api/src/carreira/carreira.module.ts
git commit -m "feat(api): add carreira one-on-ones endpoints"
```

---

### Task 8: Backend — Promotabilidade

**Files:**
- Create: `apps/api/src/carreira/promotabilidade.service.ts`
- Create: `apps/api/src/carreira/promotabilidade.controller.ts`
- Create: `apps/api/src/carreira/promotabilidade.service.spec.ts`
- Create: `apps/api/src/carreira/promotabilidade.controller.spec.ts`
- Modify: `apps/api/src/carreira/carreira.module.ts`

**Interfaces:**
- Consumes: `prisma.employee`, `prisma.careerGoal`, `prisma.trackRequirement`, `prisma.performanceEvaluation` directly (Task 1) — queries them itself rather than depending on Tasks 3/4/5's services, matching this codebase's convention (e.g. `PontoPerdidoService` queries Prisma directly rather than composing other services). `CarreiraModule` (Task 3).
- Produces: `calcularStatusPromotabilidade(input)` — an exported pure function (also directly unit-testable) — plus `PromotabilidadeService` with `listAll(): Promise<Record<string, "verde" | "amarelo" | "branco">>` and `getOne(userId): Promise<{ status; mesesDeCasa; requisitosPendentes; metasPendentes; ultimaMediaAvaliacao }>`. `listAll` (via `GET /carreira/promotabilidade`) is consumed by Task 13 (frontend badge); `getOne` (via `GET /carreira/promotabilidade/:userId`) is consumed by Task 11 (Trilha tab, to show which requirements/goals are still missing for promotion).

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/carreira/promotabilidade.service.spec.ts`:

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { PromotabilidadeService, calcularStatusPromotabilidade } from './promotabilidade.service';
import { PrismaService } from '../prisma/prisma.service';

describe('calcularStatusPromotabilidade (pure function)', () => {
  const now = new Date('2026-09-02T00:00:00.000Z');

  it('returns branco when tenure is under 3 months, even with everything else complete', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2026-08-01'),
      now,
      requisitos: [{ status: 'concluido' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 5, trabalhoEquipe: 5, comunicacao: 5, lideranca: 5 },
    });
    expect(status).toBe('branco');
  });

  it('returns branco when tenure is enough but nothing was ever registered', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-01-01'),
      now,
      requisitos: [],
      metasPdi: [],
      ultimaAvaliacao: null,
    });
    expect(status).toBe('branco');
  });

  it('returns amarelo when tenure is enough and something started, but not everything is complete', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-01-01'),
      now,
      requisitos: [{ status: 'pendente' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 5, trabalhoEquipe: 5, comunicacao: 5, lideranca: 5 },
    });
    expect(status).toBe('amarelo');
  });

  it('returns amarelo when everything is complete but the average score is below 4', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-01-01'),
      now,
      requisitos: [{ status: 'concluido' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 4, trabalhoEquipe: 4, comunicacao: 3, lideranca: 4 }, // média 3.75
    });
    expect(status).toBe('amarelo');
  });

  it('returns verde when tenure, requisitos, metas and average score (exactly 4) are all met', () => {
    const status = calcularStatusPromotabilidade({
      hireDate: new Date('2025-01-01'),
      now,
      requisitos: [{ status: 'concluido' }],
      metasPdi: [{ status: 'concluida' }],
      ultimaAvaliacao: { proatividade: 4, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 },
    });
    expect(status).toBe('verde');
  });
});

describe('PromotabilidadeService', () => {
  let service: PromotabilidadeService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromotabilidadeService, PrismaService],
    }).compile();
    service = module.get(PromotabilidadeService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.employee.create({
      data: {
        userId: 'promotabilidade-spec-user',
        name: 'Promotabilidade Spec',
        role: 'colaborador',
        hireDate: new Date('2025-01-01'),
      },
    });
  });

  afterAll(async () => {
    await prisma.performanceEvaluation.deleteMany({ where: { userId: 'promotabilidade-spec-user' } });
    await prisma.trackRequirement.deleteMany({ where: { userId: 'promotabilidade-spec-user' } });
    await prisma.careerGoal.deleteMany({ where: { userId: 'promotabilidade-spec-user' } });
    await prisma.employee.delete({ where: { userId: 'promotabilidade-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('listAll includes a branco entry for an employee with nothing registered', async () => {
    const all = await service.listAll();
    expect(all['promotabilidade-spec-user']).toBe('branco');
  });

  it('getOne reports the same status as listAll for the same employee', async () => {
    const detail = await service.getOne('promotabilidade-spec-user');
    expect(detail.status).toBe('branco');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/promotabilidade.service.spec.ts`
Expected: FAIL — cannot find module `./promotabilidade.service`.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/carreira/promotabilidade.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type StatusPromotabilidade = 'verde' | 'amarelo' | 'branco';

type Avaliacao = { proatividade: number; trabalhoEquipe: number; comunicacao: number; lideranca: number };

function diffInMonths(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function calcularStatusPromotabilidade(input: {
  hireDate: Date;
  now: Date;
  requisitos: { status: string }[];
  metasPdi: { status: string }[];
  ultimaAvaliacao: Avaliacao | null;
}): StatusPromotabilidade {
  const mesesDeCasa = diffInMonths(input.hireDate, input.now);
  if (mesesDeCasa < 3) return 'branco';

  const nadaRegistrado = input.requisitos.length === 0 && input.metasPdi.length === 0 && !input.ultimaAvaliacao;
  if (nadaRegistrado) return 'branco';

  const todosRequisitosOk = input.requisitos.every((r) => r.status === 'concluido');
  const todasMetasOk = input.metasPdi.every((m) => m.status === 'concluida');
  const mediaAvaliacao = input.ultimaAvaliacao
    ? (input.ultimaAvaliacao.proatividade +
        input.ultimaAvaliacao.trabalhoEquipe +
        input.ultimaAvaliacao.comunicacao +
        input.ultimaAvaliacao.lideranca) /
      4
    : 0;

  if (todosRequisitosOk && todasMetasOk && mediaAvaliacao >= 4) return 'verde';
  return 'amarelo';
}

@Injectable()
export class PromotabilidadeService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<Record<string, StatusPromotabilidade>> {
    const employees = await this.prisma.employee.findMany({ where: { deletedAt: null } });
    const now = new Date();
    const result: Record<string, StatusPromotabilidade> = {};
    for (const employee of employees) {
      const detail = await this.calcularDetalhe(employee.userId, employee.hireDate, now);
      result[employee.userId] = detail.status;
    }
    return result;
  }

  async getOne(userId: string) {
    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { userId } });
    return this.calcularDetalhe(userId, employee.hireDate, new Date());
  }

  private async calcularDetalhe(userId: string, hireDate: Date, now: Date) {
    const [requisitos, metasPdi, ultimaAvaliacao] = await Promise.all([
      this.prisma.trackRequirement.findMany({ where: { userId } }),
      this.prisma.careerGoal.findMany({ where: { userId, tipo: 'pdi' } }),
      this.prisma.performanceEvaluation.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
    ]);
    const status = calcularStatusPromotabilidade({ hireDate, now, requisitos, metasPdi, ultimaAvaliacao });
    return {
      status,
      mesesDeCasa: diffInMonths(hireDate, now),
      requisitosPendentes: requisitos.filter((r) => r.status !== 'concluido').length,
      metasPendentes: metasPdi.filter((m) => m.status !== 'concluida').length,
      ultimaMediaAvaliacao: ultimaAvaliacao
        ? (ultimaAvaliacao.proatividade +
            ultimaAvaliacao.trabalhoEquipe +
            ultimaAvaliacao.comunicacao +
            ultimaAvaliacao.lideranca) /
          4
        : null,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/promotabilidade.service.spec.ts`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Write the failing controller test**

Create `apps/api/src/carreira/promotabilidade.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PromotabilidadeController } from './promotabilidade.controller';
import { PromotabilidadeService } from './promotabilidade.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

const GUARDED_HANDLERS = ['listAll', 'getOne'] as const;

describe('PromotabilidadeController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PromotabilidadeController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PromotabilidadeController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('PromotabilidadeController', () => {
  let controller: PromotabilidadeController;
  const serviceMock = { listAll: jest.fn(), getOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotabilidadeController],
      providers: [{ provide: PromotabilidadeService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(PromotabilidadeController);
  });

  it('returns the batch map', async () => {
    serviceMock.listAll.mockResolvedValue({ 'user-1': 'verde' });
    const result = await controller.listAll();
    expect(result).toEqual({ 'user-1': 'verde' });
  });

  it('returns the detail for a single userId', async () => {
    serviceMock.getOne.mockResolvedValue({ status: 'amarelo' });
    const result = await controller.getOne('user-1');
    expect(serviceMock.getOne).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ status: 'amarelo' });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run (from `apps/api`): `npx jest src/carreira/promotabilidade.controller.spec.ts`
Expected: FAIL — cannot find module `./promotabilidade.controller`.

- [ ] **Step 7: Implement the controller**

Create `apps/api/src/carreira/promotabilidade.controller.ts`:

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PromotabilidadeService } from './promotabilidade.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('carreira/promotabilidade')
export class PromotabilidadeController {
  constructor(private readonly promotabilidade: PromotabilidadeService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  listAll() {
    return this.promotabilidade.listAll();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get(':userId')
  getOne(@Param('userId') userId: string) {
    return this.promotabilidade.getOne(userId);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run (from `apps/api`): `npx jest src/carreira/promotabilidade.controller.spec.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 9: Register in the module (final shape)**

Modify `apps/api/src/carreira/carreira.module.ts` to its final form:

```typescript
import { Module } from '@nestjs/common';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { TrackRequirementsController } from './trilha.controller';
import { TrackRequirementsService } from './trilha.service';
import { PerformanceEvaluationsController } from './avaliacoes.controller';
import { PerformanceEvaluationsService } from './avaliacoes.service';
import { NineBoxController } from './nine-box.controller';
import { NineBoxService } from './nine-box.service';
import { OneOnOnesController } from './one-on-ones.controller';
import { OneOnOnesService } from './one-on-ones.service';
import { PromotabilidadeController } from './promotabilidade.controller';
import { PromotabilidadeService } from './promotabilidade.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    CareerGoalsController,
    TrackRequirementsController,
    PerformanceEvaluationsController,
    NineBoxController,
    OneOnOnesController,
    PromotabilidadeController,
  ],
  providers: [
    CareerGoalsService,
    TrackRequirementsService,
    PerformanceEvaluationsService,
    NineBoxService,
    OneOnOnesService,
    PromotabilidadeService,
  ],
})
export class CarreiraModule {}
```

- [ ] **Step 10: Run the full backend suite**

Run (from `apps/api`): `npx jest`
Expected: PASS. This is the last backend task — the full `carreira` module is now complete and wired into `app.module.ts`.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/carreira/promotabilidade.service.ts apps/api/src/carreira/promotabilidade.controller.ts apps/api/src/carreira/promotabilidade.service.spec.ts apps/api/src/carreira/promotabilidade.controller.spec.ts apps/api/src/carreira/carreira.module.ts
git commit -m "feat(api): add carreira promotabilidade calculation and endpoint"
```

---

### Task 9: Frontend — Sidebar (gestor-only group)

**Files:**
- Modify: `apps/web/src/lib/nav-sections.ts`
- Modify: `apps/web/src/components/nav-links.tsx`

**Interfaces:**
- Consumes: existing `SidebarGroup`, `SidebarLink`, `isSidebarGroup`, `NavRole`, `NAV_SECTIONS` types/values in `nav-sections.ts`; existing `NavLinkItem`, `NavGroupItem` components in `nav-links.tsx`.
- Produces: `GESTOR_CAREER_GROUP: SidebarGroup` (exported from `nav-sections.ts`) and a new `role === "gestor"` branch in `NavLinks`. Task 10 reads the `?aba=` values this group links to (`pdi`, `trilha`, `avaliacoes`) as the default tab names.

This task has no backend/business logic to unit test — its only observable behavior is what renders in the sidebar for each role, which this codebase verifies by manual check (no existing test file covers `nav-links.tsx` or `nav-sections.ts` today). Verify manually per Step 3.

- [ ] **Step 1: Add the group definition**

Modify `apps/web/src/lib/nav-sections.ts` — add after `COLABORADOR_SIDEBAR`:

```typescript
// Gestor-only — deliberately not shared with rh (see the Gestão de Carreiras
// design spec: the original request was explicit that this is manager-only,
// unlike most other gestor+rh shared team screens in this app).
export const GESTOR_CAREER_GROUP: SidebarGroup = {
  href: "/gestao-carreiras",
  label: "Gestão de Carreiras",
  children: [
    { href: "/gestao-carreiras?aba=pdi", label: "PDI & Metas" },
    { href: "/gestao-carreiras?aba=trilha", label: "Matriz de Promoção / Trilhas de Carreira" },
    { href: "/gestao-carreiras?aba=avaliacoes", label: "Avaliações de Desempenho" },
  ],
};
```

- [ ] **Step 2: Add the gestor branch to NavLinks**

Modify `apps/web/src/components/nav-links.tsx`:

```typescript
import {
  COLABORADOR_SIDEBAR,
  GESTOR_CAREER_GROUP,
  isSidebarGroup,
  NAV_SECTIONS,
  type NavRole,
  type SidebarGroup,
  type SidebarLink,
} from "@/lib/nav-sections";
```

Add a new branch in `NavLinks`, between the existing `role === "colaborador"` block and the final flat-list `return`:

```typescript
  if (role === "gestor") {
    const flatEntries = NAV_SECTIONS.filter((section) => section.roles.includes("gestor"));
    return (
      <nav className={styles.navSections}>
        <ul className={styles.nav}>
          {flatEntries.map((link) => (
            <NavLinkItem key={link.href} link={link} pathname={pathname} />
          ))}
        </ul>
        <NavGroupItem group={GESTOR_CAREER_GROUP} pathname={pathname} />
      </nav>
    );
  }
```

- [ ] **Step 3: Verify manually**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no new type errors.

Start the dev server (`npx next dev -p 3001` from `apps/web`, or reuse one already running), log in as a `gestor` user, and confirm: the sidebar shows every link it showed before, plus a new collapsible "Gestão de Carreiras" group at the end; clicking its chevron expands 3 sub-links; clicking the group's own label navigates to `/gestao-carreiras` (which 404s or shows nothing meaningful until Task 10 — that's expected at this point). Log in as `rh` and confirm the group does **not** appear.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/nav-sections.ts apps/web/src/components/nav-links.tsx
git commit -m "feat(web): add gestor-only Gestão de Carreiras sidebar group"
```

---

### Task 10: Frontend — page shell, colaborador selector, PDI tab

**Files:**
- Create: `apps/web/src/app/(app)/gestao-carreiras/page.tsx`
- Create: `apps/web/src/app/(app)/gestao-carreiras/actions.ts`
- Create: `apps/web/src/app/(app)/gestao-carreiras/metas-section.tsx`
- Create: `apps/web/src/app/(app)/gestao-carreiras/gestao-carreiras.module.css`

**Interfaces:**
- Consumes: `GET /employees` (existing, used by `/colaboradores`), `GET /carreira/metas?userId=`, `POST /carreira/metas`, `PATCH /carreira/metas/:id` (Task 3); `apiFetch`/`apiFetchJson` from `@/lib/api`; `getSession` from `@/lib/session`.
- Produces: the `/gestao-carreiras` route, and the tab-shell markup (colaborador `<select>`, tab links) that Tasks 11 and 12 plug their sections into.

- [ ] **Step 1: Write the Server Actions**

Create `apps/web/src/app/(app)/gestao-carreiras/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function createCareerGoal(formData: FormData) {
  const userId = formData.get("userId");
  const tipo = formData.get("tipo");
  const title = formData.get("title");
  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    (tipo !== "pdi" && tipo !== "entrega") ||
    typeof title !== "string" ||
    title.trim().length === 0
  ) {
    throw new Error("Preencha o tipo e um título válido.");
  }
  const res = await apiFetch("/carreira/metas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, tipo, title: title.trim() }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/metas responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function updateCareerGoalStatus(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") {
    throw new Error("Requisição inválida.");
  }
  const res = await apiFetch(`/carreira/metas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/metas/${id} responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}
```

- [ ] **Step 2: Write the PDI section component**

Create `apps/web/src/app/(app)/gestao-carreiras/metas-section.tsx`:

```typescript
import { createCareerGoal, updateCareerGoalStatus } from "./actions";
import styles from "./gestao-carreiras.module.css";

type CareerGoal = {
  id: string;
  tipo: "pdi" | "entrega";
  title: string;
  status: "pendente" | "andamento" | "concluida";
};

const STATUS_LABEL: Record<CareerGoal["status"], string> = {
  pendente: "Pendente",
  andamento: "Em andamento",
  concluida: "Concluída",
};

export function MetasSection({ userId, goals }: { userId: string; goals: CareerGoal[] }) {
  const pdi = goals.filter((g) => g.tipo === "pdi");
  const entregas = goals.filter((g) => g.tipo === "entrega");

  return (
    <div className={styles.section}>
      <h2>Plano de Ação (PDI)</h2>
      <GoalList goals={pdi} />
      <form action={createCareerGoal} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="tipo" value="pdi" />
        <input type="text" name="title" placeholder="Nova meta de PDI" required />
        <button type="submit">Adicionar</button>
      </form>

      <h2>Histórico de Entregas & Metas</h2>
      <GoalList goals={entregas} />
      <form action={createCareerGoal} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="tipo" value="entrega" />
        <input type="text" name="title" placeholder="Nova entrega/meta" required />
        <button type="submit">Adicionar</button>
      </form>
    </div>
  );
}

function GoalList({ goals }: { goals: CareerGoal[] }) {
  if (goals.length === 0) return <p className={styles.empty}>Nenhum item cadastrado.</p>;
  return (
    <ul className={styles.list}>
      {goals.map((goal) => (
        <li key={goal.id} className={styles.item}>
          <span>{goal.title}</span>
          <form action={updateCareerGoalStatus} className={styles.statusForm}>
            <input type="hidden" name="id" value={goal.id} />
            <select name="status" defaultValue={goal.status} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </form>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write the page shell**

Create `apps/web/src/app/(app)/gestao-carreiras/page.tsx`:

```typescript
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { MetasSection } from "./metas-section";
import styles from "./gestao-carreiras.module.css";

type Employee = { userId: string; name: string };
type CareerGoal = { id: string; tipo: "pdi" | "entrega"; title: string; status: "pendente" | "andamento" | "concluida" };

const TABS = [
  { value: "pdi", label: "PDI & Metas" },
  { value: "trilha", label: "Trilha de Carreira" },
  { value: "avaliacoes", label: "Avaliações de Desempenho" },
] as const;

export default async function GestaoCarreirasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "gestor") {
    return <EmptyState title="Sem permissão" description="Esta área é exclusiva para gestores." />;
  }

  const params = await searchParams;
  const aba = typeof params.aba === "string" ? params.aba : "pdi";
  const userId = typeof params.userId === "string" ? params.userId : undefined;

  const employees = await apiFetchJson<Employee[]>("/employees");

  return (
    <div className={styles.page}>
      <h1>Gestão de Carreiras</h1>
      <form className={styles.selector}>
        <label htmlFor="userId">Colaborador</label>
        <select
          id="userId"
          name="userId"
          defaultValue={userId ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          <option value="" disabled>
            Selecione um colaborador
          </option>
          {employees.map((employee) => (
            <option key={employee.userId} value={employee.userId}>
              {employee.name}
            </option>
          ))}
        </select>
        <input type="hidden" name="aba" value={aba} />
      </form>

      {!userId ? (
        <EmptyState title="Selecione um colaborador" description="Escolha um colaborador acima para ver sua carreira." />
      ) : (
        <>
          <nav className={styles.tabs}>
            {TABS.map((tab) => (
              <a
                key={tab.value}
                href={`/gestao-carreiras?aba=${tab.value}&userId=${userId}`}
                className={aba === tab.value ? styles.tabActive : styles.tab}
              >
                {tab.label}
              </a>
            ))}
          </nav>
          {aba === "pdi" ? <MetasTab userId={userId} /> : null}
        </>
      )}
    </div>
  );
}

async function MetasTab({ userId }: { userId: string }) {
  const goals = await apiFetchJson<CareerGoal[]>(`/carreira/metas?userId=${userId}`);
  return <MetasSection userId={userId} goals={goals} />;
}
```

Create `apps/web/src/app/(app)/gestao-carreiras/gestao-carreiras.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-color, #e2e2e2);
}

.tab,
.tabActive {
  padding: 0.5rem 1rem;
  text-decoration: none;
  color: inherit;
}

.tabActive {
  border-bottom: 2px solid currentColor;
  font-weight: 600;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.form,
.statusForm {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.empty {
  color: var(--muted-color, #666);
}
```

- [ ] **Step 4: Verify manually**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no new type errors.

With the dev server running, log in as `gestor`, open `/gestao-carreiras` via the sidebar: confirm the colaborador selector lists every employee, selecting one shows the "PDI & Metas" tab by default, adding a PDI goal and an entrega both appear in their respective lists, and changing an item's status via the dropdown persists after the page reloads (server action + `revalidatePath`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/gestao-carreiras/page.tsx apps/web/src/app/\(app\)/gestao-carreiras/actions.ts apps/web/src/app/\(app\)/gestao-carreiras/metas-section.tsx apps/web/src/app/\(app\)/gestao-carreiras/gestao-carreiras.module.css
git commit -m "feat(web): add Gestão de Carreiras page shell and PDI & Metas tab"
```

---

### Task 11: Frontend — Trilha tab

**Files:**
- Modify: `apps/web/src/app/(app)/gestao-carreiras/actions.ts`
- Create: `apps/web/src/app/(app)/gestao-carreiras/trilha-section.tsx`
- Modify: `apps/web/src/app/(app)/gestao-carreiras/page.tsx`

**Interfaces:**
- Consumes: `GET /carreira/trilha?userId=`, `POST /carreira/trilha`, `PATCH /carreira/trilha/:id` (Task 4); `GET /carreira/promotabilidade/:userId` (Task 8), returning `{ status, mesesDeCasa, requisitosPendentes, metasPendentes, ultimaMediaAvaliacao }`; the page shell and `TABS`/tab-routing from Task 10.
- Produces: the `aba=trilha` tab, rendering the tempo-de-casa indicator, the promotability status with what's still missing, and the requirements checklist.

- [ ] **Step 1: Add the Server Actions**

Modify `apps/web/src/app/(app)/gestao-carreiras/actions.ts` — append:

```typescript
export async function createTrackRequirement(formData: FormData) {
  const userId = formData.get("userId");
  const title = formData.get("title");
  if (typeof userId !== "string" || userId.length === 0 || typeof title !== "string" || title.trim().length === 0) {
    throw new Error("Informe um título válido.");
  }
  const res = await apiFetch("/carreira/trilha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title: title.trim() }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/trilha responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function updateTrackRequirementStatus(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") {
    throw new Error("Requisição inválida.");
  }
  const res = await apiFetch(`/carreira/trilha/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/trilha/${id} responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}
```

- [ ] **Step 2: Write the Trilha section component**

Create `apps/web/src/app/(app)/gestao-carreiras/trilha-section.tsx`:

```typescript
import { createTrackRequirement, updateTrackRequirementStatus } from "./actions";
import styles from "./gestao-carreiras.module.css";

type TrackRequirement = { id: string; title: string; status: "pendente" | "andamento" | "concluido" };
type PromotabilidadeDetail = {
  status: "verde" | "amarelo" | "branco";
  mesesDeCasa: number;
  requisitosPendentes: number;
  metasPendentes: number;
  ultimaMediaAvaliacao: number | null;
};

const STATUS_LABEL: Record<TrackRequirement["status"], string> = {
  pendente: "Pendente",
  andamento: "Em andamento",
  concluido: "Concluído",
};

const PROMOTABILIDADE_LABEL: Record<PromotabilidadeDetail["status"], string> = {
  verde: "🟢 Pronto para promoção",
  amarelo: "🟡 Em desenvolvimento",
  branco: "⚪ Em formação inicial",
};

export function TrilhaSection({
  userId,
  requirements,
  promotabilidade,
}: {
  userId: string;
  requirements: TrackRequirement[];
  promotabilidade: PromotabilidadeDetail;
}) {
  const pendencias: string[] = [];
  if (promotabilidade.mesesDeCasa < 3) pendencias.push("tempo mínimo de 3 meses no cargo ainda não atingido");
  if (promotabilidade.requisitosPendentes > 0)
    pendencias.push(`${promotabilidade.requisitosPendentes} requisito(s) de trilha pendente(s)`);
  if (promotabilidade.metasPendentes > 0) pendencias.push(`${promotabilidade.metasPendentes} meta(s) de PDI pendente(s)`);
  if (promotabilidade.ultimaMediaAvaliacao === null) pendencias.push("nenhuma avaliação de desempenho registrada ainda");
  else if (promotabilidade.ultimaMediaAvaliacao < 4)
    pendencias.push(`média de avaliação (${promotabilidade.ultimaMediaAvaliacao.toFixed(2)}) abaixo de 4`);

  return (
    <div className={styles.section}>
      <h2>Tempo de Casa / Elegibilidade</h2>
      <p>
        {promotabilidade.mesesDeCasa} {promotabilidade.mesesDeCasa === 1 ? "mês" : "meses"} no cargo atual —{" "}
        {PROMOTABILIDADE_LABEL[promotabilidade.status]}
      </p>
      {pendencias.length > 0 ? (
        <ul className={styles.list}>
          {pendencias.map((pendencia) => (
            <li key={pendencia}>{pendencia}</li>
          ))}
        </ul>
      ) : null}

      <h2>Certificações & Cursos Requeridos</h2>
      {requirements.length === 0 ? (
        <p className={styles.empty}>Nenhum requisito cadastrado.</p>
      ) : (
        <ul className={styles.list}>
          {requirements.map((req) => (
            <li key={req.id} className={styles.item}>
              <span>{req.title}</span>
              <form action={updateTrackRequirementStatus} className={styles.statusForm}>
                <input type="hidden" name="id" value={req.id} />
                <select
                  name="status"
                  defaultValue={req.status}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={createTrackRequirement} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <input type="text" name="title" placeholder="Novo requisito (ex: Certificação AWS)" required />
        <button type="submit">Adicionar</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Wire the tab into the page**

Modify `apps/web/src/app/(app)/gestao-carreiras/page.tsx`:

```typescript
import { TrilhaSection } from "./trilha-section";
```

Add a new tab branch/helper:

```typescript
          {aba === "pdi" ? <MetasTab userId={userId} /> : null}
          {aba === "trilha" ? <TrilhaTab userId={userId} /> : null}
```

```typescript
async function TrilhaTab({ userId }: { userId: string }) {
  const [requirements, promotabilidade] = await Promise.all([
    apiFetchJson<{ id: string; title: string; status: "pendente" | "andamento" | "concluido" }[]>(
      `/carreira/trilha?userId=${userId}`,
    ),
    apiFetchJson<{
      status: "verde" | "amarelo" | "branco";
      mesesDeCasa: number;
      requisitosPendentes: number;
      metasPendentes: number;
      ultimaMediaAvaliacao: number | null;
    }>(`/carreira/promotabilidade/${userId}`),
  ]);
  return <TrilhaSection userId={userId} requirements={requirements} promotabilidade={promotabilidade} />;
}
```

- [ ] **Step 4: Verify manually**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no new type errors.

With the dev server running, open the "Matriz de Promoção / Trilhas de Carreira" tab for a colaborador: confirm the tempo-de-casa message and 🟢/🟡/⚪ status match what `/colaboradores` shows for the same person (Task 13), the pendências list explains why they're not green when applicable, adding a requirement shows it as "Pendente", and changing its status persists after reload.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/gestao-carreiras/actions.ts apps/web/src/app/\(app\)/gestao-carreiras/trilha-section.tsx apps/web/src/app/\(app\)/gestao-carreiras/page.tsx
git commit -m "feat(web): add Trilha de Carreira tab"
```

---

### Task 12: Frontend — Avaliações tab (Ciclos, 1:1, Nine Box)

**Files:**
- Modify: `apps/web/src/app/(app)/gestao-carreiras/actions.ts`
- Create: `apps/web/src/app/(app)/gestao-carreiras/avaliacoes-section.tsx`
- Modify: `apps/web/src/app/(app)/gestao-carreiras/page.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /carreira/avaliacoes`, `GET`/`POST /carreira/nine-box`, `GET`/`POST /carreira/one-on-ones`, `PATCH /carreira/one-on-ones/acoes/:id` (Tasks 5, 6, 7); the page shell from Task 10.
- Produces: the `aba=avaliacoes` tab, with its own `?sub=` sub-navigation (`ciclos` default, `1a1`, `ninebox`).

- [ ] **Step 1: Add the Server Actions**

Modify `apps/web/src/app/(app)/gestao-carreiras/actions.ts` — append:

```typescript
function parseScore(value: FormDataEntryValue | null): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("Notas devem ser de 1 a 5.");
  }
  return parsed;
}

export async function createEvaluation(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("userId é obrigatório.");
  }
  const proatividade = parseScore(formData.get("proatividade"));
  const trabalhoEquipe = parseScore(formData.get("trabalhoEquipe"));
  const comunicacao = parseScore(formData.get("comunicacao"));
  const lideranca = parseScore(formData.get("lideranca"));
  const comentario = formData.get("comentario");

  const res = await apiFetch("/carreira/avaliacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      proatividade,
      trabalhoEquipe,
      comunicacao,
      lideranca,
      comentario: typeof comentario === "string" && comentario.trim().length > 0 ? comentario.trim() : undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/avaliacoes responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function createNineBoxPlacement(formData: FormData) {
  const userId = formData.get("userId");
  const desempenho = formData.get("desempenho");
  const potencial = formData.get("potencial");
  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    (desempenho !== "baixo" && desempenho !== "medio" && desempenho !== "alto") ||
    (potencial !== "baixo" && potencial !== "medio" && potencial !== "alto")
  ) {
    throw new Error("Selecione desempenho e potencial.");
  }
  const res = await apiFetch("/carreira/nine-box", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, desempenho, potencial }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/nine-box responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function createOneOnOne(formData: FormData) {
  const userId = formData.get("userId");
  const pauta = formData.get("pauta");
  const acoesRaw = formData.get("acoes");
  if (typeof userId !== "string" || userId.length === 0 || typeof pauta !== "string" || pauta.trim().length === 0) {
    throw new Error("Informe a pauta.");
  }
  const acoes =
    typeof acoesRaw === "string" && acoesRaw.trim().length > 0
      ? acoesRaw
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((descricao) => ({ descricao }))
      : [];

  const res = await apiFetch("/carreira/one-on-ones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, pauta: pauta.trim(), acoes }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/one-on-ones responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function updateOneOnOneAcaoStatus(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") {
    throw new Error("Requisição inválida.");
  }
  const res = await apiFetch(`/carreira/one-on-ones/acoes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/one-on-ones/acoes/${id} responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}
```

- [ ] **Step 2: Write the Avaliações section component**

Create `apps/web/src/app/(app)/gestao-carreiras/avaliacoes-section.tsx`:

```typescript
import { createEvaluation, createNineBoxPlacement, createOneOnOne, updateOneOnOneAcaoStatus } from "./actions";
import styles from "./gestao-carreiras.module.css";

type Evaluation = {
  id: string;
  date: string;
  proatividade: number;
  trabalhoEquipe: number;
  comunicacao: number;
  lideranca: number;
  comentario: string | null;
};
type NineBoxPlacement = { id: string; date: string; desempenho: string; potencial: string };
type OneOnOne = {
  id: string;
  date: string;
  pauta: string;
  proximaData: string | null;
  acoes: { id: string; descricao: string; status: "pendente" | "concluido" }[];
};

const SUB_TABS = [
  { value: "ciclos", label: "Ciclos de Avaliação" },
  { value: "1a1", label: "Registros de 1:1" },
  { value: "ninebox", label: "Matriz Nine Box" },
] as const;

export function AvaliacoesSection({
  userId,
  sub,
  evaluations,
  placements,
  oneOnOnes,
}: {
  userId: string;
  sub: string;
  evaluations: Evaluation[];
  placements: NineBoxPlacement[];
  oneOnOnes: OneOnOne[];
}) {
  return (
    <div className={styles.section}>
      <nav className={styles.tabs}>
        {SUB_TABS.map((tab) => (
          <a
            key={tab.value}
            href={`/gestao-carreiras?aba=avaliacoes&sub=${tab.value}&userId=${userId}`}
            className={sub === tab.value ? styles.tabActive : styles.tab}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      {sub === "ciclos" ? <CiclosSubSection userId={userId} evaluations={evaluations} /> : null}
      {sub === "1a1" ? <OneOnOneSubSection userId={userId} oneOnOnes={oneOnOnes} /> : null}
      {sub === "ninebox" ? <NineBoxSubSection userId={userId} placements={placements} /> : null}
    </div>
  );
}

function CiclosSubSection({ userId, evaluations }: { userId: string; evaluations: Evaluation[] }) {
  return (
    <div className={styles.section}>
      {evaluations.length === 0 ? (
        <p className={styles.empty}>Nenhuma avaliação registrada.</p>
      ) : (
        <ul className={styles.list}>
          {evaluations.map((evaluation) => (
            <li key={evaluation.id} className={styles.item}>
              <span>
                Proatividade {evaluation.proatividade} · Trabalho em equipe {evaluation.trabalhoEquipe} · Comunicação{" "}
                {evaluation.comunicacao} · Liderança {evaluation.lideranca}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form action={createEvaluation} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <label>
          Proatividade
          <input type="number" name="proatividade" min={1} max={5} required />
        </label>
        <label>
          Trabalho em equipe
          <input type="number" name="trabalhoEquipe" min={1} max={5} required />
        </label>
        <label>
          Comunicação
          <input type="number" name="comunicacao" min={1} max={5} required />
        </label>
        <label>
          Liderança
          <input type="number" name="lideranca" min={1} max={5} required />
        </label>
        <input type="text" name="comentario" placeholder="Comentário (opcional)" />
        <button type="submit">Registrar avaliação</button>
      </form>
    </div>
  );
}

function OneOnOneSubSection({ userId, oneOnOnes }: { userId: string; oneOnOnes: OneOnOne[] }) {
  return (
    <div className={styles.section}>
      {oneOnOnes.length === 0 ? (
        <p className={styles.empty}>Nenhum 1:1 registrado.</p>
      ) : (
        <ul className={styles.list}>
          {oneOnOnes.map((oneOnOne) => (
            <li key={oneOnOne.id} className={styles.item}>
              <div>
                <strong>{oneOnOne.pauta}</strong>
                <ul>
                  {oneOnOne.acoes.map((acao) => (
                    <li key={acao.id}>
                      {acao.descricao} —{" "}
                      <form action={updateOneOnOneAcaoStatus} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={acao.id} />
                        <select
                          name="status"
                          defaultValue={acao.status}
                          onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="concluido">Concluído</option>
                        </select>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form action={createOneOnOne} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <input type="text" name="pauta" placeholder="Pauta da conversa" required />
        <textarea name="acoes" placeholder={"Itens de ação (um por linha)"} />
        <button type="submit">Registrar 1:1</button>
      </form>
    </div>
  );
}

function NineBoxSubSection({ userId, placements }: { userId: string; placements: NineBoxPlacement[] }) {
  const current = placements[0];
  return (
    <div className={styles.section}>
      <p>
        {current
          ? `Posição atual: desempenho ${current.desempenho}, potencial ${current.potencial}`
          : "Nenhum posicionamento registrado."}
      </p>
      <form action={createNineBoxPlacement} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <label>
          Desempenho
          <select name="desempenho" required>
            <option value="baixo">Baixo</option>
            <option value="medio">Médio</option>
            <option value="alto">Alto</option>
          </select>
        </label>
        <label>
          Potencial
          <select name="potencial" required>
            <option value="baixo">Baixo</option>
            <option value="medio">Médio</option>
            <option value="alto">Alto</option>
          </select>
        </label>
        <button type="submit">Registrar posição</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Wire the tab into the page**

Modify `apps/web/src/app/(app)/gestao-carreiras/page.tsx`:

```typescript
import { AvaliacoesSection } from "./avaliacoes-section";
```

```typescript
          {aba === "trilha" ? <TrilhaTab userId={userId} /> : null}
          {aba === "avaliacoes" ? (
            <AvaliacoesTab userId={userId} sub={typeof params.sub === "string" ? params.sub : "ciclos"} />
          ) : null}
```

```typescript
async function AvaliacoesTab({ userId, sub }: { userId: string; sub: string }) {
  const [evaluations, placements, oneOnOnes] = await Promise.all([
    apiFetchJson<
      { id: string; date: string; proatividade: number; trabalhoEquipe: number; comunicacao: number; lideranca: number; comentario: string | null }[]
    >(`/carreira/avaliacoes?userId=${userId}`),
    apiFetchJson<{ id: string; date: string; desempenho: string; potencial: string }[]>(`/carreira/nine-box?userId=${userId}`),
    apiFetchJson<
      { id: string; date: string; pauta: string; proximaData: string | null; acoes: { id: string; descricao: string; status: "pendente" | "concluido" }[] }[]
    >(`/carreira/one-on-ones?userId=${userId}`),
  ]);
  return (
    <AvaliacoesSection userId={userId} sub={sub} evaluations={evaluations} placements={placements} oneOnOnes={oneOnOnes} />
  );
}
```

- [ ] **Step 4: Verify manually**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no new type errors.

With the dev server running, open the "Avaliações de Desempenho" tab: confirm the 3 sub-tabs (Ciclos, 1:1, Nine Box) switch correctly, submitting an evaluation with scores 1-5 works and a score outside that range is rejected by the `<input type="number" min max>` (and, if bypassed, by `parseScore` in the action), creating a 1:1 with multiple action-item lines splits them correctly, and toggling one action's status doesn't affect its siblings. Registering a nine-box placement updates the "posição atual" line after reload.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/gestao-carreiras/actions.ts apps/web/src/app/\(app\)/gestao-carreiras/avaliacoes-section.tsx apps/web/src/app/\(app\)/gestao-carreiras/page.tsx
git commit -m "feat(web): add Avaliações de Desempenho tab (ciclos, 1:1, nine box)"
```

---

### Task 13: Frontend — Promotabilidade badge on /colaboradores

**Files:**
- Modify: `apps/web/src/app/(app)/colaboradores/page.tsx`
- Modify: `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`

**Interfaces:**
- Consumes: `GET /carreira/promotabilidade` (Task 8), returning `Record<string, "verde" | "amarelo" | "branco">`.
- Produces: nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Fetch promotabilidade only for gestor**

Read `apps/web/src/app/(app)/colaboradores/page.tsx` first to find its current data-fetching block (it fetches employees + convenções and renders `ColaboradoresRow` per employee). Add, conditioned on `session.role === "gestor"`:

```typescript
const promotabilidade =
  session.role === "gestor" ? await apiFetchJson<Record<string, "verde" | "amarelo" | "branco">>("/carreira/promotabilidade") : {};
```

Pass it down to each row: `<ColaboradoresRow employee={employee} convencoes={convencoes} promotabilidade={promotabilidade[employee.userId]} />`.

- [ ] **Step 2: Render the badge in the row**

Modify `apps/web/src/app/(app)/colaboradores/colaboradores-row.tsx`:

```typescript
const PROMOTABILIDADE_BADGE: Record<"verde" | "amarelo" | "branco", string> = {
  verde: "🟢",
  amarelo: "🟡",
  branco: "⚪",
};
```

Add the prop to the component signature:

```typescript
export function ColaboradoresRow({
  employee,
  convencoes,
  promotabilidade,
}: {
  employee: Employee;
  convencoes: { id: string; nome: string }[];
  promotabilidade?: "verde" | "amarelo" | "branco";
}) {
```

Render it next to the name:

```typescript
      <span className={styles.itemName}>
        {employee.name}
        {promotabilidade ? (
          <span aria-label={`Promotabilidade: ${promotabilidade}`} title={`Promotabilidade: ${promotabilidade}`}>
            {" "}
            {PROMOTABILIDADE_BADGE[promotabilidade]}
          </span>
        ) : null}
      </span>
```

- [ ] **Step 3: Verify manually**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no new type errors.

Run the existing Playwright suite for the colaboradores flow if one exists (check `apps/web` for a `colaboradores`-related `.spec.ts` under its e2e folder); otherwise verify manually: log in as `gestor`, open `/colaboradores`, confirm every row shows a 🟢/🟡/⚪ badge next to the name. Log in as `rh`, open `/colaboradores`, confirm **no** badge appears and the page makes no request to `/carreira/promotabilidade` (check the Network tab).

- [ ] **Step 4: Run the full backend and frontend suites one more time**

Run (from repo root): `npx turbo run test` (or `npx jest` in `apps/api` and `packages/shared-types` individually, plus `npx tsc --noEmit` in `apps/web`)
Expected: everything green — this is the final task of the plan.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/colaboradores/page.tsx apps/web/src/app/\(app\)/colaboradores/colaboradores-row.tsx
git commit -m "feat(web): show promotabilidade badge on /colaboradores for gestor"
```
