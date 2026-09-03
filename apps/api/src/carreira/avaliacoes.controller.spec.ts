import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { PerformanceEvaluationsController } from './avaliacoes.controller';
import { PerformanceEvaluationsService } from './avaliacoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['list', 'create'] as const;

describe('PerformanceEvaluationsController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PerformanceEvaluationsController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PerformanceEvaluationsController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('PerformanceEvaluationsController', () => {
  let controller: PerformanceEvaluationsController;
  const serviceMock = { list: jest.fn(), create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceEvaluationsController],
      providers: [{ provide: PerformanceEvaluationsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(PerformanceEvaluationsController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return { user: { sub, role: 'gestor', name: 'Gestor Teste' } } as Request & { user: AuthenticatedUser };
  }

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('creates using evaluatorId from the session, not the body', async () => {
    serviceMock.create.mockResolvedValue({ id: 'ev-1' });
    await controller.create(
      { userId: 'user-1', proatividade: 4, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 },
      requestAs('gestor-1'),
    );
    expect(serviceMock.create).toHaveBeenCalledWith('gestor-1', {
      userId: 'user-1',
      proatividade: 4,
      trabalhoEquipe: 4,
      comunicacao: 4,
      lideranca: 4,
    });
  });

  it('rejects an invalid body on create', async () => {
    await expect(
      controller.create({ userId: 'user-1', proatividade: 9, trabalhoEquipe: 4, comunicacao: 4, lideranca: 4 }, requestAs('gestor-1')),
    ).rejects.toThrow();
  });
});
