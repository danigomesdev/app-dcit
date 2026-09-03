import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PromotabilidadeController } from './promotabilidade.controller';
import { PromotabilidadeService } from './promotabilidade.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

const GUARDED_HANDLERS = ['listAll', 'getOne'] as const;

describe('PromotabilidadeController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PromotabilidadeController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PromotabilidadeController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('PromotabilidadeController', () => {
  let controller: PromotabilidadeController;
  const serviceMock = { listAll: jest.fn(), getOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotabilidadeController],
      providers: [{ provide: PromotabilidadeService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(PromotabilidadeController);
  });

  it('returns the batch map', async () => {
    serviceMock.listAll.mockResolvedValue({ 'user-1': 'verde' });
    const result = await controller.listAll();
    expect(result).toEqual({ 'user-1': 'verde' });
  });

  it('returns the detail for a single userId', async () => {
    serviceMock.getOne.mockResolvedValue({ status: 'amarelo' });
    const result = await controller.getOne('user-1');
    expect(serviceMock.getOne).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ status: 'amarelo' });
  });
});
