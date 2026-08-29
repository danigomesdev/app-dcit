import { Injectable, NotFoundException } from '@nestjs/common';
import { ConvencaoInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConvencoesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.convencaoColetiva.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  create(input: ConvencaoInput) {
    return this.prisma.convencaoColetiva.create({ data: input });
  }

  async update(id: string, input: ConvencaoInput) {
    const existing = await this.prisma.convencaoColetiva.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Convenção coletiva não encontrada.');
    }
    return this.prisma.convencaoColetiva.update({ where: { id }, data: input });
  }

  // deleteMany (not delete): idempotent on a missing id — a double-click on
  // "Excluir" or two RH sessions deleting the same convenção must not 500
  // on the second call, matching the deleteShift precedent in
  // apps/api/src/operacional/operacional.service.ts.
  delete(id: string) {
    return this.prisma.convencaoColetiva.deleteMany({ where: { id } });
  }
}
