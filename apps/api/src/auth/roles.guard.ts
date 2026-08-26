import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@ponto-dcit/shared-types';
import type { AuthenticatedUser } from './authenticated-user';
import { ROLES_KEY } from './roles.decorator';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    // AuthGuard runs first (see @UseGuards ordering at each call site) and
    // throws if request.user isn't set, so this is only reachable with a
    // populated user.
    const role = request.user?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }
    return true;
  }
}
