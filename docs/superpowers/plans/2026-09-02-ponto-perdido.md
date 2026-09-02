# Detecção Automática de Ponto Perdido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily cron job that scans the previous São Paulo day for forgotten clock-outs and unexplained absences, notifying the employee and broadcasting to every gestor/rh via the existing notification inbox/push infrastructure.

**Architecture:** `NotificationsService` gains a new producer method, `sendPontoPerdido`, mirroring the existing `sendPagamento` shape (creates `Notification` rows via `createManyAndReturn`, fires push with the established `void Promise.all(...)` fire-and-forget convention) but fanning out to two recipient groups: the flagged employee and every active `gestor`/`rh` employee (minus the flagged employee, in case they're also a manager). A new `PontoPerdidoModule`/`PontoPerdidoService`, scheduled via a new `@nestjs/schedule` dependency, scans yesterday's `TimeEntry` rows per active employee: an odd punch count means a forgotten clock-out, a zero count with no approved vacation/atestado covering the day (and not a weekend) means an unexplained absence. The scan logic lives in a `run(now: Date)` method separate from the `@Cron` handler so it's testable with a fixed date, never the real clock.

**Tech Stack:** NestJS 11 + Prisma (SQLite) on `apps/api`. New dependency: `@nestjs/schedule`.

**Spec:** [`docs/superpowers/specs/2026-09-02-ponto-perdido-design.md`](../specs/2026-09-02-ponto-perdido-design.md)

## Global Constraints

- Zero Prisma schema changes — `Notification`, `Employee`, `TimeEntry`, `VacationRequest`, `Atestado` already have every field needed. `type: 'ponto_perdido'` and `category: 'saida_esquecida' | 'ausencia'` are just new values in the already-generic `String`/`String?` columns.
- Zero `packages/shared-types` changes — no new HTTP endpoint, so no new Zod schema to validate external input.
- `sendPontoPerdido` must dispatch push with `void Promise.all(...)`, never `await` — the established convention across every push producer in this codebase (`atestados.service.ts`, `alertas.service.ts`, `solicitacoes.service.ts`, `operacional.service.ts`, and `sendPagamento` since the previous sub-project's final-review fix), and awaiting was a real bug caught there.
- The employee who triggers a notification and is also `gestor`/`rh` gets only their personal copy — never the broadcast copy of their own case.
- `PontoPerdidoService.run(now: Date)` must stay separate from the `@Cron`-decorated handler, so tests call it with a fixed date and never depend on mocking the system clock.
- The whole `run` scan is best-effort: a failure partway through (e.g. Prisma unavailable) must be caught and logged, never thrown — it must never crash the process or block the next day's scheduled run.
- No new screens in `apps/web` or `apps/mobile` — this producer is consumed entirely by the notification bell/inbox already built.

---

### Task 1: `NotificationsService.sendPontoPerdido` + `formatDateOnlyBR`

**Files:**
- Modify: `apps/api/src/common/sao-paulo-time.ts`
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Modify: `apps/api/src/notifications/notifications.module.ts`
- Test: `apps/api/src/common/sao-paulo-time.spec.ts`
- Test: `apps/api/src/notifications/notifications.service.spec.ts`

**Interfaces:**
- Produces: `formatDateOnlyBR(dateOnly: string): string` (`apps/api/src/common/sao-paulo-time.ts`) — converts `"YYYY-MM-DD"` to `"DD/MM/AAAA"`.
- Produces: `PontoPerdidoTipo = 'saida_esquecida' | 'ausencia'` and `NotificationsService.sendPontoPerdido(tipo: PontoPerdidoTipo, employeeUserId: string, employeeName: string, dateOnly: string): Promise<void>` (`apps/api/src/notifications/notifications.service.ts`).
- Produces: `NotificationsModule` now `exports: [NotificationsService]` — Task 2's `PontoPerdidoModule` depends on this to inject `NotificationsService`.

- [ ] **Step 1: Write the failing test — `formatDateOnlyBR`**

Add to `apps/api/src/common/sao-paulo-time.spec.ts`, importing `formatDateOnlyBR` alongside the existing imports, and a new `describe` block:

```typescript
  describe('formatDateOnlyBR', () => {
    it('converts YYYY-MM-DD to DD/MM/AAAA', () => {
      expect(formatDateOnlyBR('2026-09-01')).toBe('01/09/2026');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest common/sao-paulo-time.spec.ts -t "formatDateOnlyBR" --silent=false`
Expected: FAIL — `formatDateOnlyBR` is not exported yet (import error / undefined).

- [ ] **Step 3: Implement `formatDateOnlyBR`**

Add to `apps/api/src/common/sao-paulo-time.ts`, at the end of the file:

```typescript
// "YYYY-MM-DD" -> "DD/MM/AAAA", pra mensagens voltadas a humano. Entrada já é
// date-only (sem componente de hora) — sem necessidade de re-resolver fuso.
export function formatDateOnlyBR(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest common/sao-paulo-time.spec.ts --silent=false`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Write the failing test — `sendPontoPerdido`**

In `apps/api/src/notifications/notifications.service.spec.ts`, add `formatDateOnlyBR`-adjacent imports are not needed (the service imports it internally). Add a new `describe('sendPontoPerdido', ...)` block after the existing `describe('sendPagamento', ...)` block, with its own scoped Employee fixture cleanup (the file's top-level `afterEach` only clears `notification`, never `employee` — this file has had no `employee` fixtures until now):

```typescript
  describe('sendPontoPerdido', () => {
    afterEach(async () => {
      await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-ponto-perdido-' } } });
    });

    it('notifies the employee and every active gestor/rh, excluding the employee themself', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-colaborador',
          name: 'Carla Colaboradora',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-gestor',
          name: 'Gustavo Gestor',
          role: 'gestor',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-rh',
          name: 'Rita RH',
          role: 'rh',
          hireDate: new Date('2024-01-01'),
        },
      });
      // Deleted (inactive) gestor must never receive a broadcast copy.
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-gestor-inativo',
          name: 'Gustavo Inativo',
          role: 'gestor',
          hireDate: new Date('2024-01-01'),
          deletedAt: new Date('2026-01-01'),
        },
      });

      await service.sendPontoPerdido(
        'saida_esquecida',
        'user-ponto-perdido-colaborador',
        'Carla Colaboradora',
        '2026-09-01',
      );

      const notifications = await prisma.notification.findMany({
        where: { type: 'ponto_perdido' },
        orderBy: { userId: 'asc' },
      });
      expect(notifications).toHaveLength(3);
      expect(notifications.map((n) => n.userId).sort()).toEqual(
        [
          'user-ponto-perdido-colaborador',
          'user-ponto-perdido-gestor',
          'user-ponto-perdido-rh',
        ].sort(),
      );

      const colaboradorNotif = notifications.find(
        (n) => n.userId === 'user-ponto-perdido-colaborador',
      )!;
      expect(colaboradorNotif).toMatchObject({
        type: 'ponto_perdido',
        category: 'saida_esquecida',
        message: 'Você esqueceu de bater o ponto de saída em 01/09/2026.',
        link: '/historico',
      });

      const gestorNotif = notifications.find(
        (n) => n.userId === 'user-ponto-perdido-gestor',
      )!;
      expect(gestorNotif).toMatchObject({
        type: 'ponto_perdido',
        category: 'saida_esquecida',
        message: 'Carla Colaboradora esqueceu de bater o ponto de saída em 01/09/2026.',
        link: null,
      });

      expect(sendToUser).toHaveBeenCalledTimes(3);
      expect(sendToUser).toHaveBeenCalledWith(
        'user-ponto-perdido-colaborador',
        expect.objectContaining({
          title: 'Ponto DCIT',
          data: expect.objectContaining({ notificationId: colaboradorNotif.id, link: '/historico' }),
        }),
      );
    });

    it("excludes the flagged employee's own broadcast copy when they are also a gestor", async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-ponto-perdido-gestor-faltoso',
          name: 'Gilberto Gestor',
          role: 'gestor',
          hireDate: new Date('2024-01-01'),
        },
      });

      await service.sendPontoPerdido(
        'ausencia',
        'user-ponto-perdido-gestor-faltoso',
        'Gilberto Gestor',
        '2026-09-01',
      );

      const notifications = await prisma.notification.findMany({
        where: { type: 'ponto_perdido' },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        userId: 'user-ponto-perdido-gestor-faltoso',
        message: 'Não identificamos nenhum ponto registrado em 01/09/2026.',
        link: '/historico',
      });
    });
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && npx jest notifications/notifications.service.spec.ts -t "sendPontoPerdido" --silent=false`
Expected: FAIL — `service.sendPontoPerdido` is not a function yet.

- [ ] **Step 7: Implement `sendPontoPerdido`**

In `apps/api/src/notifications/notifications.service.ts`, add the import and the new type/constants/method (leave `PAGAMENTO_MESSAGE`, `sendPagamento`, `pagamentoStatus`, `listMine`, `markRead` exactly as they are):

```typescript
import { formatDateOnlyBR } from '../common/sao-paulo-time';
```

```typescript
export type PontoPerdidoTipo = 'saida_esquecida' | 'ausencia';

const PONTO_PERDIDO_MESSAGE_COLABORADOR: Record<PontoPerdidoTipo, (dateBR: string) => string> = {
  saida_esquecida: (dateBR) => `Você esqueceu de bater o ponto de saída em ${dateBR}.`,
  ausencia: (dateBR) => `Não identificamos nenhum ponto registrado em ${dateBR}.`,
};

const PONTO_PERDIDO_MESSAGE_GESTOR: Record<PontoPerdidoTipo, (name: string, dateBR: string) => string> = {
  saida_esquecida: (name, dateBR) => `${name} esqueceu de bater o ponto de saída em ${dateBR}.`,
  ausencia: (name, dateBR) => `${name} não registrou nenhum ponto em ${dateBR}.`,
};
```

```typescript
  async sendPontoPerdido(
    tipo: PontoPerdidoTipo,
    employeeUserId: string,
    employeeName: string,
    dateOnly: string,
  ): Promise<void> {
    const dateBR = formatDateOnlyBR(dateOnly);
    const managers = await this.prisma.employee.findMany({
      where: {
        role: { in: ['gestor', 'rh'] },
        deletedAt: null,
        userId: { not: employeeUserId },
      },
    });

    const recipients = [
      {
        userId: employeeUserId,
        message: PONTO_PERDIDO_MESSAGE_COLABORADOR[tipo](dateBR),
        link: '/historico' as string | null,
      },
      ...managers.map((m) => ({
        userId: m.userId,
        message: PONTO_PERDIDO_MESSAGE_GESTOR[tipo](employeeName, dateBR),
        link: null as string | null,
      })),
    ];

    const created = await this.prisma.notification.createManyAndReturn({
      data: recipients.map((r) => ({
        userId: r.userId,
        type: 'ponto_perdido',
        category: tipo,
        message: r.message,
        link: r.link,
      })),
    });

    void Promise.all(
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

- [ ] **Step 8: Implement the module export**

In `apps/api/src/notifications/notifications.module.ts`, add `exports`:

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
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/api && npx jest notifications/notifications.service.spec.ts --silent=false`
Expected: PASS, all tests in the file (existing `sendPagamento`/`pagamentoStatus`/`listMine`/`markRead` tests + the two new `sendPontoPerdido` tests).

Also run the full API suite to confirm the module change didn't break anything that depends on `NotificationsModule`:

Run: `cd apps/api && npx jest --silent=false`
Expected: PASS, aside from the pre-existing `auth/auth.service.spec.ts` failure documented in this repo's history (fails identically on master when run in isolation, unrelated to this change).

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/common/sao-paulo-time.ts apps/api/src/common/sao-paulo-time.spec.ts apps/api/src/notifications/notifications.service.ts apps/api/src/notifications/notifications.module.ts apps/api/src/notifications/notifications.service.spec.ts
git commit -m "feat(api): add sendPontoPerdido notification producer"
```

---

### Task 2: `PontoPerdidoService` — daily cron scan

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/src/ponto-perdido/ponto-perdido.module.ts`
- Create: `apps/api/src/ponto-perdido/ponto-perdido.service.ts`
- Test: `apps/api/src/ponto-perdido/ponto-perdido.service.spec.ts`

**Interfaces:**
- Consumes: `NotificationsService.sendPontoPerdido(tipo, employeeUserId, employeeName, dateOnly)` from Task 1; `dateOnlyInSaoPaulo`, `isWeekend` from `apps/api/src/common/sao-paulo-time.ts` (both already exist, unchanged).
- Produces: `PontoPerdidoService.run(now: Date): Promise<void>` and the `@Cron`-decorated `handleCron(): Promise<void>` that calls it with `new Date()`.

- [ ] **Step 1: Add the `@nestjs/schedule` dependency**

In `apps/api/package.json`, add to `dependencies` (alphabetically, right after `"@nestjs/platform-express": "^11.0.1",` and before `"@ponto-dcit/shared-types": "workspace:^",`):

```json
    "@nestjs/schedule": "^5.0.1",
```

Run: `cd apps/api && npm install` (or `pnpm install` from the repo root if that's this environment's convention) to actually fetch it — this must happen before Step 3's code can compile.

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/ponto-perdido/ponto-perdido.service.spec.ts`, following the same fixture-and-cleanup conventions as `apps/api/src/alertas/alertas.service.spec.ts` (mocked `ExpoPushService`, real `PrismaService` and real `NotificationsService` against the test SQLite database, prefix-scoped fixture cleanup):

```typescript
process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { PontoPerdidoService } from './ponto-perdido.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';

describe('PontoPerdidoService', () => {
  let service: PontoPerdidoService;
  let prisma: PrismaService;
  const sendToUser = jest.fn();

  // now = 2026-09-02T09:00:00.000Z -> São Paulo date is still 2026-09-02
  // (UTC-3), so the target (yesterday) is 2026-09-01, a Tuesday.
  const NOW = new Date('2026-09-02T09:00:00.000Z');
  const TARGET_DATE = '2026-09-01';

  async function cleanup() {
    await prisma.notification.deleteMany({ where: { type: 'ponto_perdido' } });
    await prisma.timeEntry.deleteMany({ where: { userId: { startsWith: 'user-pp-' } } });
    await prisma.vacationRequest.deleteMany({ where: { userId: { startsWith: 'user-pp-' } } });
    await prisma.atestado.deleteMany({ where: { userId: { startsWith: 'user-pp-' } } });
    await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-pp-' } } });
  }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PontoPerdidoService,
        NotificationsService,
        PrismaService,
        { provide: ExpoPushService, useValue: { sendToUser } },
      ],
    }).compile();

    service = module.get(PontoPerdidoService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await cleanup();
  });

  afterEach(async () => {
    sendToUser.mockClear();
    await cleanup();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('flags a forgotten clock-out (odd punch count) on the target day', async () => {
    await prisma.employee.create({
      data: { userId: 'user-pp-a', name: 'Ana PP', role: 'colaborador', hireDate: new Date('2024-01-01') },
    });
    await prisma.timeEntry.create({
      data: { userId: 'user-pp-a', clockedAt: new Date('2026-09-01T12:00:00.000Z') },
    });

    await service.run(NOW);

    const notifications = await prisma.notification.findMany({ where: { userId: 'user-pp-a' } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ category: 'saida_esquecida' });
  });

  it('flags a forgotten clock-out with 3 punches too (odd, regardless of exact count)', async () => {
    await prisma.employee.create({
      data: { userId: 'user-pp-b', name: 'Bruno PP', role: 'colaborador', hireDate: new Date('2024-01-01') },
    });
    for (const hour of ['12:00', '16:00', '20:00']) {
      await prisma.timeEntry.create({
        data: { userId: 'user-pp-b', clockedAt: new Date(`2026-09-01T${hour}:00.000Z`) },
      });
    }

    await service.run(NOW);

    const notifications = await prisma.notification.findMany({ where: { userId: 'user-pp-b' } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ category: 'saida_esquecida' });
  });

  it('flags an unexplained absence (zero punches, weekday, no vacation/atestado)', async () => {
    await prisma.employee.create({
      data: { userId: 'user-pp-c', name: 'Carla PP', role: 'colaborador', hireDate: new Date('2024-01-01') },
    });

    await service.run(NOW);

    const notifications = await prisma.notification.findMany({ where: { userId: 'user-pp-c' } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ category: 'ausencia' });
  });

  it('does nothing when the day is closed correctly (even punch count)', async () => {
    await prisma.employee.create({
      data: { userId: 'user-pp-d', name: 'Daniel PP', role: 'colaborador', hireDate: new Date('2024-01-01') },
    });
    await prisma.timeEntry.create({
      data: { userId: 'user-pp-d', clockedAt: new Date('2026-09-01T12:00:00.000Z') },
    });
    await prisma.timeEntry.create({
      data: { userId: 'user-pp-d', clockedAt: new Date('2026-09-01T20:00:00.000Z') },
    });

    await service.run(NOW);

    expect(await prisma.notification.findMany({ where: { userId: 'user-pp-d' } })).toHaveLength(0);
  });

  it('does not flag an absence covered by an approved vacation', async () => {
    await prisma.employee.create({
      data: { userId: 'user-pp-e', name: 'Eduarda PP', role: 'colaborador', hireDate: new Date('2024-01-01') },
    });
    await prisma.vacationRequest.create({
      data: {
        userId: 'user-pp-e',
        startDate: new Date('2026-08-25T00:00:00.000Z'),
        endDate: new Date('2026-09-05T00:00:00.000Z'),
        days: 12,
        status: 'aprovado',
      },
    });

    await service.run(NOW);

    expect(await prisma.notification.findMany({ where: { userId: 'user-pp-e' } })).toHaveLength(0);
  });

  it('does not flag an absence covered by an approved atestado', async () => {
    await prisma.employee.create({
      data: { userId: 'user-pp-f', name: 'Felipe PP', role: 'colaborador', hireDate: new Date('2024-01-01') },
    });
    await prisma.atestado.create({
      data: {
        userId: 'user-pp-f',
        userName: 'Felipe PP',
        status: 'aprovado',
        dias: 3,
        createdAt: new Date('2026-08-31T13:00:00.000Z'), // covers 2026-08-31 through 2026-09-02
      },
    });

    await service.run(NOW);

    expect(await prisma.notification.findMany({ where: { userId: 'user-pp-f' } })).toHaveLength(0);
  });

  it('skips the whole scan on a weekend target day', async () => {
    await prisma.employee.create({
      data: { userId: 'user-pp-g', name: 'Gabriela PP', role: 'colaborador', hireDate: new Date('2024-01-01') },
    });
    // now = 2026-08-31 -> target day = 2026-08-30, a Sunday.
    await service.run(new Date('2026-08-31T09:00:00.000Z'));

    expect(await prisma.notification.findMany({ where: { userId: 'user-pp-g' } })).toHaveLength(0);
  });

  it('excludes an employee hired after the target day', async () => {
    await prisma.employee.create({
      data: { userId: 'user-pp-h', name: 'Hugo PP', role: 'colaborador', hireDate: new Date('2026-09-02T00:00:00.000Z') },
    });

    await service.run(NOW);

    expect(await prisma.notification.findMany({ where: { userId: 'user-pp-h' } })).toHaveLength(0);
  });

  it('excludes a soft-deleted (inactive) employee', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-i',
        name: 'Igor PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
        deletedAt: new Date('2026-08-01'),
      },
    });

    await service.run(NOW);

    expect(await prisma.notification.findMany({ where: { userId: 'user-pp-i' } })).toHaveLength(0);
  });

  it('does not throw when an underlying Prisma call fails partway through the scan', async () => {
    await prisma.employee.create({
      data: { userId: 'user-pp-j', name: 'Julia PP', role: 'colaborador', hireDate: new Date('2024-01-01') },
    });

    const spy = jest.spyOn(prisma.timeEntry, 'findMany').mockRejectedValueOnce(new Error('DB down'));

    await expect(service.run(NOW)).resolves.toBeUndefined();

    spy.mockRestore();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx jest ponto-perdido/ponto-perdido.service.spec.ts --silent=false`
Expected: FAIL — `PontoPerdidoService` module doesn't exist yet (import error).

- [ ] **Step 4: Implement `PontoPerdidoService`**

Create `apps/api/src/ponto-perdido/ponto-perdido.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dateOnlyInSaoPaulo, isWeekend } from '../common/sao-paulo-time';

@Injectable()
export class PontoPerdidoService {
  private readonly logger = new Logger(PontoPerdidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // 06:00 América/São_Paulo, todo dia — bem depois da virada de dia, dando
  // tempo de qualquer ajuste retroativo same-day (ex: /ajustar aprovado
  // ainda ontem à noite) já estar refletido antes de este job rodar.
  @Cron('0 6 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleCron(): Promise<void> {
    await this.run(new Date());
  }

  // Separado de handleCron pra ser chamável direto nos testes, com uma data
  // fixa, sem depender de mockar o relógio do sistema.
  async run(now: Date): Promise<void> {
    // Best-effort: uma falha aqui (ex: push fora do ar) nunca pode travar o
    // agendador nem impedir a próxima execução diária.
    try {
      const todaySP = dateOnlyInSaoPaulo(now);
      const targetDate = new Date(`${todaySP}T00:00:00.000Z`);
      targetDate.setUTCDate(targetDate.getUTCDate() - 1);
      const targetDateSP = dateOnlyInSaoPaulo(targetDate);

      if (isWeekend(targetDateSP)) return;

      const startOfTarget = new Date(`${targetDateSP}T03:00:00.000Z`); // meia-noite SP = UTC 03:00
      const endOfTarget = new Date(startOfTarget);
      endOfTarget.setUTCDate(endOfTarget.getUTCDate() + 1);
      const targetDateMidnightUTC = new Date(`${targetDateSP}T00:00:00.000Z`);

      // hireDate não filtra na query: é armazenado como meia-noite UTC do dia
      // de contratação (mesma convenção de "new Date('YYYY-MM-DD')" usada em
      // EmployeesService), enquanto endOfTarget é meia-noite de São Paulo (UTC
      // 03:00) — comparar os dois direto na query bateria as convenções
      // erradas (ex: hireDate = 2026-09-02T00:00:00Z passaria como "<=" um
      // endOfTarget de 2026-09-02T03:00:00Z mesmo tendo sido contratado no dia
      // seguinte ao alvo). Normaliza os dois lados pra data-only em São Paulo
      // antes de comparar como string, sem essa ambiguidade.
      const allActiveEmployees = await this.prisma.employee.findMany({
        where: { deletedAt: null },
      });
      const employees = allActiveEmployees.filter(
        (e) => dateOnlyInSaoPaulo(e.hireDate) <= targetDateSP,
      );
      const userIds = employees.map((e) => e.userId);

      const entries = await this.prisma.timeEntry.findMany({
        where: { userId: { in: userIds }, clockedAt: { gte: startOfTarget, lt: endOfTarget } },
      });
      const countByUserId = new Map<string, number>();
      for (const entry of entries) {
        countByUserId.set(entry.userId, (countByUserId.get(entry.userId) ?? 0) + 1);
      }

      const vacations = await this.prisma.vacationRequest.findMany({
        where: {
          userId: { in: userIds },
          status: 'aprovado',
          startDate: { lte: targetDateMidnightUTC },
          endDate: { gte: targetDateMidnightUTC },
        },
      });
      const onVacation = new Set(vacations.map((v) => v.userId));

      // Mesma lógica de cobertura de período que TimeEntriesService.listTeamToday
      // já usa (periodStart/periodEnd calculados a partir de createdAt + dias),
      // só que checando o dia alvo em vez de hoje.
      const atestados = await this.prisma.atestado.findMany({
        where: { userId: { in: userIds }, status: 'aprovado', dias: { not: null } },
      });
      const onAtestado = new Set<string>();
      for (const atestado of atestados) {
        const periodStart = new Date(`${dateOnlyInSaoPaulo(atestado.createdAt)}T00:00:00.000Z`);
        const periodEnd = new Date(periodStart);
        periodEnd.setUTCDate(periodEnd.getUTCDate() + (atestado.dias ?? 0));
        if (periodStart <= targetDateMidnightUTC && targetDateMidnightUTC < periodEnd) {
          onAtestado.add(atestado.userId);
        }
      }

      for (const employee of employees) {
        const count = countByUserId.get(employee.userId) ?? 0;

        if (count === 0) {
          if (onVacation.has(employee.userId) || onAtestado.has(employee.userId)) continue;
          await this.notifications.sendPontoPerdido(
            'ausencia',
            employee.userId,
            employee.name,
            targetDateSP,
          );
        } else if (count % 2 === 1) {
          await this.notifications.sendPontoPerdido(
            'saida_esquecida',
            employee.userId,
            employee.name,
            targetDateSP,
          );
        }
        // count par e >= 2: dia fechado corretamente, nada a fazer.
      }
    } catch (error) {
      this.logger.warn(`Falha ao rodar detecção de ponto perdido: ${String(error)}`);
    }
  }
}
```

Create `apps/api/src/ponto-perdido/ponto-perdido.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PontoPerdidoService } from './ponto-perdido.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [PontoPerdidoService],
})
export class PontoPerdidoModule {}
```

- [ ] **Step 5: Wire into `AppModule` and register `ScheduleModule`**

Modify `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { AuthModule } from './auth/auth.module';
import { AtestadosModule } from './atestados/atestados.module';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module';
import { DocumentosModule } from './documentos/documentos.module';
import { MuralModule } from './mural/mural.module';
import { BeneficiosModule } from './beneficios/beneficios.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OperacionalModule } from './operacional/operacional.module';
import { EmployeesModule } from './employees/employees.module';
import { PushModule } from './push/push.module';
import { AlertasModule } from './alertas/alertas.module';
import { ConvencoesModule } from './convencoes/convencoes.module';
import { BancoDeHorasModule } from './banco-de-horas/banco-de-horas.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PontoPerdidoModule } from './ponto-perdido/ponto-perdido.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TimeEntriesModule,
    AtestadosModule,
    SolicitacoesModule,
    DocumentosModule,
    MuralModule,
    BeneficiosModule,
    OnboardingModule,
    OperacionalModule,
    EmployeesModule,
    PushModule,
    AlertasModule,
    ConvencoesModule,
    BancoDeHorasModule,
    NotificationsModule,
    PontoPerdidoModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/api && npx jest ponto-perdido/ponto-perdido.service.spec.ts --silent=false`
Expected: PASS, all 10 tests.

Then run the full API suite (this also exercises `AppModule`'s bootstrap, confirming `ScheduleModule.forRoot()` and the new module wiring don't break app startup — several existing specs, like `app.controller.spec.ts`, instantiate `AppModule` directly):

Run: `cd apps/api && npx jest --silent=false`
Expected: PASS, aside from the pre-existing `auth/auth.service.spec.ts` failure (documented, unrelated, reproduces on master).

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/src/app.module.ts apps/api/src/ponto-perdido/ponto-perdido.module.ts apps/api/src/ponto-perdido/ponto-perdido.service.ts apps/api/src/ponto-perdido/ponto-perdido.service.spec.ts
git commit -m "feat(api): add daily missed-punch detection job"
```

Note: if `package.json` changed and this is a pnpm workspace, also stage `pnpm-lock.yaml` if the install step modified it (`git status` will show it if so).

---

## After both tasks

Run the full API suite once more, and skim `git log --oneline` against the plan to confirm both commits landed. Then do a final whole-branch review before considering this sub-project done, per this project's established practice — the two previous notification sub-projects both had task-scoped reviews miss real bugs that only a full-diff review caught (a stale-state race in the web bell, and four issues including a convention violation and a login/logout gap in the mobile bell). This plan is smaller and more self-contained than either of those (backend-only, 2 tasks, no new screens), but the final review is still worth running — in particular, double-check the `@Cron` timezone option is actually honored by the installed `@nestjs/schedule`/`cron` version (verify via its own type definitions or a quick manual trigger, since a silently-ignored `timeZone` option would mean the job runs at 06:00 UTC instead of 06:00 São Paulo — a 3-hour drift that no unit test here catches, since `run()` is always tested with an explicit `Date`, never through the real `@Cron` trigger path).
