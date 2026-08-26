import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

describe('PushTokensController guard metadata', () => {
  it('applies AuthGuard to register', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PushTokensController.prototype.register,
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });
});

describe('PushTokensController', () => {
  let controller: PushTokensController;
  const serviceMock = { registerToken: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushTokensController],
      providers: [{ provide: PushTokensService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PushTokensController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('registers a token for the authenticated user', async () => {
    serviceMock.registerToken.mockResolvedValue({ id: '1' });

    await controller.register(
      { token: 'ExponentPushToken[aaa]' },
      requestAs('user-1'),
    );

    expect(serviceMock.registerToken).toHaveBeenCalledWith(
      'user-1',
      'ExponentPushToken[aaa]',
    );
  });

  it('rejects an empty token', async () => {
    await expect(
      controller.register({ token: '' }, requestAs('user-1')),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.registerToken).not.toHaveBeenCalled();
  });
});
