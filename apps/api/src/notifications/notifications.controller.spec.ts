import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NotificationsController } from './notifications.controller';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('NotificationsController guard metadata', () => {
  it('restricts sendPagamento to rh only', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.sendPagamento,
    ) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.sendPagamento,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('restricts pagamentoStatus to rh only', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.pagamentoStatus,
    ) as unknown[] | undefined;
    expect(roles).toEqual(['rh']);
  });

  it('applies only AuthGuard (no role restriction) to listMine', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.listMine,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });

  it('applies only AuthGuard (no role restriction) to markRead', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NotificationsController.prototype.markRead,
    ) as unknown[] | undefined;
    expect(guards).toEqual([AuthGuard]);
  });
});
