import { SetMetadata } from '@nestjs/common';
import type { Role } from '@ponto-dcit/shared-types';

export const ROLES_KEY = 'roles';

/**
 * Marks a handler as restricted to the given roles. Must be paired with
 * @UseGuards(AuthGuard, RolesGuard) — RolesGuard reads req.user.role, which
 * only AuthGuard sets.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
