import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  registerToken(userId: string, token: string) {
    return this.prisma.pushToken.upsert({
      where: { token },
      update: { userId },
      create: { userId, token },
    });
  }

  // Scoped to (token, userId), not just token: a device re-logs in as a
  // different user by upserting the same token to the new userId, so a
  // stale logout call from the previous user should never delete the
  // current owner's registration.
  unregisterToken(userId: string, token: string) {
    return this.prisma.pushToken.deleteMany({ where: { token, userId } });
  }
}
