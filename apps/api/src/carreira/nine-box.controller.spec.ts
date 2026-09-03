import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { NineBoxController } from './nine-box.controller';
import { NineBoxService } from './nine-box.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['list', 'create'] as const;

describe('NineBoxController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NineBoxController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NineBoxController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('NineBoxController', () => {
  let controller: NineBoxController;
  const serviceMock = { list: jest.fn(), create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NineBoxController],
      providers: [{ provide: NineBoxService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(NineBoxController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return { user: { sub, role: 'gestor', name: 'Gestor Teste' } } as Request & { user: AuthenticatedUser };
  }

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('creates using gestorId from the session', async () => {
    serviceMock.create.mockResolvedValue({ id: 'nb-1' });
    await controller.create({ userId: 'user-1', desempenho: 'alto', potencial: 'medio' }, requestAs('gestor-1'));
    expect(serviceMock.create).toHaveBeenCalledWith('gestor-1', { userId: 'user-1', desempenho: 'alto', potencial: 'medio' });
  });

  it('rejects an invalid body on create', async () => {
    await expect(
      controller.create({ userId: 'user-1', desempenho: 'excelente', potencial: 'medio' }, requestAs('gestor-1')),
    ).rejects.toThrow();
  });
});
