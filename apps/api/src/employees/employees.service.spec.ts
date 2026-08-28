process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeesService, PrismaService],
    }).compile();

    service = module.get(EmployeesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.employee.deleteMany({
      where: { userId: { in: ['emp-b', 'emp-a', 'emp-schedule'] } },
    });
    await prisma.onModuleDestroy();
  });

  it('lists employees sorted by name', async () => {
    await prisma.employee.create({
      data: {
        userId: 'emp-b',
        name: 'Beto',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'emp-a',
        name: 'Ana',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });

    const results = await service.list();

    const names = results
      .filter((e) => ['emp-a', 'emp-b'].includes(e.userId))
      .map((e) => e.name);
    expect(names).toEqual(['Ana', 'Beto']);
  });

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
      const found = await prisma.employee.findUnique({
        where: { userId: 'emp-schedule' },
      });
      expect(found?.expectedStartTime).toBe('09:00');
    });

    it('clears expectedStartTime when given null', async () => {
      await service.updateSchedule('emp-schedule', { expectedStartTime: null });

      const found = await prisma.employee.findUnique({
        where: { userId: 'emp-schedule' },
      });
      expect(found?.expectedStartTime).toBeNull();
    });
  });

  it('list() includes expectedStartTime for each employee', async () => {
    await prisma.employee.update({
      where: { userId: 'emp-a' },
      data: { expectedStartTime: '08:00' },
    });

    const results = await service.list();

    expect(results.find((e) => e.userId === 'emp-a')?.expectedStartTime).toBe(
      '08:00',
    );
  });
});
