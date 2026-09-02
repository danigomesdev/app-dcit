process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { PontoPerdidoService } from './ponto-perdido.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';

describe('PontoPerdidoService', () => {
  let service: PontoPerdidoService;
  let prisma: PrismaService;
  let notifications: NotificationsService;
  const sendToUser = jest.fn();

  // now = 2026-09-02T09:00:00.000Z -> São Paulo date is still 2026-09-02
  // (UTC-3), so the target (yesterday) is 2026-09-01, a Tuesday.
  const NOW = new Date('2026-09-02T09:00:00.000Z');

  async function cleanup() {
    await prisma.notification.deleteMany({ where: { type: 'ponto_perdido' } });
    await prisma.timeEntry.deleteMany({
      where: { userId: { startsWith: 'user-pp-' } },
    });
    await prisma.vacationRequest.deleteMany({
      where: { userId: { startsWith: 'user-pp-' } },
    });
    await prisma.atestado.deleteMany({
      where: { userId: { startsWith: 'user-pp-' } },
    });
    await prisma.employee.deleteMany({
      where: { userId: { startsWith: 'user-pp-' } },
    });
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
    notifications = module.get(NotificationsService);
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
      data: {
        userId: 'user-pp-a',
        name: 'Ana PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.timeEntry.create({
      data: {
        userId: 'user-pp-a',
        clockedAt: new Date('2026-09-01T12:00:00.000Z'),
      },
    });

    await service.run(NOW);

    const notifications = await prisma.notification.findMany({
      where: { userId: 'user-pp-a' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ category: 'saida_esquecida' });
  });

  it('flags a forgotten clock-out with 3 punches too (odd, regardless of exact count)', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-b',
        name: 'Bruno PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    for (const hour of ['12:00', '16:00', '20:00']) {
      await prisma.timeEntry.create({
        data: {
          userId: 'user-pp-b',
          clockedAt: new Date(`2026-09-01T${hour}:00.000Z`),
        },
      });
    }

    await service.run(NOW);

    const notifications = await prisma.notification.findMany({
      where: { userId: 'user-pp-b' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ category: 'saida_esquecida' });
  });

  it('flags an unexplained absence (zero punches, weekday, no vacation/atestado)', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-c',
        name: 'Carla PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });

    await service.run(NOW);

    const notifications = await prisma.notification.findMany({
      where: { userId: 'user-pp-c' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ category: 'ausencia' });
  });

  it('does nothing when the day is closed correctly (even punch count)', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-d',
        name: 'Daniel PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.timeEntry.create({
      data: {
        userId: 'user-pp-d',
        clockedAt: new Date('2026-09-01T12:00:00.000Z'),
      },
    });
    await prisma.timeEntry.create({
      data: {
        userId: 'user-pp-d',
        clockedAt: new Date('2026-09-01T20:00:00.000Z'),
      },
    });

    await service.run(NOW);

    expect(
      await prisma.notification.findMany({ where: { userId: 'user-pp-d' } }),
    ).toHaveLength(0);
  });

  it('does not flag an absence covered by an approved vacation', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-e',
        name: 'Eduarda PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
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

    expect(
      await prisma.notification.findMany({ where: { userId: 'user-pp-e' } }),
    ).toHaveLength(0);
  });

  it('does not flag an absence covered by an approved atestado', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-f',
        name: 'Felipe PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
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

    expect(
      await prisma.notification.findMany({ where: { userId: 'user-pp-f' } }),
    ).toHaveLength(0);
  });

  it('does not flag an absence covered by a pending (enviado, not yet approved) atestado', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-f2',
        name: 'Fernanda PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.atestado.create({
      data: {
        userId: 'user-pp-f2',
        userName: 'Fernanda PP',
        status: 'enviado',
        dias: 3,
        createdAt: new Date('2026-08-31T13:00:00.000Z'), // covers 2026-08-31 through 2026-09-02
      },
    });

    await service.run(NOW);

    expect(
      await prisma.notification.findMany({ where: { userId: 'user-pp-f2' } }),
    ).toHaveLength(0);
  });

  it('skips the whole scan on a weekend target day', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-g',
        name: 'Gabriela PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    // now = 2026-08-31 -> target day = 2026-08-30, a Sunday.
    await service.run(new Date('2026-08-31T09:00:00.000Z'));

    expect(
      await prisma.notification.findMany({ where: { userId: 'user-pp-g' } }),
    ).toHaveLength(0);
  });

  it('excludes an employee hired after the target day', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-h',
        name: 'Hugo PP',
        role: 'colaborador',
        hireDate: new Date('2026-09-02T00:00:00.000Z'),
      },
    });

    await service.run(NOW);

    expect(
      await prisma.notification.findMany({ where: { userId: 'user-pp-h' } }),
    ).toHaveLength(0);
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

    expect(
      await prisma.notification.findMany({ where: { userId: 'user-pp-i' } }),
    ).toHaveLength(0);
  });

  it('does not throw when an underlying Prisma call fails partway through the scan', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-j',
        name: 'Julia PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });

    const spy = jest
      .spyOn(prisma.timeEntry, 'findMany')
      .mockRejectedValueOnce(new Error('DB down'));

    await expect(service.run(NOW)).resolves.toBeUndefined();

    spy.mockRestore();
  });

  it('continues notifying the remaining employees when one sendPontoPerdido call fails mid-scan', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-pp-k',
        name: 'Karina PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'user-pp-l',
        name: 'Lucas PP',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });

    const original = notifications.sendPontoPerdido.bind(
      notifications,
    ) as NotificationsService['sendPontoPerdido'];
    const spy = jest
      .spyOn(notifications, 'sendPontoPerdido')
      .mockImplementation((tipo, employeeUserId, employeeName, dateOnly) => {
        if (employeeUserId === 'user-pp-k') {
          return Promise.reject(new Error('push failure'));
        }
        return original(tipo, employeeUserId, employeeName, dateOnly);
      });

    await expect(service.run(NOW)).resolves.toBeUndefined();

    const karinaNotifications = await prisma.notification.findMany({
      where: { userId: 'user-pp-k' },
    });
    const lucasNotifications = await prisma.notification.findMany({
      where: { userId: 'user-pp-l' },
    });
    expect(karinaNotifications).toHaveLength(0);
    expect(lucasNotifications.length).toBeGreaterThan(0);

    spy.mockRestore();
  });

  it('aborts all notifications for the day when absences exceed 50% of scanned employees (likely holiday or outage)', async () => {
    const absentIds = ['user-pp-m1', 'user-pp-m2', 'user-pp-m3'];
    const closedIds = ['user-pp-m4', 'user-pp-m5'];

    for (const userId of absentIds) {
      await prisma.employee.create({
        data: {
          userId,
          name: `Absent ${userId}`,
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });
    }
    for (const userId of closedIds) {
      await prisma.employee.create({
        data: {
          userId,
          name: `Closed ${userId}`,
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });
      await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-01T12:00:00.000Z') },
      });
      await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-01T20:00:00.000Z') },
      });
    }

    await service.run(NOW);

    const allIds = [...absentIds, ...closedIds];
    const createdNotifications = await prisma.notification.findMany({
      where: { userId: { in: allIds } },
    });
    expect(createdNotifications).toHaveLength(0);
  });
});
