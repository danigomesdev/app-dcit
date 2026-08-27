process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { BeneficiosService } from './beneficios.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BeneficiosService', () => {
  let service: BeneficiosService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BeneficiosService, PrismaService],
    }).compile();

    service = module.get(BeneficiosService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.benefitBalance.deleteMany();
    await prisma.partner.deleteMany();
    await prisma.employee.deleteMany({
      where: { userId: { in: ['user-c', 'user-d'] } },
    });
    await prisma.onModuleDestroy();
  });

  it("lists only the given user's benefit balances", async () => {
    await prisma.benefitBalance.createMany({
      data: [
        {
          userId: 'user-a',
          icon: 'restaurant-outline',
          label: 'Vale-refeição',
          balance: 412.5,
          monthlyCredit: 600,
        },
        {
          userId: 'user-b',
          icon: 'restaurant-outline',
          label: 'Vale-refeição',
          balance: 100,
          monthlyCredit: 600,
        },
      ],
    });

    const results = await service.listBalances('user-a');

    expect(results).toHaveLength(1);
    expect(results[0].balance).toBe(412.5);
  });

  it('lists every balance across users, joined with the employee name', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-c',
        name: 'Carla Beneficiária',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await prisma.benefitBalance.create({
      data: {
        userId: 'user-c',
        icon: 'restaurant-outline',
        label: 'Vale-refeição',
        balance: 250,
        monthlyCredit: 600,
      },
    });
    // No Employee row for this user — the join must still return something
    // usable rather than dropping the balance or throwing.
    await prisma.benefitBalance.create({
      data: {
        userId: 'user-d',
        icon: 'restaurant-outline',
        label: 'Vale-refeição',
        balance: 300,
        monthlyCredit: 600,
      },
    });

    const results = await service.listAllBalances();

    expect(results.find((r) => r.userId === 'user-c')?.userName).toBe(
      'Carla Beneficiária',
    );
    expect(results.find((r) => r.userId === 'user-d')?.userName).toBe('user-d');
  });

  it('lists all partners regardless of user', async () => {
    await prisma.partner.create({
      data: {
        name: 'Smart Fit',
        category: 'Academia',
        discount: '20% de desconto',
      },
    });

    const results = await service.listPartners();

    expect(results.some((p) => p.name === 'Smart Fit')).toBe(true);
  });
});
