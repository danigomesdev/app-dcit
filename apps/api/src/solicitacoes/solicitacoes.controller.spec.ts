import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { SolicitacoesController } from './solicitacoes.controller';
import { SolicitacoesService } from './solicitacoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = [
  'createAdjustment',
  'listAdjustments',
  'createCompensation',
  'listCompensations',
  'createVacation',
  'getFerias',
] as const;

describe('SolicitacoesController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      SolicitacoesController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });

  it('applies AuthGuard and RolesGuard to updateVacationStatus, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      SolicitacoesController.prototype.updateVacationStatus,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      SolicitacoesController.prototype.updateVacationStatus,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to listPendingVacations, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      SolicitacoesController.prototype.listPendingVacations,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      SolicitacoesController.prototype.listPendingVacations,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });
});

describe('SolicitacoesController', () => {
  let controller: SolicitacoesController;
  const serviceMock = {
    createAdjustment: jest.fn(),
    listAdjustments: jest.fn(),
    createCompensation: jest.fn(),
    listCompensations: jest.fn(),
    createVacation: jest.fn(),
    listVacations: jest.fn(),
    getVacationProfile: jest.fn(),
    updateVacationStatus: jest.fn(),
    listPendingVacations: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SolicitacoesController],
      providers: [{ provide: SolicitacoesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SolicitacoesController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('creates an adjustment request for the authenticated user', async () => {
    serviceMock.createAdjustment.mockResolvedValue({ id: '1' });

    await controller.createAdjustment(
      { reason: 'Motivo' },
      requestAs('user-1'),
    );

    expect(serviceMock.createAdjustment).toHaveBeenCalledWith('user-1', {
      reason: 'Motivo',
    });
  });

  it('rejects an invalid adjustment payload', async () => {
    await expect(
      controller.createAdjustment({ reason: '' }, requestAs('user-1')),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createAdjustment).not.toHaveBeenCalled();
  });

  it('creates a compensation request for the authenticated user', async () => {
    serviceMock.createCompensation.mockResolvedValue({ id: '1' });

    await controller.createCompensation(
      { reason: 'Compensar' },
      requestAs('user-1'),
    );

    expect(serviceMock.createCompensation).toHaveBeenCalledWith('user-1', {
      reason: 'Compensar',
    });
  });

  it('creates a vacation request for the authenticated user', async () => {
    serviceMock.createVacation.mockResolvedValue({ id: '1' });

    await controller.createVacation(
      { startDate: '2026-10-05', endDate: '2026-10-14', days: 10 },
      requestAs('user-1'),
    );

    expect(serviceMock.createVacation).toHaveBeenCalledWith('user-1', {
      startDate: '2026-10-05',
      endDate: '2026-10-14',
      days: 10,
    });
  });

  it('rejects a vacation request with a non-date-only startDate', async () => {
    await expect(
      controller.createVacation(
        {
          startDate: '2026-10-05T00:00:00.000Z',
          endDate: '2026-10-14',
          days: 10,
        },
        requestAs('user-1'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createVacation).not.toHaveBeenCalled();
  });

  it('bundles vacation requests with the employee profile', async () => {
    serviceMock.listVacations.mockResolvedValue([{ id: '1' }]);
    serviceMock.getVacationProfile.mockResolvedValue({
      hireDate: new Date('2024-03-15'),
      history: [],
    });

    const result = await controller.getFerias(requestAs('user-1'));

    expect(result).toEqual({
      requests: [{ id: '1' }],
      hireDate: new Date('2024-03-15'),
      history: [],
    });
  });

  it('updates a vacation request status', async () => {
    serviceMock.updateVacationStatus.mockResolvedValue({
      id: '1',
      status: 'aprovado',
    });

    await controller.updateVacationStatus('1', { status: 'aprovado' });

    expect(serviceMock.updateVacationStatus).toHaveBeenCalledWith(
      '1',
      'aprovado',
    );
  });

  it('rejects an invalid vacation status payload', async () => {
    await expect(
      controller.updateVacationStatus('1', { status: 'invalido' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updateVacationStatus).not.toHaveBeenCalled();
  });

  it('lists pending vacation requests', async () => {
    serviceMock.listPendingVacations.mockResolvedValue([
      { id: '1', userId: 'user-1', userName: 'Ana' },
    ]);

    const result = await controller.listPendingVacations();

    expect(result).toEqual([{ id: '1', userId: 'user-1', userName: 'Ana' }]);
    expect(serviceMock.listPendingVacations).toHaveBeenCalledWith();
  });
});
