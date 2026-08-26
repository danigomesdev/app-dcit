import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = ['getTasks', 'toggleTask'] as const;

describe('OnboardingController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OnboardingController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });
});

describe('OnboardingController', () => {
  let controller: OnboardingController;
  const serviceMock = {
    getTasks: jest.fn(),
    toggleTask: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [{ provide: OnboardingService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OnboardingController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('gets tasks for the authenticated user', async () => {
    serviceMock.getTasks.mockResolvedValue({ tasks: [], completedTaskIds: [] });

    await controller.getTasks(requestAs('user-1'));

    expect(serviceMock.getTasks).toHaveBeenCalledWith('user-1');
  });

  it('toggles a task for the authenticated user', async () => {
    serviceMock.toggleTask.mockResolvedValue({ completed: true });

    await controller.toggleTask('task-1', requestAs('user-1'));

    expect(serviceMock.toggleTask).toHaveBeenCalledWith('user-1', 'task-1');
  });
});
