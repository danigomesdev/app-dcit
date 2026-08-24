import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OIDC_CLIENT } from './oidc-client.token';

describe('AuthService', () => {
  let service: AuthService;
  let jwt: { sign: jest.Mock };

  const clientMock = {
    authorizationUrl: jest.fn<string, [Record<string, unknown>]>(),
    callback: jest.fn(),
    userinfo: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OIDC_CLIENT, useValue: clientMock },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('builds an authorization URL requesting openid/profile/email', () => {
    clientMock.authorizationUrl.mockReturnValue(
      'https://mock-idp/auth?state=abc',
    );

    const url = service.buildAuthorizationUrl('web');

    expect(url).toBe('https://mock-idp/auth?state=abc');
    expect(clientMock.authorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'openid profile email' }),
    );
  });

  it('exchanges a valid callback and issues a session JWT with the resolved role', async () => {
    clientMock.authorizationUrl.mockReturnValue('https://mock-idp/auth');
    service.buildAuthorizationUrl('mobile');
    const { state } = clientMock.authorizationUrl.mock.calls[0][0];

    clientMock.callback.mockResolvedValue({
      claims: () => ({ sub: 'user-1' }),
    });
    clientMock.userinfo.mockResolvedValue({
      name: 'Ana Colaboradora',
      dcit_role: 'colaborador',
    });

    const result = await service.handleCallback(
      'http://localhost:3000/auth/callback',
      {
        state: state as string,
        code: 'auth-code-123',
      },
    );

    expect(result).toEqual({
      sessionToken: 'signed.jwt.token',
      origin: 'mobile',
    });
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      role: 'colaborador',
      name: 'Ana Colaboradora',
    });
  });

  it('rejects a callback with an unknown or expired state', async () => {
    await expect(
      service.handleCallback('http://localhost:3000/auth/callback', {
        state: 'never-issued',
        code: 'x',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a callback whose role claim is not one of the known roles', async () => {
    clientMock.authorizationUrl.mockReturnValue('https://mock-idp/auth');
    service.buildAuthorizationUrl('web');
    const { state } = clientMock.authorizationUrl.mock.calls[0][0];

    clientMock.callback.mockResolvedValue({
      claims: () => ({ sub: 'user-2' }),
    });
    clientMock.userinfo.mockResolvedValue({ name: 'X', dcit_role: 'admin' });

    await expect(
      service.handleCallback('http://localhost:3000/auth/callback', {
        state: state as string,
        code: 'y',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
