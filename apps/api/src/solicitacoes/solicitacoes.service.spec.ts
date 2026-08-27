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
    // Scoped to this file's own fixture ids, not a blanket deleteMany(): the
    // Employee table is shared with time-entries.service.spec.ts, which runs
    // as a separate Jest worker against the same test.db — a blanket delete
    // here raced with that suite's own Employee rows and made both suites
    // flaky.
    await prisma.employee.deleteMany({
      where: { userId: { in: ['user-e', 'user-g', 'user-i', 'user-k'] } },
    });
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

  it('lists pending adjustment requests across users with the requester name joined', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-i',
        name: 'Ivo Ajustado',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    const pending = await service.createAdjustment('user-i', {
      reason: 'Esqueci de bater o ponto',
    });
    const approved = await service.createAdjustment('user-i', {
      reason: 'Outro ajuste',
    });
    await service.updateAdjustmentStatus(approved.id, 'aprovado');

    const results = await service.listPendingAdjustments();

    const ids = results.map((r) => r.id);
    expect(ids).toContain(pending.id);
    expect(ids).not.toContain(approved.id);
    expect(results.find((r) => r.id === pending.id)?.userName).toBe(
      'Ivo Ajustado',
    );
  });

  it('updates an adjustment request status and notifies the requester', async () => {
    const created = await service.createAdjustment('user-j', {
      reason: 'Esqueci de bater o ponto',
    });

    const updated = await service.updateAdjustmentStatus(
      created.id,
      'aprovado',
    );

    expect(updated.status).toBe('aprovado');
    expect(pushMock.sendToUser).toHaveBeenCalledWith(
      'user-j',
      expect.objectContaining({ title: 'Ajuste de ponto' }),
    );
  });

  it('persists the reviewNote when recusando an adjustment request', async () => {
    const created = await service.createAdjustment('user-j', {
      reason: 'Esqueci de bater o ponto',
    });

    const updated = await service.updateAdjustmentStatus(
      created.id,
      'recusado',
      'Sem batida correspondente',
    );

    expect(updated.status).toBe('recusado');
    expect(updated.reviewNote).toBe('Sem batida correspondente');
  });

  it('lists all adjustment requests regardless of status', async () => {
    const pending = await service.createAdjustment('user-j', {
      reason: 'Pendente',
    });
    const decided = await service.createAdjustment('user-j', {
      reason: 'Decidido',
    });
    await service.updateAdjustmentStatus(decided.id, 'recusado', 'Motivo');

    const results = await service.listAllAdjustments();
    const ids = results.map((r) => r.id);

    expect(ids).toContain(pending.id);
    expect(ids).toContain(decided.id);
  });

  it('lists pending compensation requests across users with the requester name joined', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-k',
        name: 'Karina Compensada',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    const pending = await service.createCompensation('user-k', {
      reason: 'Compensar 2h',
    });
    const approved = await service.createCompensation('user-k', {
      reason: 'Outra compensação',
    });
    await service.updateCompensationStatus(approved.id, 'aprovado');

    const results = await service.listPendingCompensations();

    const ids = results.map((r) => r.id);
    expect(ids).toContain(pending.id);
    expect(ids).not.toContain(approved.id);
    expect(results.find((r) => r.id === pending.id)?.userName).toBe(
      'Karina Compensada',
    );
  });

  it('updates a compensation request status and notifies the requester', async () => {
    const created = await service.createCompensation('user-l', {
      reason: 'Compensar 2h',
    });

    const updated = await service.updateCompensationStatus(
      created.id,
      'recusado',
    );

    expect(updated.status).toBe('recusado');
    expect(pushMock.sendToUser).toHaveBeenCalledWith(
      'user-l',
      expect.objectContaining({ title: 'Banco de horas' }),
    );
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

  it('lists pending vacation requests across users with the requester name joined', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-g',
        name: 'Gustavo Gestorado',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    const pending = await service.createVacation('user-g', {
      startDate: '2026-12-01',
      endDate: '2026-12-10',
      days: 9,
    });
    const approved = await service.createVacation('user-g', {
      startDate: '2027-01-05',
      endDate: '2027-01-09',
      days: 4,
    });
    await service.updateVacationStatus(approved.id, 'aprovado');
    // No Employee row for this user — the join must still return something
    // usable rather than dropping the request or throwing.
    await service.createVacation('user-h', {
      startDate: '2026-12-15',
      endDate: '2026-12-20',
      days: 5,
    });

    const results = await service.listPendingVacations();

    const ids = results.map((r) => r.id);
    expect(ids).toContain(pending.id);
    expect(ids).not.toContain(approved.id);
    expect(results.find((r) => r.id === pending.id)?.userName).toBe(
      'Gustavo Gestorado',
    );
    expect(results.find((r) => r.userId === 'user-h')?.userName).toBe('user-h');
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
