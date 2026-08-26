import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { OperacionalController } from './operacional.controller';
import { OperacionalService } from './operacional.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = [
  'getSobreavisoStatus',
  'toggleSobreaviso',
  'createDeslocamento',
  'listDeslocamentos',
] as const;

describe('OperacionalController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OperacionalController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });
});

describe('OperacionalController', () => {
  let controller: OperacionalController;
  const serviceMock = {
    getSobreavisoStatus: jest.fn(),
    toggleSobreaviso: jest.fn(),
    createDeslocamento: jest.fn(),
    listDeslocamentos: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperacionalController],
      providers: [{ provide: OperacionalService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OperacionalController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('gets sobreaviso status for the authenticated user', async () => {
    serviceMock.getSobreavisoStatus.mockResolvedValue({
      active: false,
      startedAt: null,
    });

    await controller.getSobreavisoStatus(requestAs('user-1'));

    expect(serviceMock.getSobreavisoStatus).toHaveBeenCalledWith('user-1');
  });

  it('toggles sobreaviso for the authenticated user', async () => {
    serviceMock.toggleSobreaviso.mockResolvedValue({
      active: true,
      startedAt: new Date(),
    });

    await controller.toggleSobreaviso(requestAs('user-1'));

    expect(serviceMock.toggleSobreaviso).toHaveBeenCalledWith('user-1');
  });

  it('rejects an invalid deslocamento payload', async () => {
    await expect(
      controller.createDeslocamento(
        { startedAt: 'not-a-date' },
        requestAs('user-1'),
      ),
    ).rejects.toThrow();
    expect(serviceMock.createDeslocamento).not.toHaveBeenCalled();
  });

  it('creates a deslocamento for the authenticated user', async () => {
    const payload = {
      startedAt: '2026-08-20T10:00:00.000Z',
      endedAt: '2026-08-20T10:30:00.000Z',
    };
    serviceMock.createDeslocamento.mockResolvedValue({ id: '1', ...payload });

    await controller.createDeslocamento(payload, requestAs('user-1'));

    expect(serviceMock.createDeslocamento).toHaveBeenCalledWith(
      'user-1',
      payload,
    );
  });

  it('lists deslocamentos for the authenticated user', async () => {
    serviceMock.listDeslocamentos.mockResolvedValue([]);

    await controller.listDeslocamentos(requestAs('user-1'));

    expect(serviceMock.listDeslocamentos).toHaveBeenCalledWith('user-1');
  });
});
