import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TrackRequirementsController } from './trilha.controller';
import { TrackRequirementsService } from './trilha.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

const GUARDED_HANDLERS = ['list', 'create', 'updateStatus', 'remove'] as const;

describe('TrackRequirementsController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard + RolesGuard(gestor) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      TrackRequirementsController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      TrackRequirementsController.prototype[handlerName],
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor']);
  });
});

describe('TrackRequirementsController', () => {
  let controller: TrackRequirementsController;
  const serviceMock = { list: jest.fn(), create: jest.fn(), updateStatus: jest.fn(), remove: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrackRequirementsController],
      providers: [{ provide: TrackRequirementsService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TrackRequirementsController);
  });

  it('rejects a request missing userId on list', async () => {
    await expect(controller.list(undefined)).rejects.toThrow('userId é obrigatório');
  });

  it('parses and creates a valid requirement', async () => {
    serviceMock.create.mockResolvedValue({ id: 'req-1' });
    await controller.create({ userId: 'user-1', title: 'Curso' });
    expect(serviceMock.create).toHaveBeenCalledWith({ userId: 'user-1', title: 'Curso' });
  });

  it('rejects an invalid body on create', async () => {
    await expect(controller.create({ userId: 'user-1', title: '' })).rejects.toThrow();
  });

  it('updates status with a valid body', async () => {
    serviceMock.updateStatus.mockResolvedValue({ id: 'req-1', status: 'concluido' });
    await controller.updateStatus('req-1', { status: 'concluido' });
    expect(serviceMock.updateStatus).toHaveBeenCalledWith('req-1', 'concluido');
  });

  it('removes a requirement', async () => {
    await controller.remove('req-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('req-1');
  });
});
