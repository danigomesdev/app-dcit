import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { BeneficiosController } from './beneficios.controller';
import { BeneficiosService } from './beneficios.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = [
  'listBalances',
  'listAllBalances',
  'listPartners',
] as const;

describe('BeneficiosController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      BeneficiosController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });

  it('applies RolesGuard(gestor, rh) to listAllBalances', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      BeneficiosController.prototype.listAllBalances,
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      BeneficiosController.prototype.listAllBalances,
    ) as unknown[] | undefined;

    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor', 'rh']);
  });
});

describe('BeneficiosController', () => {
  let controller: BeneficiosController;
  const serviceMock = {
    listBalances: jest.fn(),
    listAllBalances: jest.fn(),
    listPartners: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BeneficiosController],
      providers: [{ provide: BeneficiosService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(BeneficiosController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('lists balances for the authenticated user', async () => {
    serviceMock.listBalances.mockResolvedValue([]);

    await controller.listBalances(requestAs('user-1'));

    expect(serviceMock.listBalances).toHaveBeenCalledWith('user-1');
  });

  it('lists partners', async () => {
    serviceMock.listPartners.mockResolvedValue([]);

    await controller.listPartners();

    expect(serviceMock.listPartners).toHaveBeenCalled();
  });

  it('lists balances across the whole team', async () => {
    serviceMock.listAllBalances.mockResolvedValue([
      { id: '1', userId: 'user-1', userName: 'Ana', balance: 400 },
    ]);

    const result = await controller.listAllBalances();

    expect(result).toEqual([
      { id: '1', userId: 'user-1', userName: 'Ana', balance: 400 },
    ]);
    expect(serviceMock.listAllBalances).toHaveBeenCalledWith();
  });
});
