import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authServiceMock = {
    buildAuthorizationUrl: jest.fn(),
    handleCallback: jest.fn(),
  };

  function mockResponse() {
    return {
      redirect: jest.fn(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile();

    controller = module.get(AuthController);
  });

  it('redirects to the authorization URL for a web login', async () => {
    authServiceMock.buildAuthorizationUrl.mockResolvedValue(
      'https://mock-idp/auth',
    );
    const res = mockResponse();

    await controller.login('web', res as unknown as Response);

    expect(authServiceMock.buildAuthorizationUrl).toHaveBeenCalledWith('web');
    expect(res.redirect).toHaveBeenCalledWith('https://mock-idp/auth');
  });

  it('defaults to web origin when none is given', async () => {
    authServiceMock.buildAuthorizationUrl.mockResolvedValue(
      'https://mock-idp/auth',
    );
    const res = mockResponse();

    await controller.login(
      undefined as unknown as string,
      res as unknown as Response,
    );

    expect(authServiceMock.buildAuthorizationUrl).toHaveBeenCalledWith('web');
  });

  it('sets a session cookie and redirects for a web callback', async () => {
    authServiceMock.handleCallback.mockResolvedValue({
      sessionToken: 'jwt-1',
      origin: 'web',
    });
    const req = { query: { state: 's', code: 'c' } } as unknown as Request;
    const res = mockResponse();

    await controller.callback(req, res as unknown as Response);

    expect(res.cookie).toHaveBeenCalledWith(
      'ponto_session',
      'jwt-1',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.redirect).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns the token as JSON for a mobile callback', async () => {
    authServiceMock.handleCallback.mockResolvedValue({
      sessionToken: 'jwt-2',
      origin: 'mobile',
    });
    const req = { query: { state: 's', code: 'c' } } as unknown as Request;
    const res = mockResponse();

    await controller.callback(req, res as unknown as Response);

    expect(res.json).toHaveBeenCalledWith({ token: 'jwt-2' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('clears the session cookie on logout', () => {
    const res = mockResponse();

    controller.logout(res as unknown as Response);

    expect(res.clearCookie).toHaveBeenCalledWith('ponto_session');
  });
});
