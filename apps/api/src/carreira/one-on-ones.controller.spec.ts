import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { OneOnOnesController } from './one-on-ones.controller';
import { OneOnOnesService } from './one-on-ones.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['list', 'create', 'updateAcaoStatus'] as const;

describe('OneOnOnesController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OneOnOnesController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OneOnOnesController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('OneOnOnesController', () => {
  let controller: OneOnOnesController;
  const serviceMock = { list: jest.fn(), create: jest.fn(), updateAcaoStatus: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OneOnOnesController],
      providers: [{ provide: OneOnOnesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(OneOnOnesController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return { user: { sub, role: 'gestor', name: 'Gestor Teste' } } as Request & { user: AuthenticatedUser };
  }

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('creates using gestorId from the session', async () => {
    serviceMock.create.mockResolvedValue({ id: 'oo-1', acoes: [] });
    await controller.create({ userId: 'user-1', pauta: 'Conversa' }, requestAs('gestor-1'));
    expect(serviceMock.create).toHaveBeenCalledWith('gestor-1', { userId: 'user-1', pauta: 'Conversa', acoes: [] });
  });

  it('rejects an invalid body on create', async () => {
    await expect(controller.create({ userId: 'user-1', pauta: '' }, requestAs('gestor-1'))).rejects.toThrow();
  });

  it('updates an acao status with a valid body', async () => {
    serviceMock.updateAcaoStatus.mockResolvedValue({ id: 'acao-1', status: 'concluido' });
    await controller.updateAcaoStatus('acao-1', { status: 'concluido' });
    expect(serviceMock.updateAcaoStatus).toHaveBeenCalledWith('acao-1', 'concluido');
  });
});
