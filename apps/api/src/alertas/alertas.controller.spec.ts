import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

describe('AlertasController guard metadata', () => {
  it('applies AuthGuard only to getMine', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AlertasController.prototype.getMine,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).not.toContain(RolesGuard);
  });

  it('applies AuthGuard and RolesGuard to listAll, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AlertasController.prototype.listAll,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AlertasController.prototype.listAll,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });
});

describe('AlertasController', () => {
  let controller: AlertasController;
  const serviceMock = { listForUser: jest.fn(), listAll: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertasController],
      providers: [{ provide: AlertasService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AlertasController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & { user: AuthenticatedUser };
  }

  it("returns the caller's own alerts", async () => {
    serviceMock.listForUser.mockResolvedValue([{ id: 'alert-1' }]);

    const result = await controller.getMine(requestAs('user-1'));

    expect(result).toEqual([{ id: 'alert-1' }]);
    expect(serviceMock.listForUser).toHaveBeenCalledWith('user-1');
  });

  it('returns every alert for gestor/rh', async () => {
    serviceMock.listAll.mockResolvedValue([{ id: 'alert-2' }]);

    const result = await controller.listAll();

    expect(result).toEqual([{ id: 'alert-2' }]);
  });
});
