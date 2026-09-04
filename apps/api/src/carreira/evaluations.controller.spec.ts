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
