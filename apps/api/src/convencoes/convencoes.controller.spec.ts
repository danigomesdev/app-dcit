import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConvencoesController } from './convencoes.controller';
import { ConvencoesService } from './convencoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('ConvencoesController guard metadata', () => {
  it('applies AuthGuard and RolesGuard to list, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.list,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.list,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to create, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.create,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.create,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('applies AuthGuard and RolesGuard to update, restricted to rh only', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.update,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('applies AuthGuard and RolesGuard to remove, restricted to rh only', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ConvencoesController.prototype.remove,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });
});

describe('ConvencoesController', () => {
  let controller: ConvencoesController;
  const serviceMock = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConvencoesController],
      providers: [{ provide: ConvencoesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ConvencoesController);
  });

  const VALID_BODY = {
    nome: 'Convenção X',
    cnpj: null,
    categoriaSindical: null,
    expectedDailyMinutes: 480,
    overtimePercent: 50,
  };

  it('returns the convenção list', async () => {
    serviceMock.list.mockResolvedValue([{ id: 'c1' }]);

    const result = await controller.list();

    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('creates a convenção with a valid payload', async () => {
    serviceMock.create.mockResolvedValue({ id: 'generated-id', ...VALID_BODY });

    await controller.create(VALID_BODY);

    expect(serviceMock.create).toHaveBeenCalledWith(VALID_BODY);
  });

  it('rejects an invalid payload before calling the service on create', async () => {
    await expect(
      controller.create({ ...VALID_BODY, expectedDailyMinutes: -1 }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  it('updates a convenção with a valid payload', async () => {
    serviceMock.update.mockResolvedValue({ id: 'c1', ...VALID_BODY });

    await controller.update('c1', VALID_BODY);

    expect(serviceMock.update).toHaveBeenCalledWith('c1', VALID_BODY);
  });

  it('deletes a convenção', async () => {
    serviceMock.delete.mockResolvedValue(undefined);

    await controller.remove('c1');

    expect(serviceMock.delete).toHaveBeenCalledWith('c1');
  });
});
