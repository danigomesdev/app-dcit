import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { OperacionalController } from './operacional.controller';
import { OperacionalService } from './operacional.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
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

  it('applies AuthGuard to listShifts (no RolesGuard — visible to any authenticated user)', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OperacionalController.prototype.listShifts,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).not.toContain(RolesGuard);
  });

  it('applies AuthGuard and RolesGuard to createShift, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OperacionalController.prototype.createShift,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OperacionalController.prototype.createShift,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to deleteShift, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OperacionalController.prototype.deleteShift,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OperacionalController.prototype.deleteShift,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });
});

describe('OperacionalController', () => {
  let controller: OperacionalController;
  const serviceMock = {
    getSobreavisoStatus: jest.fn(),
    toggleSobreaviso: jest.fn(),
    createDeslocamento: jest.fn(),
    listDeslocamentos: jest.fn(),
    listShifts: jest.fn(),
    createShift: jest.fn(),
    deleteShift: jest.fn(),
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

  it('lists shifts for the resolved week range', async () => {
    serviceMock.listShifts.mockResolvedValue([
      {
        id: '1',
        date: new Date('2026-09-01'),
        label: 'Manhã',
        userId: 'user-1',
        userName: 'Ana',
      },
    ]);

    const result = await controller.listShifts({
      start: '2026-09-01',
      end: '2026-09-07',
    });

    expect(serviceMock.listShifts).toHaveBeenCalledWith(
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-07T23:59:59.999Z'),
    );
    expect(result).toHaveLength(1);
  });

  it('rejects a malformed start query param', async () => {
    await expect(controller.listShifts({ start: 'garbage' })).rejects.toThrow(
      BadRequestException,
    );
    expect(serviceMock.listShifts).not.toHaveBeenCalled();
  });

  it('accepts a request with no query params at all', async () => {
    serviceMock.listShifts.mockResolvedValue([]);
    await controller.listShifts({});
    expect(serviceMock.listShifts).toHaveBeenCalled();
  });

  it('creates a shift with a valid payload', async () => {
    serviceMock.createShift.mockResolvedValue({ id: '1' });

    await controller.createShift({
      date: '2026-09-01',
      label: 'Manhã',
      userId: 'user-1',
    });

    expect(serviceMock.createShift).toHaveBeenCalledWith({
      date: '2026-09-01',
      label: 'Manhã',
      userId: 'user-1',
    });
  });

  it('rejects an invalid shift payload', async () => {
    await expect(
      controller.createShift({
        date: '2026-09-01',
        label: '',
        userId: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createShift).not.toHaveBeenCalled();
  });

  it('deletes a shift', async () => {
    serviceMock.deleteShift.mockResolvedValue(undefined);

    await controller.deleteShift('1');

    expect(serviceMock.deleteShift).toHaveBeenCalledWith('1');
  });
});
