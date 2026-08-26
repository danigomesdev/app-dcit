import type { Role } from '@ponto-dcit/shared-types';

export type AuthenticatedUser = {
  sub: string;
  role: Role;
  name: string;
};
