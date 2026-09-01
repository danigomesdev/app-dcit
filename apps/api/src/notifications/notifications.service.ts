import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PagamentoCategoria } from '@ponto-dcit/shared-types';

const PAGAMENTO_MESSAGE: Record<PagamentoCategoria, string> = {
  salario: 'Seu salário foi depositado.',
  auxilio_home_office: 'Seu auxílio home office foi depositado.',
  vale_transporte: 'Seu vale-transporte foi depositado.',
  vale_alimentacao: 'Seu vale-alimentação foi depositado.',
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendPagamento(category: PagamentoCategoria, userIds: string[]) {
    const message = PAGAMENTO_MESSAGE[category];
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: 'pagamento',
        category,
        message,
      })),
    });
  }

  // start/end: "YYYY-MM-DD" strings computed by the caller (same pattern as
  // /banco-de-horas/equipe) — this service never decides "what month is it
  // now" itself.
  async pagamentoStatus(category: PagamentoCategoria, start: string, end: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        type: 'pagamento',
        category,
        createdAt: { gte: new Date(start), lte: new Date(`${end}T23:59:59.999Z`) },
      },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, createdAt: true },
    });
    // A colaborador may have been notified more than once in the range
    // (resend) — keep only the most recent per userId; the desc orderBy
    // above guarantees the first match per userId is already the latest.
    const seen = new Map<string, string>();
    for (const n of notifications) {
      if (!seen.has(n.userId)) seen.set(n.userId, n.createdAt.toISOString());
    }
    return Array.from(seen, ([userId, sentAt]) => ({ userId, sentAt }));
  }

  listMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(id: string, userId: string) {
    // Compound where (id + userId) instead of a separate ownership check:
    // updateMany with this where affects nothing if the id belongs to a
    // different userId, so a user can't mark someone else's notification
    // read just by guessing its id.
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }
}
