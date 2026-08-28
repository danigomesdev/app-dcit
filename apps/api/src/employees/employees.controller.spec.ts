import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('EmployeesController guard metadata', () => {
  it('applies AuthGuard and RolesGuard to list, restricted to gestor/rh', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.list,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.list,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['gestor', 'rh']);
  });

  it('applies AuthGuard and RolesGuard to updateSchedule, restricted to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updateSchedule,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      EmployeesController.prototype.updateSchedule,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });
});

describe('EmployeesController', () => {
  let controller: EmployeesController;
  const serviceMock = { list: jest.fn(), updateSchedule: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [{ provide: EmployeesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EmployeesController);
  });

  it('returns the employee roster', async () => {
    serviceMock.list.mockResolvedValue([{ userId: 'user-1', name: 'Ana' }]);

    const result = await controller.list();

    expect(result).toEqual([{ userId: 'user-1', name: 'Ana' }]);
    expect(serviceMock.list).toHaveBeenCalledWith();
  });

  it('updates the schedule with a valid payload', async () => {
    serviceMock.updateSchedule.mockResolvedValue({
      userId: 'user-1',
      expectedStartTime: '09:00',
    });

    await controller.updateSchedule('user-1', { expectedStartTime: '09:00' });

    expect(serviceMock.updateSchedule).toHaveBeenCalledWith('user-1', {
      expectedStartTime: '09:00',
    });
  });

  it('accepts null to clear the schedule', async () => {
    serviceMock.updateSchedule.mockResolvedValue({
      userId: 'user-1',
      expectedStartTime: null,
    });

    await controller.updateSchedule('user-1', { expectedStartTime: null });

    expect(serviceMock.updateSchedule).toHaveBeenCalledWith('user-1', {
      expectedStartTime: null,
    });
  });

  it('rejects a malformed time before calling the service', async () => {
    await expect(
      controller.updateSchedule('user-1', { expectedStartTime: '9am' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updateSchedule).not.toHaveBeenCalled();
  });
});
