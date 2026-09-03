import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['list', 'create', 'updateStatus', 'remove'] as const;

describe('CareerGoalsController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      CareerGoalsController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      CareerGoalsController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('CareerGoalsController', () => {
  let controller: CareerGoalsController;
  const serviceMock = {
    list: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CareerGoalsController],
      providers: [{ provide: CareerGoalsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(CareerGoalsController);
  });

  function requestAs(): Request & { user: AuthenticatedUser } {
    return { user: { sub: 'gestor-1', role: 'gestor', name: 'Gestor Teste' } } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('lists goals for the given userId', async () => {
    serviceMock.list.mockResolvedValue([]);
    await controller.list('user-1');
    expect(serviceMock.list).toHaveBeenCalledWith('user-1');
  });

  it('parses and creates a valid goal', async () => {
    serviceMock.create.mockResolvedValue({ id: 'goal-1' });
    await controller.create({ userId: 'user-1', tipo: 'pdi', title: 'Meta' });
    expect(serviceMock.create).toHaveBeenCalledWith({ userId: 'user-1', tipo: 'pdi', title: 'Meta' });
  });

  it('rejects an invalid body on create', async () => {
    await expect(controller.create({ userId: 'user-1', tipo: 'invalido', title: 'x' })).rejects.toThrow();
  });

  it('updates status with a valid body', async () => {
    serviceMock.updateStatus.mockResolvedValue({ id: 'goal-1', status: 'concluida' });
    await controller.updateStatus('goal-1', { status: 'concluida' });
    expect(serviceMock.updateStatus).toHaveBeenCalledWith('goal-1', 'concluida');
  });

  it('removes a goal', async () => {
    await controller.remove('goal-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('goal-1');
  });

  void requestAs; // reserved for future session-scoped assertions in this file
});
