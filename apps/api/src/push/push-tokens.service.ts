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
}
