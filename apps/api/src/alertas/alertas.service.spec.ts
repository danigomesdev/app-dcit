process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { AlertasService } from './alertas.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';

describe('AlertasService', () => {
  let service: AlertasService;
  let prisma: PrismaService;
  const pushMock = { sendToUser: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertasService,
        PrismaService,
        { provide: ExpoPushService, useValue: pushMock },
      ],
    }).compile();

    service = module.get(AlertasService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();

    // Guard against stale rows left behind by a previously-aborted test run,
    // which would otherwise break toHaveLength(1)-style assertions below.
    await prisma.jornadaAlert.deleteMany({
      where: { userId: { startsWith: 'user-jornada-' } },
    });
    await prisma.timeEntry.deleteMany({
      where: { userId: { startsWith: 'user-jornada-' } },
    });
    await prisma.employee.deleteMany({
      where: { userId: { startsWith: 'user-jornada-' } },
    });
  });

  afterEach(() => {
    pushMock.sendToUser.mockClear();
  });

  afterAll(async () => {
    await prisma.jornadaAlert.deleteMany({
      where: { userId: { startsWith: 'user-jornada-' } },
    });
    await prisma.timeEntry.deleteMany({
      where: { userId: { startsWith: 'user-jornada-' } },
    });
    await prisma.employee.deleteMany({
      where: { userId: { startsWith: 'user-jornada-' } },
    });
    await prisma.onModuleDestroy();
  });

  describe('checkAfterPunch — error containment', () => {
    it('does not throw when an underlying Prisma call fails', async () => {
      await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-z',
          clockedAt: new Date('2026-09-01T22:00:00.000Z'),
        },
      });
      const newEntry = await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-z',
          clockedAt: new Date('2026-09-02T05:00:00.000Z'),
        },
      });

      const spy = jest
        .spyOn(prisma.jornadaAlert, 'create')
        .mockRejectedValueOnce(new Error('Database error'));

      // This should not throw, even though jornadaAlert.create will fail
      await expect(
        service.checkAfterPunch('user-jornada-z', newEntry),
      ).resolves.toBeUndefined();

      spy.mockRestore();
    });
  });

  describe('checkAfterPunch — interjornada', () => {
    it('records a violation when the rest since the last punch is under 11h', async () => {
      // An earlier punch the same day closes out that day's shift (even
      // punch count), so the overnight-shift guard from Fix 1 doesn't treat
      // this as a still-open shift being completed — this is a genuine new
      // shift starting with too little rest since the prior one ended.
      await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-a',
          clockedAt: new Date('2026-09-01T10:00:00.000Z'),
        },
      });
      await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-a',
          clockedAt: new Date('2026-09-01T22:00:00.000Z'),
        },
      });
      const newEntry = await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-a',
          clockedAt: new Date('2026-09-02T05:00:00.000Z'),
        },
      });

      await service.checkAfterPunch('user-jornada-a', newEntry);

      const alerts = await service.listForUser('user-jornada-a');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        type: 'interjornada',
        minutesShort: 240,
      });
      expect(pushMock.sendToUser).toHaveBeenCalledWith(
        'user-jornada-a',
        expect.objectContaining({ title: 'Intervalo entre turnos' }),
      );
    });

    it('does not record a violation when the rest is at least 11h', async () => {
      await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-b',
          clockedAt: new Date('2026-09-01T20:00:00.000Z'),
        },
      });
      const newEntry = await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-b',
          clockedAt: new Date('2026-09-02T08:00:00.000Z'),
        },
      });

      await service.checkAfterPunch('user-jornada-b', newEntry);

      expect(await service.listForUser('user-jornada-b')).toHaveLength(0);
      expect(pushMock.sendToUser).not.toHaveBeenCalled();
    });

    it("does nothing on a user's very first punch ever", async () => {
      const newEntry = await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-c',
          clockedAt: new Date('2026-09-02T08:00:00.000Z'),
        },
      });

      await service.checkAfterPunch('user-jornada-c', newEntry);

      expect(await service.listForUser('user-jornada-c')).toHaveLength(0);
    });

    it("does not flag an overnight shift's clock-out as an interjornada violation", async () => {
      const userId = 'user-jornada-i';
      await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-01T22:00:00.000Z') }, // clock-in, Monday night
      });
      const clockOut = await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-02T06:00:00.000Z') }, // clock-out, Tuesday morning
      });

      await service.checkAfterPunch(userId, clockOut);

      expect(await service.listForUser(userId)).toHaveLength(0);
    });

    it('does not record a violation when the rest is exactly 11h (the boundary)', async () => {
      const userId = 'user-jornada-j';
      // An extra punch earlier the same day makes that day's punch count
      // even (a fully-closed shift), so the new overnight-shift guard from
      // Fix 1 doesn't short-circuit this test before the gap comparison
      // (the actual thing under test) ever runs.
      await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-01T08:00:00.000Z') },
      });
      await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-01T20:00:00.000Z') },
      });
      const newEntry = await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-02T07:00:00.000Z') }, // exactly 660 min later
      });

      await service.checkAfterPunch(userId, newEntry);

      expect(await service.listForUser(userId)).toHaveLength(0);
    });
  });

  describe('checkAfterPunch — intrajornada', () => {
    it('records a violation when the lunch break is under 1h', async () => {
      const userId = 'user-jornada-d';
      await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T08:00:00.000Z') },
      });
      await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T12:00:00.000Z') },
      });
      const back = await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T12:30:00.000Z') },
      });

      await service.checkAfterPunch(userId, back);

      const alerts = await service.listForUser(userId);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        type: 'intrajornada',
        minutesShort: 30,
      });
      expect(pushMock.sendToUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ title: 'Intervalo de almoço' }),
      );
    });

    it('does not record a violation when the lunch break is at least 1h', async () => {
      const userId = 'user-jornada-e';
      await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T08:00:00.000Z') },
      });
      await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T12:00:00.000Z') },
      });
      const back = await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T13:00:00.000Z') },
      });

      await service.checkAfterPunch(userId, back);

      expect(await service.listForUser(userId)).toHaveLength(0);
    });

    it('does nothing on the 2nd or 4th punch of the day', async () => {
      const userId = 'user-jornada-f';
      const first = await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T08:00:00.000Z') },
      });
      await service.checkAfterPunch(userId, first);
      const second = await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T12:00:00.000Z') },
      });
      await service.checkAfterPunch(userId, second);
      const third = await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T13:00:00.000Z') },
      });
      await service.checkAfterPunch(userId, third);
      const fourth = await prisma.timeEntry.create({
        data: { userId, clockedAt: new Date('2026-09-03T17:00:00.000Z') },
      });
      await service.checkAfterPunch(userId, fourth);

      expect(await service.listForUser(userId)).toHaveLength(0);
    });
  });

  describe('listAll', () => {
    it('joins each alert with the employee name', async () => {
      await prisma.employee.create({
        data: {
          userId: 'user-jornada-g',
          name: 'Gabriela Jornada',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });
      // An earlier punch the same day closes out that day's shift (even
      // punch count), so the overnight-shift guard from Fix 1 doesn't skip
      // the interjornada check for the next punch below.
      await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-g',
          clockedAt: new Date('2026-09-01T10:00:00.000Z'),
        },
      });
      await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-g',
          clockedAt: new Date('2026-09-01T22:00:00.000Z'),
        },
      });
      const newEntry = await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-g',
          clockedAt: new Date('2026-09-02T05:00:00.000Z'),
        },
      });
      await service.checkAfterPunch('user-jornada-g', newEntry);

      const all = await service.listAll();
      expect(all.find((a) => a.userId === 'user-jornada-g')?.userName).toBe(
        'Gabriela Jornada',
      );
    });

    it('falls back to the bare userId when no Employee row exists', async () => {
      // An earlier punch the same day closes out that day's shift (even
      // punch count), so the overnight-shift guard from Fix 1 doesn't skip
      // the interjornada check for the next punch below.
      await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-h',
          clockedAt: new Date('2026-09-01T10:00:00.000Z'),
        },
      });
      await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-h',
          clockedAt: new Date('2026-09-01T22:00:00.000Z'),
        },
      });
      const newEntry = await prisma.timeEntry.create({
        data: {
          userId: 'user-jornada-h',
          clockedAt: new Date('2026-09-02T05:00:00.000Z'),
        },
      });
      await service.checkAfterPunch('user-jornada-h', newEntry);

      const all = await service.listAll();
      expect(all.find((a) => a.userId === 'user-jornada-h')?.userName).toBe(
        'user-jornada-h',
      );
    });
  });
});
