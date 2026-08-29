import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { BancoDeHorasController } from './banco-de-horas.controller';
import { BancoDeHorasService } from './banco-de-horas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

describe('BancoDeHorasController guard metadata', () => {
  it('applies AuthGuard only to getMinhas', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      BancoDeHorasController.prototype.getMinhas,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).not.toContain(RolesGuard);
  });

  it('applies AuthGuard and RolesGuard to getEquipe, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      BancoDeHorasController.prototype.getEquipe,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      BancoDeHorasController.prototype.getEquipe,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });
});

describe('BancoDeHorasController', () => {
  let controller: BancoDeHorasController;
  const serviceMock = { getSummary: jest.fn(), getTeamSummary: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BancoDeHorasController],
      providers: [{ provide: BancoDeHorasService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(BancoDeHorasController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & { user: AuthenticatedUser };
  }

  it('resolves the default period and returns the summary for the authenticated user', async () => {
    serviceMock.getSummary.mockResolvedValue({ days: [], balanceMinutes: 0 });

    await controller.getMinhas({}, requestAs('user-1'));

    expect(serviceMock.getSummary).toHaveBeenCalledWith(
      'user-1',
      expect.stringMatching(/^\d{4}-\d{2}-01$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('uses explicit start/end query params when given', async () => {
    serviceMock.getSummary.mockResolvedValue({ days: [] });

    await controller.getMinhas(
      { start: '2026-01-01', end: '2026-01-15' },
      requestAs('user-1'),
    );

    expect(serviceMock.getSummary).toHaveBeenCalledWith(
      'user-1',
      '2026-01-01',
      '2026-01-15',
    );
  });

  it('rejects a malformed start param before calling the service', async () => {
    await expect(
      controller.getMinhas({ start: 'not-a-date' }, requestAs('user-1')),
    ).rejects.toThrow();
    expect(serviceMock.getSummary).not.toHaveBeenCalled();
  });

  it('returns the team summary for gestor/rh', async () => {
    serviceMock.getTeamSummary.mockResolvedValue([
      { userId: 'u1', userName: 'Ana' },
    ]);

    const result = await controller.getEquipe({});

    expect(result).toEqual([{ userId: 'u1', userName: 'Ana' }]);
  });

  describe('period validation', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('rejects start after end on getMinhas without calling the service', async () => {
      await expect(
        controller.getMinhas(
          { start: '2026-02-01', end: '2026-01-01' },
          requestAs('user-1'),
        ),
      ).rejects.toThrow();
      expect(serviceMock.getSummary).not.toHaveBeenCalled();
    });

    it('rejects start after end on getEquipe without calling the service', async () => {
      await expect(
        controller.getEquipe({ start: '2026-02-01', end: '2026-01-01' }),
      ).rejects.toThrow();
      expect(serviceMock.getTeamSummary).not.toHaveBeenCalled();
    });

    it('clamps an end date in the future to today (São Paulo) instead of throwing', async () => {
      // 13:00 UTC is 10:00 in São Paulo (UTC-3), so "today" stays the same
      // calendar day in both zones for this instant.
      jest.useFakeTimers().setSystemTime(new Date('2026-08-19T13:00:00.000Z'));
      serviceMock.getSummary.mockResolvedValue({ days: [], balanceMinutes: 0 });

      await controller.getMinhas(
        { start: '2026-08-01', end: '2026-12-31' },
        requestAs('user-1'),
      );

      expect(serviceMock.getSummary).toHaveBeenCalledWith(
        'user-1',
        '2026-08-01',
        '2026-08-19',
      );
    });

    it('clamps an end date in the future to today (São Paulo) on getEquipe as well', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-19T13:00:00.000Z'));
      serviceMock.getTeamSummary.mockResolvedValue([]);

      await controller.getEquipe({ start: '2026-08-01', end: '2026-12-31' });

      expect(serviceMock.getTeamSummary).toHaveBeenCalledWith(
        '2026-08-01',
        '2026-08-19',
      );
    });

    it('rejects a period spanning more than 366 days', async () => {
      await expect(
        controller.getMinhas(
          { start: '2020-01-01', end: '2021-06-01' },
          requestAs('user-1'),
        ),
      ).rejects.toThrow();
      expect(serviceMock.getSummary).not.toHaveBeenCalled();
    });
  });
});
