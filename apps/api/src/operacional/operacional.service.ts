import { Injectable } from '@nestjs/common';
import type { DeslocamentoInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperacionalService {
  constructor(private readonly prisma: PrismaService) {}

  async getSobreavisoStatus(userId: string) {
    const open = await this.prisma.sobreavisoRecord.findFirst({
      where: { userId, endedAt: null },
    });
    return open
      ? { active: true, startedAt: open.startedAt }
      : { active: false, startedAt: null };
  }

  async toggleSobreaviso(userId: string) {
    const open = await this.prisma.sobreavisoRecord.findFirst({
      where: { userId, endedAt: null },
    });
    if (open) {
      await this.prisma.sobreavisoRecord.update({
        where: { id: open.id },
        data: { endedAt: new Date() },
      });
      return { active: false, startedAt: null };
    }
    const created = await this.prisma.sobreavisoRecord.create({
      data: { userId, startedAt: new Date() },
    });
    return { active: true, startedAt: created.startedAt };
  }

  createDeslocamento(userId: string, input: DeslocamentoInput) {
    return this.prisma.deslocamentoRecord.create({
      data: {
        userId,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
      },
    });
  }

  listDeslocamentos(userId: string) {
    return this.prisma.deslocamentoRecord.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
    });
  }
}
