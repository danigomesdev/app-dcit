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
      where: { userId: { in: ['emp-b', 'emp-a'] } },
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
});
