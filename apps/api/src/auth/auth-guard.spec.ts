import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth-guard';

describe('AuthGuard', () => {
  const jwtMock = { verify: jest.fn() };
  const guard = new AuthGuard(jwtMock as unknown as JwtService);

  function contextWithHeader(header?: string): ExecutionContext {
    const request: Record<string, unknown> = {
      headers: header ? { authorization: header } : {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it('allows the request and attaches the decoded user when the token is valid', () => {
    jwtMock.verify.mockReturnValue({
      sub: 'user-1',
      role: 'colaborador',
      name: 'Ana',
    });
    const context = contextWithHeader('Bearer good-token');

    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest<{ user: unknown }>();
    expect(request.user).toEqual({
      sub: 'user-1',
      role: 'colaborador',
      name: 'Ana',
    });
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => guard.canActivate(contextWithHeader())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a request whose token fails verification', () => {
    jwtMock.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    expect(() =>
      guard.canActivate(contextWithHeader('Bearer bad-token')),
    ).toThrow(UnauthorizedException);
  });
});
