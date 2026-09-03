import { Injectable } from '@nestjs/common';
import type { OneOnOneCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OneOnOnesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const records = await this.prisma.oneOnOne.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    const acoes = await this.prisma.oneOnOneAcao.findMany({
      where: { oneOnOneId: { in: records.map((r) => r.id) } },
    });
    const acoesByRecord = new Map<string, typeof acoes>();
    for (const acao of acoes) {
      const list = acoesByRecord.get(acao.oneOnOneId) ?? [];
      list.push(acao);
      acoesByRecord.set(acao.oneOnOneId, list);
    }
    return records.map((record) => ({ ...record, acoes: acoesByRecord.get(record.id) ?? [] }));
  }

  async create(gestorId: string, input: OneOnOneCreateInput) {
    const record = await this.prisma.oneOnOne.create({
      data: {
        userId: input.userId,
        gestorId,
        pauta: input.pauta,
        proximaData: input.proximaData ? new Date(input.proximaData) : undefined,
      },
    });
    if (input.acoes.length > 0) {
      await this.prisma.oneOnOneAcao.createMany({
        data: input.acoes.map((acao) => ({ oneOnOneId: record.id, descricao: acao.descricao })),
      });
    }
    const acoes = await this.prisma.oneOnOneAcao.findMany({ where: { oneOnOneId: record.id } });
    return { ...record, acoes };
  }

  updateAcaoStatus(id: string, status: string) {
    return this.prisma.oneOnOneAcao.update({ where: { id }, data: { status } });
  }
}
