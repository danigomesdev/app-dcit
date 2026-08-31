import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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

    await controller.login('web', undefined, res as unknown as Response);

    expect(authServiceMock.buildAuthorizationUrl).toHaveBeenCalledWith(
      'web',
      undefined,
    );
    expect(res.redirect).toHaveBeenCalledWith('https://mock-idp/auth');
  });

  it('defaults to web origin when none is given', async () => {
    authServiceMock.buildAuthorizationUrl.mockResolvedValue(
      'https://mock-idp/auth',
    );
    const res = mockResponse();

    await controller.login(
      undefined as unknown as string,
      undefined,
      res as unknown as Response,
    );

    expect(authServiceMock.buildAuthorizationUrl).toHaveBeenCalledWith(
      'web',
      undefined,
    );
  });

  it('passes the redirect URI through for a mobile login', async () => {
    authServiceMock.buildAuthorizationUrl.mockResolvedValue(
      'https://mock-idp/auth',
    );
    const res = mockResponse();

    await controller.login(
      'mobile',
      'exp://192.168.1.16:8081/--/auth-callback',
      res as unknown as Response,
    );

    expect(authServiceMock.buildAuthorizationUrl).toHaveBeenCalledWith(
      'mobile',
      'exp://192.168.1.16:8081/--/auth-callback',
    );
  });

  it('sets a session cookie and redirects for a web callback', async () => {
    authServiceMock.handleCallback.mockResolvedValue({
      sessionToken: 'jwt-1',
      origin: 'web',
      role: 'gestor',
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

  it('sets a session cookie and redirects for a colaborador web callback too', async () => {
    // The web portal now has real colaborador-facing pages (bater ponto,
    // histórico, folha) — colaborador no longer gets refused here, same
    // treatment as gestor/rh.
    authServiceMock.handleCallback.mockResolvedValue({
      sessionToken: 'jwt-1',
      origin: 'web',
      role: 'colaborador',
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
  });

  it('redirects to the mobile redirect URI with the token for a mobile callback', async () => {
    authServiceMock.handleCallback.mockResolvedValue({
      sessionToken: 'jwt-2',
      origin: 'mobile',
      mobileRedirectUri: 'exp://192.168.1.16:8081/--/auth-callback',
    });
    const req = { query: { state: 's', code: 'c' } } as unknown as Request;
    const res = mockResponse();

    await controller.callback(req, res as unknown as Response);

    expect(res.redirect).toHaveBeenCalledWith(
      'exp://192.168.1.16:8081/--/auth-callback?token=jwt-2',
    );
    expect(res.json).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects a mobile callback with no redirect URI on record', async () => {
    authServiceMock.handleCallback.mockResolvedValue({
      sessionToken: 'jwt-2',
      origin: 'mobile',
      mobileRedirectUri: undefined,
    });
    const req = { query: { state: 's', code: 'c' } } as unknown as Request;
    const res = mockResponse();

    await expect(
      controller.callback(req, res as unknown as Response),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears the session cookie on logout', () => {
    const res = mockResponse();

    controller.logout(res as unknown as Response);

    expect(res.clearCookie).toHaveBeenCalledWith('ponto_session');
  });
});
