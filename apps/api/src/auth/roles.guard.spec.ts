import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { AuthenticatedUser } from './authenticated-user';

describe('RolesGuard', () => {
  const reflectorMock = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflectorMock as unknown as Reflector);

  function contextWithUser(user?: AuthenticatedUser): ExecutionContext {
    const request: Record<string, unknown> = user ? { user } : {};
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it('allows the request when no @Roles() metadata is present', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);

    expect(
      guard.canActivate(
        contextWithUser({ sub: 'u1', role: 'colaborador', name: 'Ana' }),
      ),
    ).toBe(true);
  });

  it('allows the request when the user has one of the required roles', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['rh', 'gestor']);

    expect(
      guard.canActivate(
        contextWithUser({ sub: 'u1', role: 'rh', name: 'Carla' }),
      ),
    ).toBe(true);
  });

  it('rejects a request whose role is not in the required list', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['rh', 'gestor']);

    expect(() =>
      guard.canActivate(
        contextWithUser({ sub: 'u1', role: 'colaborador', name: 'Ana' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a request with no authenticated user', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['rh']);

    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
