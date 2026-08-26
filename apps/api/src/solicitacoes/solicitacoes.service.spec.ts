process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { SolicitacoesService } from './solicitacoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';

describe('SolicitacoesService', () => {
  let service: SolicitacoesService;
  let prisma: PrismaService;
  const pushMock = { sendToUser: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitacoesService,
        PrismaService,
        { provide: ExpoPushService, useValue: pushMock },
      ],
    }).compile();

    service = module.get(SolicitacoesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.adjustmentRequest.deleteMany();
    await prisma.compensationRequest.deleteMany();
    await prisma.vacationRequest.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.vacationHistoryEntry.deleteMany();
    await prisma.onModuleDestroy();
  });

  it('creates and lists adjustment requests scoped to the user', async () => {
    await service.createAdjustment('user-a', {
      reason: 'Esqueci de bater o ponto',
    });
    await service.createAdjustment('user-b', { reason: 'Outro motivo' });

    const results = await service.listAdjustments('user-a');

    expect(results).toHaveLength(1);
    expect(results[0].reason).toBe('Esqueci de bater o ponto');
    expect(results[0].status).toBe('pendente');
  });

  it('creates and lists compensation requests scoped to the user', async () => {
    await service.createCompensation('user-c', { reason: 'Compensar 2h' });

    const results = await service.listCompensations('user-c');

    expect(results).toHaveLength(1);
    expect(results[0].reason).toBe('Compensar 2h');
  });

  it('creates and lists vacation requests scoped to the user', async () => {
    await service.createVacation('user-d', {
      startDate: '2026-10-05',
      endDate: '2026-10-14',
      days: 10,
    });

    const results = await service.listVacations('user-d');

    expect(results).toHaveLength(1);
    expect(results[0].days).toBe(10);
    expect(results[0].startDate.toISOString().slice(0, 10)).toBe('2026-10-05');
  });

  it('returns the employee hire date and vacation history for the profile', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-e',
        name: 'Ana',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await prisma.vacationHistoryEntry.create({
      data: {
        userId: 'user-e',
        year: 2025,
        daysTaken: 20,
        startDate: new Date('2025-12-15'),
        endDate: new Date('2026-01-03'),
      },
    });

    const profile = await service.getVacationProfile('user-e');

    expect(profile.hireDate?.toISOString().slice(0, 10)).toBe('2024-03-15');
    expect(profile.history).toHaveLength(1);
    expect(profile.history[0].daysTaken).toBe(20);
  });

  it('returns a null hire date when no employee profile exists', async () => {
    const profile = await service.getVacationProfile('unknown-user');

    expect(profile.hireDate).toBeNull();
    expect(profile.history).toEqual([]);
  });

  it('updates a vacation request status and notifies the requester', async () => {
    const created = await service.createVacation('user-f', {
      startDate: '2026-11-01',
      endDate: '2026-11-10',
      days: 9,
    });

    const updated = await service.updateVacationStatus(created.id, 'aprovado');

    expect(updated.status).toBe('aprovado');
    expect(pushMock.sendToUser).toHaveBeenCalledWith(
      'user-f',
      expect.objectContaining({ title: 'Solicitação de férias' }),
    );
  });
});
