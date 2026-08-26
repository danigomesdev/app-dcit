import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export type PushMessage = {
  title: string;
  body: string;
};

// Best-effort notification delivery: a failed push (bad token, Expo API
// down, network error) must never fail the status-update it's attached to,
// so every failure path here is swallowed and logged, not thrown.
@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId },
      });
      if (tokens.length === 0) return;

      await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(
          tokens.map((t) => ({
            to: t.token,
            title: message.title,
            body: message.body,
          })),
        ),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send push notification to user ${userId}: ${String(error)}`,
      );
    }
  }
}
