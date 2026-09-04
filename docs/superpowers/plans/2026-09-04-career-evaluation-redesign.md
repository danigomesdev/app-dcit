# Career Evaluation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the gestor-only "Avaliações → Ciclos" evaluation (4 fixed criteria, 1-5 scale) with a richer career evaluation built on the company's real career-plan model: 5 princípios essenciais, 6 competências (hard/soft), a fixed 4-level salary ladder with per-level promotion requirements, and a gestor-actioned promotion decision.

**Architecture:** New Prisma models (`CareerEvaluation` + 3 child tables) alongside a fixed, in-code career-ladder reference table in `packages/shared-types`. New `apps/api/src/carreira/evaluations.{service,controller}.ts`. Automatic within-level salary-step progression hooked into the existing `CareerGoalsService.updateStatus`. New gestor-only screen tab in `apps/web/src/app/(app)/gestao-carreiras/`, built as mostly-server-rendered forms (this codebase's dominant pattern) with one small client-component island for the promotion-confirmation dialog. Final task retires the old "Ciclos" evaluation type end-to-end.

**Tech Stack:** NestJS + Prisma (SQLite), Zod validation via `.safeParse()`, Next.js 16 App Router Server Actions, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-09-04-career-evaluation-redesign-design.md`

## Global Constraints

- Gestor-only feature end to end — no RH involvement anywhere in this module (matches the existing `/gestao-carreiras` page, which already gates on `session.role !== "gestor"`).
- The career ladder (4 níveis, salary ranges, 4 fixed steps per nível, promotion requisitos per nível) is fixed in code, not editable via any UI, seeded with the exact values below.
- Eligibility for promotion: `mediaGeral >= 7` (constant `ELEGIBILIDADE_MEDIA_MINIMA`) **and** every `obrigatorio` requisito of the próximo nível is checked. Eletivos never gate eligibility.
- `mediaGeral` = simple average of all 11 scores (5 princípios + 6 competências), one decimal place.
- Salary-step auto-progression only moves within the current nível (never auto-crosses into the next nível) and only triggers on a `CareerGoal` transitioning into `"concluida"` from a different status (idempotent — re-saving an already-`"concluida"` goal must not advance twice).
- A real level-up (Employee.nivel + Employee.salarioMensal change) only happens through the new evaluation's "Submeter para Decisão" flow, and only when the gestor explicitly confirms the promotion prompt.
- No `apps/mobile` changes. No changes to `Employee.cargo` (technical job function) — this feature uses the pre-existing, separate `Employee.nivel` field.
- Follow every existing `apps/api/src/carreira/*` convention exactly: `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('gestor')` per handler, Zod `.safeParse()` + `BadRequestException(result.error.flatten())` for validation, `?userId=` query param (not path param) for per-colaborador GETs, `req.user.sub` for the acting gestor's id (never trusted from the request body).
- Test conventions: API service tests use the real SQLite test DB (`process.env.DATABASE_URL = 'file:./test.db'` at the top of the file, `PrismaService` + `onModuleInit()`/`onModuleDestroy()`, cleanup scoped to a test-prefixed `userId` in `afterAll`). API controller tests mock the service and assert guard metadata via `Reflect.getMetadata(GUARDS_METADATA, ...)` / `ROLES_KEY`. Web e2e tests use Playwright against `apps/web/e2e/fake-api-server.mjs`.

### The career ladder (reference data — used verbatim in Task 1)

| Nível (`Employee.nivel`) | Label | Faixa | Degraus fixos (R$) | Próximo nível |
|---|---|---|---|---|
| `junior` | Analista Júnior | 2.500–3.800 | 2500, 2900, 3400, 3800 | `pleno` |
| `pleno` | Analista Pleno | 4.000–6.200 | 4000, 4700, 5500, 6200 | `senior` |
| `senior` | Analista Sênior | 6.000–8.500 | 6000, 6800, 7700, 8500 | `especialista` |
| `especialista` | Especialista / Consultor | 8.500–10.500 | 8500, 9200, 9800, 10500 | `null` |

Requisitos to be promoted **into** each nível:

- **junior** — obrigatórios: "1 a 2 anos de experiência", "Graduação em andamento ou concluída". eletivos: "Certificações não obrigatórias", "Habilidades em desenvolvimento", "Atuação sob supervisão".
- **pleno** — obrigatórios: "Mais de 3 anos de experiência", "Graduação completa". eletivos: "1 a 2 certificações", "Autonomia técnica", "Soft skills em evolução", "KPIs cumpridos".
- **senior** — obrigatórios: "3 anos ou mais como Pleno, com graduação completa", "Especialização desejável e no mínimo 3 certificações", "Soft skills consolidadas e referência técnica". eletivos: "Habilidade comercial e insights de upsell", "Visão de Customer Success", "KPIs aprimorados", "Oportunidade de migração do modelo contratual".
- **especialista** — obrigatórios: "Senioridade comprovada, com formação superior e especialização", "5 ou mais certificações e hard skills avançadas", "Liderança e referência estratégica". eletivos: none.

5 princípios (key → label → descrição):

1. `clareza` — Clareza — "Entende sua posição, próximo passo e o que desenvolver."
2. `meritocracia` — Meritocracia Responsável — "Reconhece entregas, evolução e cultura."
3. `equilibrio` — Equilíbrio — "Combina técnica com postura, colaboração e visão de cliente."
4. `transparencia` — Transparência — "Conhece critérios, acompanha resultados e aceita o modelo."
5. `desenvolvimento` — Desenvolvimento Contínuo — "Busca capacitação, certificações, feedbacks e mentorias."

6 competências (key → categoria → label):

- `dominio_tecnico` — hard — "Domínio Técnico & Aplicação Prática"
- `qualidade_solucoes` — hard — "Qualidade das Soluções & Entregas"
- `kpis_tecnicos` — hard — "Cumprimento de KPIs Técnicos"
- `comunicacao_postura` — soft — "Comunicação & Postura com Cliente"
- `organizacao_crises` — soft — "Organização & Resolução de Crises"
- `visao_estrategica` — soft — "Visão Estratégica & Trabalho em Equipe"

---

### Task 1: Career ladder reference data & Zod schemas (shared-types)

**Files:**
- Create: `packages/shared-types/src/career-ladder.ts`
- Create: `packages/shared-types/src/career-ladder.test.ts`
- Create: `packages/shared-types/src/career-evaluation.ts`
- Create: `packages/shared-types/src/career-evaluation.test.ts`
- Modify: `packages/shared-types/src/index.ts` (append exports)

**Interfaces:**
- Produces: `CAREER_LADDER: Record<NivelEscada, NivelLadder>`, `NIVEL_LABELS`, `NIVEIS_ESCADA`, `type NivelEscada`, `PRINCIPIO_KEYS`, `type PrincipioKey`, `PRINCIPIOS: Record<PrincipioKey, {label, descricao}>`, `COMPETENCIA_KEYS`, `type CompetenciaKey`, `COMPETENCIA_CATEGORIA: Record<CompetenciaKey, "hard"|"soft">`, `COMPETENCIA_LABELS`, `ELEGIBILIDADE_MEDIA_MINIMA`, `calcularMediaGeral(notas: number[]): number`, `CareerEvaluationSaveSchema`, `type CareerEvaluationSaveInput`, `CareerEvaluationDecidirSchema`, `type CareerEvaluationDecidirInput` — all consumed by Tasks 3, 4, 5, 6.

- [ ] **Step 1: Write the failing tests**

Create `packages/shared-types/src/career-ladder.test.ts`:
```typescript
import { CAREER_LADDER, calcularMediaGeral, NIVEIS_ESCADA } from "./career-ladder";

describe("CAREER_LADDER", () => {
  it("has all 4 níveis with ascending, 4-step degraus", () => {
    for (const nivel of NIVEIS_ESCADA) {
      const info = CAREER_LADDER[nivel];
      expect(info.degraus).toHaveLength(4);
      for (let i = 1; i < info.degraus.length; i++) {
        expect(info.degraus[i]).toBeGreaterThan(info.degraus[i - 1]);
      }
    }
  });

  it("chains proximoNivel correctly, ending in null at especialista", () => {
    expect(CAREER_LADDER.junior.proximoNivel).toBe("pleno");
    expect(CAREER_LADDER.pleno.proximoNivel).toBe("senior");
    expect(CAREER_LADDER.senior.proximoNivel).toBe("especialista");
    expect(CAREER_LADDER.especialista.proximoNivel).toBeNull();
  });

  it("especialista has no eletivo requisitos", () => {
    expect(CAREER_LADDER.especialista.requisitos.some((r) => r.tipo === "eletivo")).toBe(false);
  });

  it("every nível has at least 2 obrigatorio requisitos", () => {
    for (const nivel of NIVEIS_ESCADA) {
      const obrigatorios = CAREER_LADDER[nivel].requisitos.filter((r) => r.tipo === "obrigatorio");
      expect(obrigatorios.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("calcularMediaGeral", () => {
  it("averages a list of scores to one decimal place", () => {
    expect(calcularMediaGeral([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8])).toBe(8);
  });

  it("rounds to one decimal place", () => {
    expect(calcularMediaGeral([7, 8])).toBe(7.5);
    expect(calcularMediaGeral([7, 7, 8])).toBe(7.3);
  });
});
```

Create `packages/shared-types/src/career-evaluation.test.ts`:
```typescript
import { CareerEvaluationSaveSchema, CareerEvaluationDecidirSchema } from "./career-evaluation";
import { PRINCIPIO_KEYS, COMPETENCIA_KEYS } from "./career-ladder";

const VALID_INPUT = {
  userId: "user-1",
  principios: PRINCIPIO_KEYS.map((principio) => ({ principio, nota: 8, justificativa: "Boa evolução." })),
  competencias: COMPETENCIA_KEYS.map((competencia) => ({ competencia, nota: 7 })),
  requisitosAtendidos: ["Graduação completa"],
};

describe("CareerEvaluationSaveSchema", () => {
  it("accepts a fully populated valid payload", () => {
    expect(CareerEvaluationSaveSchema.safeParse(VALID_INPUT).success).toBe(true);
  });

  it("rejects a principios array missing an entry", () => {
    const result = CareerEvaluationSaveSchema.safeParse({
      ...VALID_INPUT,
      principios: VALID_INPUT.principios.slice(1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a nota above 10", () => {
    const result = CareerEvaluationSaveSchema.safeParse({
      ...VALID_INPUT,
      competencias: [{ ...VALID_INPUT.competencias[0], nota: 11 }, ...VALID_INPUT.competencias.slice(1)],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown principio key", () => {
    const result = CareerEvaluationSaveSchema.safeParse({
      ...VALID_INPUT,
      principios: [{ principio: "not-a-real-key", nota: 8 }, ...VALID_INPUT.principios.slice(1)],
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty requisitosAtendidos array", () => {
    expect(CareerEvaluationSaveSchema.safeParse({ ...VALID_INPUT, requisitosAtendidos: [] }).success).toBe(true);
  });
});

describe("CareerEvaluationDecidirSchema", () => {
  it("accepts confirmarPromocao true/false", () => {
    expect(CareerEvaluationDecidirSchema.safeParse({ confirmarPromocao: true }).success).toBe(true);
    expect(CareerEvaluationDecidirSchema.safeParse({ confirmarPromocao: false }).success).toBe(true);
  });

  it("rejects a missing confirmarPromocao", () => {
    expect(CareerEvaluationDecidirSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `packages/shared-types`): `pnpm exec jest src/career-ladder.test.ts src/career-evaluation.test.ts`
Expected: FAIL — `Cannot find module './career-ladder'` / `'./career-evaluation'`

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared-types/src/career-ladder.ts`:
```typescript
export const NIVEIS_ESCADA = ["junior", "pleno", "senior", "especialista"] as const;
export type NivelEscada = (typeof NIVEIS_ESCADA)[number];

export const NIVEL_LABELS: Record<NivelEscada, string> = {
  junior: "Analista Júnior",
  pleno: "Analista Pleno",
  senior: "Analista Sênior",
  especialista: "Especialista / Consultor",
};

export type RequisitoLadder = { tipo: "obrigatorio" | "eletivo"; label: string };

export type NivelLadder = {
  nivel: NivelEscada;
  label: string;
  degraus: number[];
  proximoNivel: NivelEscada | null;
  requisitos: RequisitoLadder[];
};

export const CAREER_LADDER: Record<NivelEscada, NivelLadder> = {
  junior: {
    nivel: "junior",
    label: NIVEL_LABELS.junior,
    degraus: [2500, 2900, 3400, 3800],
    proximoNivel: "pleno",
    requisitos: [
      { tipo: "obrigatorio", label: "1 a 2 anos de experiência" },
      { tipo: "obrigatorio", label: "Graduação em andamento ou concluída" },
      { tipo: "eletivo", label: "Certificações não obrigatórias" },
      { tipo: "eletivo", label: "Habilidades em desenvolvimento" },
      { tipo: "eletivo", label: "Atuação sob supervisão" },
    ],
  },
  pleno: {
    nivel: "pleno",
    label: NIVEL_LABELS.pleno,
    degraus: [4000, 4700, 5500, 6200],
    proximoNivel: "senior",
    requisitos: [
      { tipo: "obrigatorio", label: "Mais de 3 anos de experiência" },
      { tipo: "obrigatorio", label: "Graduação completa" },
      { tipo: "eletivo", label: "1 a 2 certificações" },
      { tipo: "eletivo", label: "Autonomia técnica" },
      { tipo: "eletivo", label: "Soft skills em evolução" },
      { tipo: "eletivo", label: "KPIs cumpridos" },
    ],
  },
  senior: {
    nivel: "senior",
    label: NIVEL_LABELS.senior,
    degraus: [6000, 6800, 7700, 8500],
    proximoNivel: "especialista",
    requisitos: [
      { tipo: "obrigatorio", label: "3 anos ou mais como Pleno, com graduação completa" },
      { tipo: "obrigatorio", label: "Especialização desejável e no mínimo 3 certificações" },
      { tipo: "obrigatorio", label: "Soft skills consolidadas e referência técnica" },
      { tipo: "eletivo", label: "Habilidade comercial e insights de upsell" },
      { tipo: "eletivo", label: "Visão de Customer Success" },
      { tipo: "eletivo", label: "KPIs aprimorados" },
      { tipo: "eletivo", label: "Oportunidade de migração do modelo contratual" },
    ],
  },
  especialista: {
    nivel: "especialista",
    label: NIVEL_LABELS.especialista,
    degraus: [8500, 9200, 9800, 10500],
    proximoNivel: null,
    requisitos: [
      { tipo: "obrigatorio", label: "Senioridade comprovada, com formação superior e especialização" },
      { tipo: "obrigatorio", label: "5 ou mais certificações e hard skills avançadas" },
      { tipo: "obrigatorio", label: "Liderança e referência estratégica" },
    ],
  },
};

export const PRINCIPIO_KEYS = ["clareza", "meritocracia", "equilibrio", "transparencia", "desenvolvimento"] as const;
export type PrincipioKey = (typeof PRINCIPIO_KEYS)[number];

export const PRINCIPIOS: Record<PrincipioKey, { label: string; descricao: string }> = {
  clareza: { label: "Clareza", descricao: "Entende sua posição, próximo passo e o que desenvolver." },
  meritocracia: { label: "Meritocracia Responsável", descricao: "Reconhece entregas, evolução e cultura." },
  equilibrio: { label: "Equilíbrio", descricao: "Combina técnica com postura, colaboração e visão de cliente." },
  transparencia: { label: "Transparência", descricao: "Conhece critérios, acompanha resultados e aceita o modelo." },
  desenvolvimento: {
    label: "Desenvolvimento Contínuo",
    descricao: "Busca capacitação, certificações, feedbacks e mentorias.",
  },
};

export const COMPETENCIA_KEYS = [
  "dominio_tecnico",
  "qualidade_solucoes",
  "kpis_tecnicos",
  "comunicacao_postura",
  "organizacao_crises",
  "visao_estrategica",
] as const;
export type CompetenciaKey = (typeof COMPETENCIA_KEYS)[number];

export const COMPETENCIA_CATEGORIA: Record<CompetenciaKey, "hard" | "soft"> = {
  dominio_tecnico: "hard",
  qualidade_solucoes: "hard",
  kpis_tecnicos: "hard",
  comunicacao_postura: "soft",
  organizacao_crises: "soft",
  visao_estrategica: "soft",
};

export const COMPETENCIA_LABELS: Record<CompetenciaKey, string> = {
  dominio_tecnico: "Domínio Técnico & Aplicação Prática",
  qualidade_solucoes: "Qualidade das Soluções & Entregas",
  kpis_tecnicos: "Cumprimento de KPIs Técnicos",
  comunicacao_postura: "Comunicação & Postura com Cliente",
  organizacao_crises: "Organização & Resolução de Crises",
  visao_estrategica: "Visão Estratégica & Trabalho em Equipe",
};

export const ELEGIBILIDADE_MEDIA_MINIMA = 7;

export function calcularMediaGeral(notas: number[]): number {
  const soma = notas.reduce((acc, n) => acc + n, 0);
  return Math.round((soma / notas.length) * 10) / 10;
}
```

Create `packages/shared-types/src/career-evaluation.ts`:
```typescript
import { z } from "zod";

import { PRINCIPIO_KEYS, COMPETENCIA_KEYS } from "./career-ladder";

export const CareerEvaluationSaveSchema = z.object({
  userId: z.string().min(1),
  principios: z
    .array(
      z.object({
        principio: z.enum(PRINCIPIO_KEYS),
        nota: z.number().int().min(0).max(10),
        justificativa: z.string().optional(),
      }),
    )
    .length(PRINCIPIO_KEYS.length),
  competencias: z
    .array(
      z.object({
        competencia: z.enum(COMPETENCIA_KEYS),
        nota: z.number().int().min(0).max(10),
      }),
    )
    .length(COMPETENCIA_KEYS.length),
  requisitosAtendidos: z.array(z.string()),
});
export type CareerEvaluationSaveInput = z.infer<typeof CareerEvaluationSaveSchema>;

export const CareerEvaluationDecidirSchema = z.object({
  confirmarPromocao: z.boolean(),
});
export type CareerEvaluationDecidirInput = z.infer<typeof CareerEvaluationDecidirSchema>;
```

Append to the end of `packages/shared-types/src/index.ts`:
```typescript
export {
  NIVEIS_ESCADA,
  NIVEL_LABELS,
  CAREER_LADDER,
  PRINCIPIO_KEYS,
  PRINCIPIOS,
  COMPETENCIA_KEYS,
  COMPETENCIA_CATEGORIA,
  COMPETENCIA_LABELS,
  ELEGIBILIDADE_MEDIA_MINIMA,
  calcularMediaGeral,
} from "./career-ladder";
export type { NivelEscada, RequisitoLadder, NivelLadder, PrincipioKey, CompetenciaKey } from "./career-ladder";
export { CareerEvaluationSaveSchema, CareerEvaluationDecidirSchema } from "./career-evaluation";
export type { CareerEvaluationSaveInput, CareerEvaluationDecidirInput } from "./career-evaluation";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec jest src/career-ladder.test.ts src/career-evaluation.test.ts`
Expected: PASS, all tests

- [ ] **Step 5: Build the package**

Run (from `packages/shared-types`): `pnpm run build`
This regenerates `dist/`, which `apps/api` and `apps/web` resolve at runtime for any code path that imports these exports as *values* (not type-only) — skipping this step is a known trap from an earlier feature in this repo (a controller's runtime `.safeParse()` call silently used a stale `dist/`).

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/career-ladder.ts packages/shared-types/src/career-ladder.test.ts packages/shared-types/src/career-evaluation.ts packages/shared-types/src/career-evaluation.test.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add fixed career ladder and evaluation schemas"
```

---

### Task 2: Prisma schema — CareerEvaluation + child tables

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Creates: a new migration folder under `apps/api/prisma/migrations/` (generated by the Prisma CLI, not hand-authored)

**Interfaces:**
- Produces: `prisma.careerEvaluation`, `prisma.careerPrincipioScore`, `prisma.careerCompetenciaScore`, `prisma.careerRequisitoCheck` Prisma Client models, consumed by Task 3.

- [ ] **Step 1: Add the models**

In `apps/api/prisma/schema.prisma`, insert immediately after the existing `model OneOnOneAcao { ... }` block (before `model WorkedHoursEntry`):

```prisma
model CareerEvaluation {
  id            String    @id @default(uuid())
  userId        String
  evaluatorId   String
  nivelAvaliado String    // nivel do colaborador no momento da avaliação
  proximoNivel  String?   // próximo nível da escada nesse momento; null se já no topo
  status        String    @default("salva") // "salva" | "decidida"
  resultado     String?   // "promovido" | "em_desenvolvimento" — setado só quando status = "decidida"
  mediaGeral    Float?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  decidedAt     DateTime?
}

model CareerPrincipioScore {
  id            String  @id @default(uuid())
  evaluationId  String
  principio     String  // "clareza" | "meritocracia" | "equilibrio" | "transparencia" | "desenvolvimento"
  nota          Int     // 0-10
  justificativa String?
}

model CareerCompetenciaScore {
  id           String @id @default(uuid())
  evaluationId String
  categoria    String // "hard" | "soft"
  competencia  String // ver COMPETENCIA_KEYS em shared-types
  nota         Int    // 0-10
}

model CareerRequisitoCheck {
  id           String  @id @default(uuid())
  evaluationId String
  tipo         String  // "obrigatorio" | "eletivo"
  label        String
  atendido     Boolean @default(false)
}
```

No `@relation`/cascade on the child tables' `evaluationId` — matches this schema's existing convention for `OneOnOneAcao.oneOnOneId` (a plain foreign-key column, joined manually in the service layer, no Prisma relation declared).

- [ ] **Step 2: Generate and apply the migration**

Run (from `apps/api`): `pnpm exec prisma migrate dev --name add_career_evaluation_models`
Expected: creates a new timestamped folder under `prisma/migrations/`, applies it to the local dev DB, regenerates the Prisma Client.

- [ ] **Step 3: Run the full API test suite to check for regressions**

Run (from `apps/api`): `pnpm exec jest`
Expected: PASS — this task only adds new models, no existing code path touches them yet.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add CareerEvaluation schema for the new career evaluation model"
```

---

### Task 3: `CareerEvaluationsService` (get, save, decidir)

**Files:**
- Create: `apps/api/src/carreira/evaluations.service.ts`
- Create: `apps/api/src/carreira/evaluations.service.spec.ts`

**Interfaces:**
- Consumes: `CareerEvaluationSaveInput` (Task 1), `CAREER_LADDER`, `calcularMediaGeral`, `ELEGIBILIDADE_MEDIA_MINIMA`, `COMPETENCIA_CATEGORIA`, `type NivelEscada` (Task 1), the 4 Prisma models (Task 2).
- Produces: `CareerEvaluationsService.getOpen(userId): Promise<Evaluation | null>`, `.save(evaluatorId, input): Promise<Evaluation>`, `.decidir(id, confirmarPromocao): Promise<CareerEvaluation>` — consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/carreira/evaluations.service.spec.ts`:
```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { CareerEvaluationsService } from './evaluations.service';
import { PrismaService } from '../prisma/prisma.service';

const USER_ID = 'evaluations-spec-user';

describe('CareerEvaluationsService', () => {
  let service: CareerEvaluationsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CareerEvaluationsService, PrismaService],
    }).compile();
    service = module.get(CareerEvaluationsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.employee.create({
      data: { userId: USER_ID, name: 'Ana Teste', role: 'colaborador', nivel: 'pleno', salarioMensal: 4700, hireDate: new Date('2024-01-01') },
    });
  });

  afterAll(async () => {
    const evaluations = await prisma.careerEvaluation.findMany({ where: { userId: USER_ID } });
    const evaluationIds = evaluations.map((e) => e.id);
    await prisma.careerPrincipioScore.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
    await prisma.careerCompetenciaScore.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
    await prisma.careerRequisitoCheck.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
    await prisma.careerEvaluation.deleteMany({ where: { userId: USER_ID } });
    await prisma.employee.delete({ where: { userId: USER_ID } });
    await prisma.onModuleDestroy();
  });

  const PRINCIPIOS_NOTAS = [
    { principio: 'clareza', nota: 8, justificativa: 'Boa.' },
    { principio: 'meritocracia', nota: 8 },
    { principio: 'equilibrio', nota: 8 },
    { principio: 'transparencia', nota: 8 },
    { principio: 'desenvolvimento', nota: 8 },
  ];
  const COMPETENCIAS_NOTAS = [
    { competencia: 'dominio_tecnico', nota: 6 },
    { competencia: 'qualidade_solucoes', nota: 6 },
    { competencia: 'kpis_tecnicos', nota: 6 },
    { competencia: 'comunicacao_postura', nota: 6 },
    { competencia: 'organizacao_crises', nota: 6 },
    { competencia: 'visao_estrategica', nota: 6 },
  ];

  it('save() creates an evaluation with nivelAvaliado/proximoNivel derived from the employee, and computed mediaGeral', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: ['Graduação completa'],
    });
    expect(evaluation.nivelAvaliado).toBe('pleno');
    expect(evaluation.proximoNivel).toBe('senior');
    expect(evaluation.status).toBe('salva');
    expect(evaluation.evaluatorId).toBe('gestor-1');
    // (8*5 + 6*6) / 11 = 76/11 = 6.909... -> 6.9
    expect(evaluation.mediaGeral).toBeCloseTo(6.9, 1);
    expect(evaluation.principios).toHaveLength(5);
    expect(evaluation.competencias).toHaveLength(6);
  });

  it('save() persists every requisito of the próximo nível, ignoring atendido labels that belong to a different nível', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      // "Mais de 3 anos de experiência" is a PLENO requisito, not one of SENIOR's —
      // the employee here is pleno, so próximoNivel is senior, and this label must
      // not match (and must not silently get inserted) any of senior's requisitos.
      requisitosAtendidos: ['Mais de 3 anos de experiência'],
    });
    // senior's requisitos: 3 obrigatórios + 4 eletivos = 7 total
    expect(evaluation.requisitos).toHaveLength(7);
    expect(evaluation.requisitos.every((r) => r.atendido === false)).toBe(true);
    expect(evaluation.requisitos.some((r) => r.label === 'Mais de 3 anos de experiência')).toBe(false);
  });

  it('save() marks a requisito atendido when its exact label is sent', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: ['3 anos ou mais como Pleno, com graduação completa'],
    });
    const graduacao = evaluation.requisitos.find((r) => r.label === '3 anos ou mais como Pleno, com graduação completa');
    expect(graduacao?.atendido).toBe(true);
    expect(evaluation.requisitos.filter((r) => r.atendido).length).toBe(1);
  });

  it('save() called twice updates the same open evaluation in place rather than creating a second one', async () => {
    const first = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: [],
    });
    const second = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: [],
    });
    expect(second.id).toBe(first.id);
    expect(second.principios.every((p) => p.nota === 10)).toBe(true);
    const openCount = await prisma.careerEvaluation.count({ where: { userId: USER_ID, status: 'salva' } });
    expect(openCount).toBe(1);
  });

  it('getOpen() returns null when no evaluation has been saved yet for a different user', async () => {
    const result = await service.getOpen('nobody-has-evaluated-this-user');
    expect(result).toBeNull();
  });

  it('getOpen() returns the open evaluation with its children', async () => {
    await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: [],
    });
    const open = await service.getOpen(USER_ID);
    expect(open?.status).toBe('salva');
    expect(open?.principios).toHaveLength(5);
  });

  it('decidir() marks the evaluation decidida with resultado em_desenvolvimento when not eligible, and does not touch Employee', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 2 })), // too low to be eligible
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 2 })),
      requisitosAtendidos: [],
    });
    const decided = await service.decidir(evaluation.id, true);
    expect(decided.status).toBe('decidida');
    expect(decided.resultado).toBe('em_desenvolvimento');
    expect(decided.decidedAt).not.toBeNull();
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('pleno'); // unchanged
  });

  // A pleno employee's próximoNivel is senior, so eligibility checks senior's
  // obrigatórios — NOT pleno's own ("Mais de 3 anos de experiência" etc.,
  // which are what got this employee INTO pleno, already satisfied in the past).
  const SENIOR_OBRIGATORIOS = [
    '3 anos ou mais como Pleno, com graduação completa',
    'Especialização desejável e no mínimo 3 certificações',
    'Soft skills consolidadas e referência técnica',
  ];

  it('decidir() promotes the employee (nivel + salarioMensal) when eligible and confirmarPromocao is true', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 10 })),
      requisitosAtendidos: SENIOR_OBRIGATORIOS,
    });
    const decided = await service.decidir(evaluation.id, true);
    expect(decided.resultado).toBe('promovido');
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('senior');
    expect(employee.salarioMensal).toBe(6000); // senior's first degrau
  });

  it('decidir() computes resultado promovido but does NOT touch Employee when confirmarPromocao is false', async () => {
    await prisma.employee.update({ where: { userId: USER_ID }, data: { nivel: 'pleno', salarioMensal: 4700 } });
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 10 })),
      requisitosAtendidos: SENIOR_OBRIGATORIOS,
    });
    const decided = await service.decidir(evaluation.id, false);
    expect(decided.resultado).toBe('promovido');
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('pleno'); // unchanged — gestor did not confirm
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/carreira/evaluations.service.spec.ts`
Expected: FAIL — `Cannot find module './evaluations.service'`

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/carreira/evaluations.service.ts`:
```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CareerEvaluationSaveInput } from '@ponto-dcit/shared-types';
import { CAREER_LADDER, COMPETENCIA_CATEGORIA, ELEGIBILIDADE_MEDIA_MINIMA, calcularMediaGeral, type NivelEscada } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CareerEvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOpen(userId: string) {
    const evaluation = await this.prisma.careerEvaluation.findFirst({
      where: { userId, status: 'salva' },
      orderBy: { createdAt: 'desc' },
    });
    if (!evaluation) return null;
    return this.withChildren(evaluation);
  }

  private async withChildren<T extends { id: string }>(evaluation: T) {
    const [principios, competencias, requisitos] = await Promise.all([
      this.prisma.careerPrincipioScore.findMany({ where: { evaluationId: evaluation.id } }),
      this.prisma.careerCompetenciaScore.findMany({ where: { evaluationId: evaluation.id } }),
      this.prisma.careerRequisitoCheck.findMany({ where: { evaluationId: evaluation.id } }),
    ]);
    return { ...evaluation, principios, competencias, requisitos };
  }

  async save(evaluatorId: string, input: CareerEvaluationSaveInput) {
    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { userId: input.userId } });
    const nivelAvaliado = (employee.nivel ?? 'junior') as NivelEscada;
    const proximoNivel = CAREER_LADDER[nivelAvaliado].proximoNivel;
    const requisitosLadder = proximoNivel ? CAREER_LADDER[proximoNivel].requisitos : [];
    const mediaGeral = calcularMediaGeral([
      ...input.principios.map((p) => p.nota),
      ...input.competencias.map((c) => c.nota),
    ]);

    const existing = await this.prisma.careerEvaluation.findFirst({
      where: { userId: input.userId, status: 'salva' },
      orderBy: { createdAt: 'desc' },
    });

    const evaluation = existing
      ? await this.prisma.careerEvaluation.update({
          where: { id: existing.id },
          data: { evaluatorId, nivelAvaliado, proximoNivel, mediaGeral },
        })
      : await this.prisma.careerEvaluation.create({
          data: { userId: input.userId, evaluatorId, nivelAvaliado, proximoNivel, mediaGeral, status: 'salva' },
        });

    if (existing) {
      await Promise.all([
        this.prisma.careerPrincipioScore.deleteMany({ where: { evaluationId: evaluation.id } }),
        this.prisma.careerCompetenciaScore.deleteMany({ where: { evaluationId: evaluation.id } }),
        this.prisma.careerRequisitoCheck.deleteMany({ where: { evaluationId: evaluation.id } }),
      ]);
    }

    await Promise.all([
      this.prisma.careerPrincipioScore.createMany({
        data: input.principios.map((p) => ({
          evaluationId: evaluation.id,
          principio: p.principio,
          nota: p.nota,
          justificativa: p.justificativa,
        })),
      }),
      this.prisma.careerCompetenciaScore.createMany({
        data: input.competencias.map((c) => ({
          evaluationId: evaluation.id,
          categoria: COMPETENCIA_CATEGORIA[c.competencia],
          competencia: c.competencia,
          nota: c.nota,
        })),
      }),
      requisitosLadder.length > 0
        ? this.prisma.careerRequisitoCheck.createMany({
            data: requisitosLadder.map((r) => ({
              evaluationId: evaluation.id,
              tipo: r.tipo,
              label: r.label,
              atendido: input.requisitosAtendidos.includes(r.label),
            })),
          })
        : Promise.resolve({ count: 0 }),
    ]);

    return this.withChildren(evaluation);
  }

  async decidir(id: string, confirmarPromocao: boolean) {
    const evaluation = await this.prisma.careerEvaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('Avaliação não encontrada');
    if (evaluation.status === 'decidida') throw new BadRequestException('Avaliação já foi decidida');

    const requisitos = await this.prisma.careerRequisitoCheck.findMany({ where: { evaluationId: id } });
    const obrigatoriosOk = requisitos.filter((r) => r.tipo === 'obrigatorio').every((r) => r.atendido);
    const mediaOk = (evaluation.mediaGeral ?? 0) >= ELEGIBILIDADE_MEDIA_MINIMA;
    const elegivel = evaluation.proximoNivel !== null && obrigatoriosOk && mediaOk;
    const resultado = elegivel ? 'promovido' : 'em_desenvolvimento';

    return this.prisma.$transaction(async (tx) => {
      const decided = await tx.careerEvaluation.update({
        where: { id },
        data: { status: 'decidida', resultado, decidedAt: new Date() },
      });
      if (resultado === 'promovido' && confirmarPromocao && evaluation.proximoNivel) {
        const primeiroDegrau = CAREER_LADDER[evaluation.proximoNivel as NivelEscada].degraus[0];
        await tx.employee.update({
          where: { userId: evaluation.userId },
          data: { nivel: evaluation.proximoNivel, salarioMensal: primeiroDegrau },
        });
      }
      return decided;
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec jest src/carreira/evaluations.service.spec.ts`
Expected: PASS, all tests

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/carreira/evaluations.service.ts apps/api/src/carreira/evaluations.service.spec.ts
git commit -m "feat(api): add CareerEvaluationsService"
```

---

### Task 4: `CareerEvaluationsController` + module wiring

**Files:**
- Create: `apps/api/src/carreira/evaluations.controller.ts`
- Create: `apps/api/src/carreira/evaluations.controller.spec.ts`
- Modify: `apps/api/src/carreira/carreira.module.ts`

**Interfaces:**
- Consumes: `CareerEvaluationsService` (Task 3), `CareerEvaluationSaveSchema`, `CareerEvaluationDecidirSchema` (Task 1).
- Produces: `GET /carreira/evaluations?userId=`, `POST /carreira/evaluations`, `POST /carreira/evaluations/:id/decidir` — all `@Roles('gestor')`. Consumed by Task 6 (web actions).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/carreira/evaluations.controller.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { CareerEvaluationsController } from './evaluations.controller';
import { CareerEvaluationsService } from './evaluations.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['getOpen', 'save', 'decidir'] as const;

describe('CareerEvaluationsController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      CareerEvaluationsController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      CareerEvaluationsController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('CareerEvaluationsController', () => {
  let controller: CareerEvaluationsController;
  const serviceMock = { getOpen: jest.fn(), save: jest.fn(), decidir: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CareerEvaluationsController],
      providers: [{ provide: CareerEvaluationsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(CareerEvaluationsController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return { user: { sub, role: 'gestor', name: 'Gestor Teste' } } as Request & { user: AuthenticatedUser };
  }

  it('rejects a request missing userId on getOpen', async () => {
    await expect(controller.getOpen(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('saves using evaluatorId from the session, not the body', async () => {
    serviceMock.save.mockResolvedValue({ id: 'ev-1' });
    const validPrincipios = ['clareza', 'meritocracia', 'equilibrio', 'transparencia', 'desenvolvimento'].map((p) => ({ principio: p, nota: 8 }));
    const validCompetencias = ['dominio_tecnico', 'qualidade_solucoes', 'kpis_tecnicos', 'comunicacao_postura', 'organizacao_crises', 'visao_estrategica'].map((c) => ({ competencia: c, nota: 7 }));
    await controller.save(
      { userId: 'user-1', principios: validPrincipios, competencias: validCompetencias, requisitosAtendidos: [] },
      requestAs('gestor-1'),
    );
    expect(serviceMock.save).toHaveBeenCalledWith('gestor-1', expect.objectContaining({ userId: 'user-1' }));
  });

  it('rejects an invalid body on save', async () => {
    await expect(
      controller.save({ userId: 'user-1', principios: [], competencias: [], requisitosAtendidos: [] }, requestAs('gestor-1')),
    ).rejects.toThrow();
  });

  it('rejects a missing confirmarPromocao on decidir', async () => {
    await expect(controller.decidir('ev-1', {})).rejects.toThrow();
  });

  it('decides using the id from the route param', async () => {
    serviceMock.decidir.mockResolvedValue({ id: 'ev-1', status: 'decidida' });
    await controller.decidir('ev-1', { confirmarPromocao: true });
    expect(serviceMock.decidir).toHaveBeenCalledWith('ev-1', true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec jest src/carreira/evaluations.controller.spec.ts`
Expected: FAIL — `Cannot find module './evaluations.controller'`

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/carreira/evaluations.controller.ts`:
```typescript
import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CareerEvaluationSaveSchema, CareerEvaluationDecidirSchema } from '@ponto-dcit/shared-types';
import { CareerEvaluationsService } from './evaluations.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('carreira/evaluations')
export class CareerEvaluationsController {
  constructor(private readonly evaluations: CareerEvaluationsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  async getOpen(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.evaluations.getOpen(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  async save(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = CareerEvaluationSaveSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.evaluations.save(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post(':id/decidir')
  async decidir(@Param('id') id: string, @Body() body: unknown) {
    const result = CareerEvaluationDecidirSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.evaluations.decidir(id, result.data.confirmarPromocao);
  }
}
```

Modify `apps/api/src/carreira/carreira.module.ts` — add the import lines and wire into both arrays:
```typescript
import { Module } from '@nestjs/common';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { TrackRequirementsController } from './trilha.controller';
import { TrackRequirementsService } from './trilha.service';
import { PerformanceEvaluationsController } from './avaliacoes.controller';
import { PerformanceEvaluationsService } from './avaliacoes.service';
import { CareerEvaluationsController } from './evaluations.controller';
import { CareerEvaluationsService } from './evaluations.service';
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
    CareerEvaluationsController,
    NineBoxController,
    OneOnOnesController,
    PromotabilidadeController,
  ],
  providers: [
    CareerGoalsService,
    TrackRequirementsService,
    PerformanceEvaluationsService,
    CareerEvaluationsService,
    NineBoxService,
    OneOnOnesService,
    PromotabilidadeService,
  ],
})
export class CarreiraModule {}
```

(`PerformanceEvaluationsController`/`Service` stay for now — Task 7 removes them.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec jest src/carreira/evaluations.controller.spec.ts`
Expected: PASS, all tests

- [ ] **Step 5: Run the full API test suite to check for regressions**

Run: `pnpm exec jest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/carreira/evaluations.controller.ts apps/api/src/carreira/evaluations.controller.spec.ts apps/api/src/carreira/carreira.module.ts
git commit -m "feat(api): add POST/GET /carreira/evaluations endpoints"
```

---

### Task 5: Automatic salary-step progression on goal completion

**Files:**
- Modify: `apps/api/src/carreira/metas.service.ts`
- Modify: `apps/api/src/carreira/metas.service.spec.ts`

**Interfaces:**
- Consumes: `CAREER_LADDER`, `type NivelEscada` (Task 1).
- No new exports — this only changes `CareerGoalsService.updateStatus`'s side effects.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/carreira/metas.service.spec.ts`, inside the existing `describe('CareerGoalsService', ...)` block, right before its closing `});` — and add an `afterAll` cleanup for the new employee row (extend the existing `afterAll`):

Replace the existing `afterAll` block:
```typescript
  afterAll(async () => {
    await prisma.careerGoal.deleteMany({ where: { userId: 'metas-spec-user' } });
    await prisma.onModuleDestroy();
  });
```
with:
```typescript
  afterAll(async () => {
    await prisma.careerGoal.deleteMany({ where: { userId: { in: ['metas-spec-user', 'metas-spec-salary-user'] } } });
    await prisma.employee.deleteMany({ where: { userId: 'metas-spec-salary-user' } });
    await prisma.onModuleDestroy();
  });
```

Then add these tests at the end of the `describe` block, right before its closing `});`:
```typescript
  describe('salary-step progression on goal completion', () => {
    beforeAll(async () => {
      await prisma.employee.create({
        data: {
          userId: 'metas-spec-salary-user',
          name: 'Bruno Teste',
          role: 'colaborador',
          nivel: 'pleno',
          salarioMensal: 4000,
          hireDate: new Date('2024-01-01'),
        },
      });
    });

    it('advances salarioMensal to the next fixed step when a goal is completed', async () => {
      const goal = await service.create({ userId: 'metas-spec-salary-user', tipo: 'entrega', title: 'Entrega X' });
      await service.updateStatus(goal.id, 'concluida');
      const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      expect(employee.salarioMensal).toBe(4700); // pleno's second degrau
    });

    it('does not advance again when the same goal is re-saved as concluida (idempotent)', async () => {
      const goal = await service.create({ userId: 'metas-spec-salary-user', tipo: 'pdi', title: 'PDI Y' });
      await service.updateStatus(goal.id, 'concluida');
      const afterFirst = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      await service.updateStatus(goal.id, 'concluida');
      const afterSecond = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      expect(afterSecond.salarioMensal).toBe(afterFirst.salarioMensal);
    });

    it('does not advance past the top step of the current nível', async () => {
      await prisma.employee.update({ where: { userId: 'metas-spec-salary-user' }, data: { salarioMensal: 6200 } }); // pleno's top step
      const goal = await service.create({ userId: 'metas-spec-salary-user', tipo: 'entrega', title: 'Entrega Z' });
      await service.updateStatus(goal.id, 'concluida');
      const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      expect(employee.salarioMensal).toBe(6200); // capped, no auto level-up
    });

    it('does not change salarioMensal when moving to a non-concluida status', async () => {
      await prisma.employee.update({ where: { userId: 'metas-spec-salary-user' }, data: { salarioMensal: 4000 } });
      const goal = await service.create({ userId: 'metas-spec-salary-user', tipo: 'entrega', title: 'Entrega W' });
      await service.updateStatus(goal.id, 'andamento');
      const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: 'metas-spec-salary-user' } });
      expect(employee.salarioMensal).toBe(4000);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/carreira/metas.service.spec.ts`
Expected: FAIL — `salarioMensal` stays `4000` instead of advancing to `4700` (no progression logic exists yet)

- [ ] **Step 3: Write minimal implementation**

Modify `apps/api/src/carreira/metas.service.ts` — replace the whole file:
```typescript
import { Injectable } from '@nestjs/common';
import type { CareerGoalCreateInput } from '@ponto-dcit/shared-types';
import { CAREER_LADDER, type NivelEscada } from '@ponto-dcit/shared-types';
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

  async updateStatus(id: string, status: string) {
    const previous = await this.prisma.careerGoal.findUnique({ where: { id } });
    const updated = await this.prisma.careerGoal.update({ where: { id }, data: { status } });
    if (status === 'concluida' && previous?.status !== 'concluida') {
      await this.advanceSalaryStep(updated.userId);
    }
    return updated;
  }

  private async advanceSalaryStep(userId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee?.nivel || employee.salarioMensal === null) return;

    const degraus = CAREER_LADDER[employee.nivel as NivelEscada]?.degraus;
    if (!degraus) return;

    // Índice do degrau mais alto que o colaborador já atingiu (<= salário atual).
    let currentStepIndex = -1;
    for (let i = 0; i < degraus.length; i++) {
      if (degraus[i] <= employee.salarioMensal) currentStepIndex = i;
    }
    if (currentStepIndex === -1 || currentStepIndex >= degraus.length - 1) return;

    await this.prisma.employee.update({
      where: { userId },
      data: { salarioMensal: degraus[currentStepIndex + 1] },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.careerGoal.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec jest src/carreira/metas.service.spec.ts`
Expected: PASS, all tests (including the 4 pre-existing ones)

- [ ] **Step 5: Run the full API test suite to check for regressions**

Run: `pnpm exec jest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/carreira/metas.service.ts apps/api/src/carreira/metas.service.spec.ts
git commit -m "feat(api): auto-advance salary step when a career goal is completed"
```

---

### Task 6: Web — "Avaliação de Carreira" tab

**Files:**
- Create: `apps/web/src/app/(app)/gestao-carreiras/avaliacao-carreira-section.tsx`
- Create: `apps/web/src/app/(app)/gestao-carreiras/submeter-button.tsx`
- Modify: `apps/web/src/app/(app)/gestao-carreiras/actions.ts` (append)
- Modify: `apps/web/src/app/(app)/gestao-carreiras/page.tsx`
- Modify: `apps/web/src/app/(app)/gestao-carreiras/gestao-carreiras.module.css` (append)
- Modify: `apps/web/e2e/fake-api-server.mjs` (add handlers)
- Create: `apps/web/e2e/gestao-carreiras-avaliacao.spec.ts`

**Interfaces:**
- Consumes: `POST /carreira/evaluations`, `GET /carreira/evaluations?userId=`, `POST /carreira/evaluations/:id/decidir` (Task 4), `CAREER_LADDER`, `NIVEL_LABELS`, `PRINCIPIO_KEYS`, `PRINCIPIOS`, `COMPETENCIA_KEYS`, `COMPETENCIA_LABELS`, `COMPETENCIA_CATEGORIA`, `ELEGIBILIDADE_MEDIA_MINIMA`, `type NivelEscada` (Task 1, imported directly from `@ponto-dcit/shared-types` — no duplicated local copies).
- Produces: `<AvaliacaoCarreiraSection>` component, `saveCareerEvaluation`/`decidirCareerEvaluation` server actions.

Note on UI approach: unlike the Mural post dialog (which needed a client component for a modal + live `useActionState`), this screen follows this codebase's dominant pattern — mostly server-rendered forms, re-rendered via `revalidatePath` after each save/decide. Média/badge reflect the *last saved* state, not a live-as-you-type calculation (the original ask's "calculado automaticamente" is satisfied by the gestor never having to compute the average by hand — it doesn't require instant client-side recompute before saving). The one genuine interactive requirement — confirming the promotion before it's committed — is isolated into a small client component (`SubmeterButton`), matching the existing `AcaoStatusSelect`/`ColaboradorSelect` pattern of "own Client Component for the one interactive bit."

- [ ] **Step 1: Write the failing e2e tests**

Add these two fake-server handlers to `apps/web/e2e/fake-api-server.mjs`, near the existing `["/mural/posts", "/mural/birthdays"]` GET block (exact insertion point doesn't matter — any top-level `if` block in the handler chain works):
```javascript
  if (req.method === "GET" && url.pathname === "/carreira/evaluations") {
    return sendJson(res, 200, null);
  }
  if (req.method === "POST" && url.pathname === "/carreira/evaluations") {
    return sendJson(res, 201, { id: "generated-evaluation-id", ...body });
  }
  if (req.method === "POST" && /^\/carreira\/evaluations\/[^/]+\/decidir$/.test(url.pathname)) {
    return sendJson(res, 200, { id: "generated-evaluation-id", status: "decidida", ...body });
  }
```

Create `apps/web/e2e/gestao-carreiras-avaliacao.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi, seedResponse, getRecordedRequests } from "./test-session";

const EMPLOYEES = [
  { userId: "colab-1", name: "Ana Colaboradora", nivel: "pleno", cargo: "desenvolvedor", salarioMensal: 4700 },
];

test("shows the header summary card and the requisitos checklist for the próximo nível", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 14, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  await expect(page.getByText("Analista Pleno")).toBeVisible();
  await expect(page.getByText("14 meses")).toBeVisible();
  await expect(page.getByText("Analista Sênior", { exact: false })).toBeVisible();
  await expect(page.getByText("3 anos ou mais como Pleno, com graduação completa")).toBeVisible();
  await expect(page.getByText("Habilidade comercial e insights de upsell")).toBeVisible();
});

test("shows a nível máximo notice instead of a checklist for an especialista", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, {
    method: "GET",
    path: "/employees",
    response: [{ userId: "colab-1", name: "Ana Colaboradora", nivel: "especialista", cargo: "devops", salarioMensal: 9200 }],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 40, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  await expect(page.getByText("Nível máximo atingido")).toBeVisible();
});

test("saves an evaluation with the entered scores and requisitos", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 14, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  for (const key of ["clareza", "meritocracia", "equilibrio", "transparencia", "desenvolvimento"]) {
    await page.locator(`input[name="nota-${key}"]`).fill("8");
  }
  for (const key of [
    "dominio_tecnico",
    "qualidade_solucoes",
    "kpis_tecnicos",
    "comunicacao_postura",
    "organizacao_crises",
    "visao_estrategica",
  ]) {
    await page.locator(`input[name="nota-${key}"]`).fill("7");
  }
  await page.getByRole("checkbox", { name: "3 anos ou mais como Pleno, com graduação completa" }).check();
  await page.getByRole("button", { name: "Salvar Avaliação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/carreira/evaluations")?.body;
    })
    .toMatchObject({
      userId: "colab-1",
      requisitosAtendidos: ["3 anos ou mais como Pleno, com graduação completa"],
    });
});

test("shows the Elegível badge and confirms before promoting when eligible", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 14, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/evaluations",
    response: {
      id: "ev-existing",
      mediaGeral: 8.5,
      proximoNivel: "senior",
      principios: [],
      competencias: [],
      requisitos: [
        { tipo: "obrigatorio", label: "3 anos ou mais como Pleno, com graduação completa", atendido: true },
        { tipo: "obrigatorio", label: "Especialização desejável e no mínimo 3 certificações", atendido: true },
        { tipo: "obrigatorio", label: "Soft skills consolidadas e referência técnica", atendido: true },
      ],
    },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  await expect(page.getByText("Elegível para Promoção")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submeter para Decisão da Diretoria" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/carreira/evaluations/ev-existing/decidir")?.body;
    })
    .toEqual({ confirmarPromocao: true });
});

test("cancelling the confirm dialog does not submit the decision", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "amarelo", mesesDeCasa: 14, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: true, ultimaMediaAvaliacao: null },
  });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/evaluations",
    response: {
      id: "ev-existing",
      mediaGeral: 8.5,
      proximoNivel: "senior",
      principios: [],
      competencias: [],
      requisitos: [
        { tipo: "obrigatorio", label: "3 anos ou mais como Pleno, com graduação completa", atendido: true },
        { tipo: "obrigatorio", label: "Especialização desejável e no mínimo 3 certificações", atendido: true },
        { tipo: "obrigatorio", label: "Soft skills consolidadas e referência técnica", atendido: true },
      ],
    },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Submeter para Decisão da Diretoria" }).click();

  const recorded = await getRecordedRequests(request);
  expect(recorded.some((r) => r.method === "POST" && r.path.includes("/decidir"))).toBe(false);
});

test("hides the Submeter button when no evaluation has been saved yet", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request);
  await seedResponse(request, { method: "GET", path: "/employees", response: EMPLOYEES });
  await seedResponse(request, {
    method: "GET",
    path: "/carreira/promotabilidade/colab-1",
    response: { status: "branco", mesesDeCasa: 1, requisitosPendentes: 0, metasPendentes: 0, metasPdiRegistradas: false, ultimaMediaAvaliacao: null },
  });

  await page.goto("/gestao-carreiras?aba=avaliacao-carreira&userId=colab-1");

  await expect(page.getByRole("button", { name: "Submeter para Decisão da Diretoria" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Agendar Reunião de 1:1" })).toBeVisible();
});
```

- [ ] **Step 2: Run e2e tests to verify they fail**

Run (from `apps/web`): `NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm exec playwright test e2e/gestao-carreiras-avaliacao.spec.ts --reporter=list`
(If port 3000 is occupied by a locally running `apps/api` dev server, stop it first — Windows: `netstat -ano | findstr :3000` then `Stop-Process -Id <pid> -Force` — and restart it after this task's final verification.)
Expected: all 6 tests FAIL (the tab/component doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/app/(app)/gestao-carreiras/submeter-button.tsx`:
```tsx
"use client";

import { decidirCareerEvaluation } from "./actions";
import styles from "./gestao-carreiras.module.css";

// Own Client Component for the one interactive bit this screen needs — same
// reasoning as ColaboradorSelect/AcaoStatusSelect: everything else here is a
// plain server-rendered form, but confirming a promotion before it's
// committed needs a client-side confirm() gate in front of the submit.
export function SubmeterButton({
  evaluationId,
  elegivel,
  proximoNivelLabel,
  colaboradorNome,
}: {
  evaluationId: string;
  elegivel: boolean;
  proximoNivelLabel: string | null;
  colaboradorNome: string;
}) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (elegivel && proximoNivelLabel) {
      const confirmado = window.confirm(`Confirmar promoção de ${colaboradorNome} para ${proximoNivelLabel}?`);
      if (!confirmado) {
        event.preventDefault();
      }
    }
  }

  return (
    <form action={decidirCareerEvaluation} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={evaluationId} />
      <input type="hidden" name="confirmarPromocao" value={elegivel ? "true" : "false"} />
      <button type="submit" className={styles.saveButton}>
        Submeter para Decisão da Diretoria
      </button>
    </form>
  );
}
```

Create `apps/web/src/app/(app)/gestao-carreiras/avaliacao-carreira-section.tsx`:
```tsx
import {
  CAREER_LADDER,
  COMPETENCIA_CATEGORIA,
  COMPETENCIA_KEYS,
  COMPETENCIA_LABELS,
  ELEGIBILIDADE_MEDIA_MINIMA,
  PRINCIPIO_KEYS,
  PRINCIPIOS,
  type NivelEscada,
} from "@ponto-dcit/shared-types";

import { saveCareerEvaluation } from "./actions";
import styles from "./gestao-carreiras.module.css";
import { SubmeterButton } from "./submeter-button";

type PrincipioScore = { principio: string; nota: number; justificativa: string | null };
type CompetenciaScore = { competencia: string; nota: number };
type RequisitoCheck = { tipo: "obrigatorio" | "eletivo"; label: string; atendido: boolean };
type OpenEvaluation = {
  id: string;
  mediaGeral: number | null;
  proximoNivel: string | null;
  principios: PrincipioScore[];
  competencias: CompetenciaScore[];
  requisitos: RequisitoCheck[];
};

export function AvaliacaoCarreiraSection({
  userId,
  colaboradorNome,
  nivel,
  salarioMensal,
  mesesDeCasa,
  evaluation,
}: {
  userId: string;
  colaboradorNome: string;
  nivel: string | null;
  salarioMensal: number | null;
  mesesDeCasa: number;
  evaluation: OpenEvaluation | null;
}) {
  const nivelEscada = (nivel ?? "junior") as NivelEscada;
  const nivelInfo = CAREER_LADDER[nivelEscada];
  const proximoNivel = nivelInfo.proximoNivel;
  const proximoNivelInfo = proximoNivel ? CAREER_LADDER[proximoNivel] : null;

  const notaPorPrincipio = new Map(evaluation?.principios.map((p) => [p.principio, p]) ?? []);
  const notaPorCompetencia = new Map(evaluation?.competencias.map((c) => [c.competencia, c.nota]) ?? []);
  const requisitosAtendidos = new Set(evaluation?.requisitos.filter((r) => r.atendido).map((r) => r.label) ?? []);

  const obrigatoriosOk =
    proximoNivelInfo !== null &&
    proximoNivelInfo.requisitos.filter((r) => r.tipo === "obrigatorio").every((r) => requisitosAtendidos.has(r.label));
  const mediaOk = (evaluation?.mediaGeral ?? 0) >= ELEGIBILIDADE_MEDIA_MINIMA;
  const elegivel = evaluation !== null && proximoNivel !== null && obrigatoriosOk && mediaOk;

  function faixaLabel(degraus: number[]): string {
    return `R$ ${degraus[0].toLocaleString("pt-BR")} – R$ ${degraus[degraus.length - 1].toLocaleString("pt-BR")}`;
  }

  return (
    <div className={styles.section}>
      <div className={styles.summaryCard}>
        <div>
          <strong>Cargo Atual</strong>
          <p>{nivelInfo.label}</p>
        </div>
        <div>
          <strong>Tempo de Casa</strong>
          <p>
            {mesesDeCasa} {mesesDeCasa === 1 ? "mês" : "meses"}
          </p>
        </div>
        <div>
          <strong>Faixa Salarial Atual</strong>
          <p>
            {faixaLabel(nivelInfo.degraus)}
            {salarioMensal !== null ? ` (atual: R$ ${salarioMensal.toLocaleString("pt-BR")})` : ""}
          </p>
        </div>
        <div>
          <strong>Próximo Nível</strong>
          <p>{proximoNivelInfo ? `${proximoNivelInfo.label} (${faixaLabel(proximoNivelInfo.degraus)})` : "Nível máximo atingido"}</p>
        </div>
      </div>

      <form action={saveCareerEvaluation} className={styles.evaluationForm}>
        <input type="hidden" name="userId" value={userId} />

        <h2>5 Princípios Essenciais</h2>
        {PRINCIPIO_KEYS.map((key) => {
          const info = PRINCIPIOS[key];
          const current = notaPorPrincipio.get(key);
          return (
            <div key={key} className={styles.scoreBlock}>
              <label>
                <strong>{info.label}</strong> — {info.descricao}
                <input
                  type="number"
                  name={`nota-${key}`}
                  min={0}
                  max={10}
                  required
                  defaultValue={current?.nota ?? ""}
                  className={styles.input}
                />
              </label>
              <input
                type="text"
                name={`justificativa-${key}`}
                placeholder="Observações/Justificativa"
                defaultValue={current?.justificativa ?? ""}
                className={styles.input}
              />
            </div>
          );
        })}

        <h2>Competências</h2>
        <h3>Hard Skills</h3>
        {COMPETENCIA_KEYS.filter((key) => COMPETENCIA_CATEGORIA[key] === "hard").map((key) => (
          <label key={key} className={styles.scoreBlock}>
            {COMPETENCIA_LABELS[key]}
            <input
              type="number"
              name={`nota-${key}`}
              min={0}
              max={10}
              required
              defaultValue={notaPorCompetencia.get(key) ?? ""}
              className={styles.input}
            />
          </label>
        ))}
        <h3>Soft Skills</h3>
        {COMPETENCIA_KEYS.filter((key) => COMPETENCIA_CATEGORIA[key] === "soft").map((key) => (
          <label key={key} className={styles.scoreBlock}>
            {COMPETENCIA_LABELS[key]}
            <input
              type="number"
              name={`nota-${key}`}
              min={0}
              max={10}
              required
              defaultValue={notaPorCompetencia.get(key) ?? ""}
              className={styles.input}
            />
          </label>
        ))}

        {proximoNivelInfo ? (
          <>
            <h2>Checklist de Requisitos para {proximoNivelInfo.label}</h2>
            <h3>Obrigatórios</h3>
            {proximoNivelInfo.requisitos
              .filter((r) => r.tipo === "obrigatorio")
              .map((r) => (
                <label key={r.label} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    name="requisitosAtendidos"
                    value={r.label}
                    defaultChecked={requisitosAtendidos.has(r.label)}
                  />
                  {r.label}
                </label>
              ))}
            {proximoNivelInfo.requisitos.some((r) => r.tipo === "eletivo") ? (
              <>
                <h3>Eletivos</h3>
                {proximoNivelInfo.requisitos
                  .filter((r) => r.tipo === "eletivo")
                  .map((r) => (
                    <label key={r.label} className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        name="requisitosAtendidos"
                        value={r.label}
                        defaultChecked={requisitosAtendidos.has(r.label)}
                      />
                      {r.label}
                    </label>
                  ))}
              </>
            ) : null}
          </>
        ) : (
          <p className={styles.empty}>Nível máximo atingido — não há próximo nível na escada.</p>
        )}

        <button type="submit" className={styles.saveButton}>
          Salvar Avaliação
        </button>
      </form>

      <div className={styles.finalPanel}>
        <h2>Painel Final</h2>
        <p>Média Geral: {evaluation?.mediaGeral != null ? evaluation.mediaGeral.toFixed(1) : "—"} / 10</p>
        <p className={elegivel ? styles.badgeElegivel : styles.badgeDesenvolvimento}>
          {proximoNivel === null ? "Nível Máximo Atingido" : elegivel ? "Elegível para Promoção" : "Em Desenvolvimento"}
        </p>
        <div className={styles.actions}>
          {evaluation ? (
            <SubmeterButton
              evaluationId={evaluation.id}
              elegivel={elegivel}
              proximoNivelLabel={proximoNivelInfo?.label ?? null}
              colaboradorNome={colaboradorNome}
            />
          ) : null}
          <a href={`/gestao-carreiras?aba=avaliacoes&sub=1a1&userId=${userId}`} className={styles.linkButton}>
            Agendar Reunião de 1:1
          </a>
        </div>
      </div>
    </div>
  );
}
```

Modify the top of `apps/web/src/app/(app)/gestao-carreiras/actions.ts` — add one import line right after the existing `import { apiFetch } from "@/lib/api";` line:
```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";
import {
  COMPETENCIA_KEYS,
  PRINCIPIO_KEYS,
  type CompetenciaKey,
  type PrincipioKey,
} from "@ponto-dcit/shared-types";
```

Then append the following to the end of the file (after the existing `updateOneOnOneAcaoStatus` function):
```typescript
function parseNota10(value: FormDataEntryValue | null): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
    throw new Error("Notas devem ser de 0 a 10.");
  }
  return parsed;
}

function readOptionalText(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export async function saveCareerEvaluation(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("userId é obrigatório.");
  }
  const principios = (PRINCIPIO_KEYS as readonly PrincipioKey[]).map((key) => ({
    principio: key,
    nota: parseNota10(formData.get(`nota-${key}`)),
    justificativa: readOptionalText(formData.get(`justificativa-${key}`)),
  }));
  const competencias = (COMPETENCIA_KEYS as readonly CompetenciaKey[]).map((key) => ({
    competencia: key,
    nota: parseNota10(formData.get(`nota-${key}`)),
  }));
  const requisitosAtendidos = formData
    .getAll("requisitosAtendidos")
    .filter((value): value is string => typeof value === "string");

  const res = await apiFetch("/carreira/evaluations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, principios, competencias, requisitosAtendidos }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/evaluations responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}

export async function decidirCareerEvaluation(formData: FormData) {
  const id = formData.get("id");
  const confirmarPromocao = formData.get("confirmarPromocao") === "true";
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Requisição inválida.");
  }
  const res = await apiFetch(`/carreira/evaluations/${id}/decidir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmarPromocao }),
  });
  if (!res.ok) {
    throw new Error(`/carreira/evaluations/${id}/decidir responded with ${res.status}`);
  }
  revalidatePath("/gestao-carreiras");
}
```

Modify `apps/web/src/app/(app)/gestao-carreiras/page.tsx`:

1. Add the import:
```typescript
import { AvaliacaoCarreiraSection } from "./avaliacao-carreira-section";
```

2. Broaden the `Employee` type and update `TABS`/`ABA_TITLES`:
```typescript
type Employee = { userId: string; name: string; nivel: string | null; salarioMensal: number | null };
type CareerGoal = { id: string; tipo: "pdi" | "entrega"; title: string; status: "pendente" | "andamento" | "concluida" };

const TABS = [
  { value: "pdi", label: "PDI & Metas" },
  { value: "trilha", label: "Trilha de Carreira" },
  { value: "avaliacao-carreira", label: "Avaliação de Carreira" },
  { value: "avaliacoes", label: "Avaliações de Desempenho" },
] as const;

const ABA_TITLES: Record<string, string> = {
  pdi: "PDI & Metas",
  trilha: "Matriz de Promoção / Trilhas de Carreira",
  "avaliacao-carreira": "Avaliação de Carreira",
  avaliacoes: "Avaliações de Desempenho",
};
```

3. Add the new tab's render line, alongside the existing ones:
```tsx
{aba === "avaliacao-carreira" ? <AvaliacaoCarreiraTab userId={userId} employees={employees} /> : null}
```

4. Add the new tab function, alongside `TrilhaTab`/`AvaliacoesTab`:
```typescript
async function AvaliacaoCarreiraTab({ userId, employees }: { userId: string; employees: Employee[] }) {
  const colaborador = employees.find((e) => e.userId === userId);
  const [promotabilidade, evaluation] = await Promise.all([
    apiFetchJson<{ mesesDeCasa: number }>(`/carreira/promotabilidade/${userId}`),
    apiFetchJson<{
      id: string;
      mediaGeral: number | null;
      proximoNivel: string | null;
      principios: { principio: string; nota: number; justificativa: string | null }[];
      competencias: { competencia: string; nota: number }[];
      requisitos: { tipo: "obrigatorio" | "eletivo"; label: string; atendido: boolean }[];
    } | null>(`/carreira/evaluations?userId=${userId}`),
  ]);
  return (
    <AvaliacaoCarreiraSection
      userId={userId}
      colaboradorNome={colaborador?.name ?? ""}
      nivel={colaborador?.nivel ?? null}
      salarioMensal={colaborador?.salarioMensal ?? null}
      mesesDeCasa={promotabilidade.mesesDeCasa}
      evaluation={evaluation}
    />
  );
}
```

Append to `apps/web/src/app/(app)/gestao-carreiras/gestao-carreiras.module.css`:
```css
.summaryCard {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  background: var(--color-background-element);
}

.evaluationForm {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.scoreBlock {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.checkboxRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
}

.finalPanel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 8px;
  background: var(--color-background-element);
}

.badgeElegivel {
  font-weight: 600;
  color: var(--color-text);
}

.badgeDesenvolvimento {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.saveButton {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-background);
  background: var(--color-text);
  cursor: pointer;
}

.saveButton:hover {
  opacity: 0.85;
}

.linkButton {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  padding: 8px 16px;
  border: 1px solid var(--color-background-selected);
  border-radius: 8px;
}

.linkButton:hover {
  background: var(--color-background-selected);
}
```

- [ ] **Step 4: Run e2e tests to verify they pass**

Run: `NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm exec playwright test e2e/gestao-carreiras-avaliacao.spec.ts --reporter=list`
Expected: PASS, all 6 tests

- [ ] **Step 5: Type-check and lint**

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: no errors
Run: `pnpm exec eslint "src/app/(app)/gestao-carreiras/"`
Expected: no errors

- [ ] **Step 6: Run the full web e2e suite to check for regressions**

Run: `NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm exec playwright test --reporter=list`
Expected: PASS, except the pre-existing, unrelated failures already present on `master` before this plan (same list noted in the Mural feature's plan: `auth.spec.ts` SSO test, two `esqueci-senha.spec.ts` tests, `login.spec.ts` wrong-credentials test, an intermittently-flaky `search.spec.ts` Ctrl+K test) — if any *other* test fails, investigate before committing. Once done, restart the live `apps/api` dev server if you stopped it in Step 2.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(app\)/gestao-carreiras/avaliacao-carreira-section.tsx apps/web/src/app/\(app\)/gestao-carreiras/submeter-button.tsx apps/web/src/app/\(app\)/gestao-carreiras/actions.ts apps/web/src/app/\(app\)/gestao-carreiras/page.tsx apps/web/src/app/\(app\)/gestao-carreiras/gestao-carreiras.module.css apps/web/e2e/fake-api-server.mjs apps/web/e2e/gestao-carreiras-avaliacao.spec.ts
git commit -m "feat(web): add the Avaliação de Carreira tab to Gestão de Carreiras"
```

---

### Task 7: Retire the "Ciclos" evaluation

**Files:**
- Delete: `apps/api/src/carreira/avaliacoes.controller.ts`, `apps/api/src/carreira/avaliacoes.service.ts`, `apps/api/src/carreira/avaliacoes.controller.spec.ts`, `apps/api/src/carreira/avaliacoes.service.spec.ts`
- Modify: `apps/api/src/carreira/carreira.module.ts`
- Modify: `packages/shared-types/src/carreira.ts`
- Modify: `packages/shared-types/src/index.ts`
- Modify: `apps/web/src/app/(app)/gestao-carreiras/avaliacoes-section.tsx`
- Modify: `apps/web/src/app/(app)/gestao-carreiras/actions.ts`
- Modify: `apps/web/src/app/(app)/gestao-carreiras/page.tsx`

**Interfaces:** None — this task only removes now-superseded code. `PerformanceEvaluation` the Prisma model itself is untouched (historical rows, if any, stay in the DB; `promotabilidade.service.ts` keeps reading it unmodified — a known, documented, out-of-scope impact per the design spec §9).

This task has no new tests of its own — it's proven correct by the *existing* suites (API + e2e) continuing to pass with the dead code gone, plus one adjustment to an existing e2e assertion.

- [ ] **Step 1: Delete the backend Ciclos files**

```bash
git rm apps/api/src/carreira/avaliacoes.controller.ts apps/api/src/carreira/avaliacoes.service.ts apps/api/src/carreira/avaliacoes.controller.spec.ts apps/api/src/carreira/avaliacoes.service.spec.ts
```

- [ ] **Step 2: Remove it from the module**

Modify `apps/api/src/carreira/carreira.module.ts` — remove the `PerformanceEvaluationsController`/`PerformanceEvaluationsService` import lines and their entries in the `controllers`/`providers` arrays. Resulting file:
```typescript
import { Module } from '@nestjs/common';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { TrackRequirementsController } from './trilha.controller';
import { TrackRequirementsService } from './trilha.service';
import { CareerEvaluationsController } from './evaluations.controller';
import { CareerEvaluationsService } from './evaluations.service';
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
    CareerEvaluationsController,
    NineBoxController,
    OneOnOnesController,
    PromotabilidadeController,
  ],
  providers: [
    CareerGoalsService,
    TrackRequirementsService,
    CareerEvaluationsService,
    NineBoxService,
    OneOnOnesService,
    PromotabilidadeService,
  ],
})
export class CarreiraModule {}
```

- [ ] **Step 3: Remove the now-unused schema from shared-types**

Modify `packages/shared-types/src/carreira.ts` — remove the `PerformanceEvaluationCreateSchema`/`PerformanceEvaluationCreateInput` block (the 9 lines starting with `export const PerformanceEvaluationCreateSchema = z.object({`).

Modify `packages/shared-types/src/index.ts` — remove `PerformanceEvaluationCreateSchema` from the first `carreira` export block and `PerformanceEvaluationCreateInput` from the second (`export type { ... }`) block, leaving:
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
  NineBoxPlacementCreateSchema,
  OneOnOneCreateSchema,
  OneOnOneAcaoUpdateSchema,
} from "./carreira";
export type {
  CareerGoalCreateInput,
  CareerGoalUpdateInput,
  TrackRequirementCreateInput,
  TrackRequirementUpdateInput,
  NineBoxPlacementCreateInput,
  OneOnOneCreateInput,
  OneOnOneAcaoUpdateInput,
} from "./carreira";
```

Rebuild the package (same reasoning as Task 1 Step 5 — `apps/api` resolves `@ponto-dcit/shared-types` via its built `dist/`):
Run (from `packages/shared-types`): `pnpm run build`

- [ ] **Step 4: Run the full API test suite to check for regressions**

Run (from `apps/api`): `pnpm exec jest`
Expected: PASS — no remaining file imports `avaliacoes.controller`/`avaliacoes.service`/`PerformanceEvaluationCreateSchema`.

- [ ] **Step 5: Remove the Ciclos sub-tab from the web UI**

Modify `apps/web/src/app/(app)/gestao-carreiras/avaliacoes-section.tsx`:
1. Remove the `createEvaluation` import (keep `createNineBoxPlacement, createOneOnOne, updateOneOnOneAcaoStatus`).
2. Remove the `Evaluation` type.
3. Remove `evaluations: Evaluation[]` from `AvaliacoesSection`'s props type and destructuring.
4. Remove `{ value: "ciclos", label: "Ciclos de Avaliação" },` from `SUB_TABS`.
5. Remove the `{sub === "ciclos" ? <CiclosSubSection userId={userId} evaluations={evaluations} /> : null}` line.
6. Delete the entire `CiclosSubSection` function.

Resulting top of the file:
```tsx
import { AcaoStatusSelect } from "./acao-status-select";
import { createNineBoxPlacement, createOneOnOne, updateOneOnOneAcaoStatus } from "./actions";
import styles from "./gestao-carreiras.module.css";

type NineBoxPlacement = { id: string; date: string; desempenho: string; potencial: string };
type OneOnOne = {
  id: string;
  date: string;
  pauta: string;
  proximaData: string | null;
  acoes: { id: string; descricao: string; status: "pendente" | "concluido" }[];
};

const SUB_TABS = [
  { value: "1a1", label: "Registros de 1:1" },
  { value: "ninebox", label: "Matriz Nine Box" },
] as const;

export function AvaliacoesSection({
  userId,
  sub,
  placements,
  oneOnOnes,
}: {
  userId: string;
  sub: string;
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

      {sub === "1a1" ? <OneOnOneSubSection userId={userId} oneOnOnes={oneOnOnes} /> : null}
      {sub === "ninebox" ? <NineBoxSubSection userId={userId} placements={placements} /> : null}
    </div>
  );
}
```
(The `OneOnOneSubSection`, `NineBoxSubSection`, and everything below them stay exactly as they are — only the `CiclosSubSection` function and the pieces listed above are removed.)

- [ ] **Step 6: Remove the createEvaluation action**

Modify `apps/web/src/app/(app)/gestao-carreiras/actions.ts` — remove the `parseScore` helper function and the `createEvaluation` function (both were only used by `CiclosSubSection`). Leave every other action untouched.

- [ ] **Step 7: Update page.tsx's Avaliações tab wiring**

Modify `apps/web/src/app/(app)/gestao-carreiras/page.tsx`:
1. Remove the `CareerGoal` — no change needed there (unrelated); only touch the Avaliações-tab pieces.
2. Change the default `sub` for the `avaliacoes` aba from `"ciclos"` to `"1a1"`:
```tsx
{aba === "avaliacoes" ? (
  <AvaliacoesTab userId={userId} sub={typeof params.sub === "string" ? params.sub : "1a1"} />
) : null}
```
3. Replace the `AvaliacoesTab` function — remove the `evaluations` fetch and its type, stop passing `evaluations` to `<AvaliacoesSection>`:
```typescript
async function AvaliacoesTab({ userId, sub }: { userId: string; sub: string }) {
  const [placements, oneOnOnes] = await Promise.all([
    apiFetchJson<{ id: string; date: string; desempenho: string; potencial: string }[]>(`/carreira/nine-box?userId=${userId}`),
    apiFetchJson<
      { id: string; date: string; pauta: string; proximaData: string | null; acoes: { id: string; descricao: string; status: "pendente" | "concluido" }[] }[]
    >(`/carreira/one-on-ones?userId=${userId}`),
  ]);
  return <AvaliacoesSection userId={userId} sub={sub} placements={placements} oneOnOnes={oneOnOnes} />;
}
```

- [ ] **Step 8: Run the full web e2e suite to check for regressions**

Run (from `apps/web`, stopping/restarting the live API dev server around this as in prior tasks): `NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm exec playwright test --reporter=list`
Expected: PASS, same known pre-existing failures as Task 6 Step 6 — no *new* failures. If any e2e spec asserted on the "Ciclos de Avaliação" sub-tab or its form (search `grep -r "ciclos\|Ciclos" apps/web/e2e/` before this step to find out), update or remove that assertion the same way `empty-state-pages.spec.ts` was adjusted for a forced-by-the-diff regression in the Mural feature's plan — a genuine, minimal, documented fix, not scope creep.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: retire the Ciclos evaluation, superseded by the new career evaluation"
```

