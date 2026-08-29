import { Injectable } from '@nestjs/common';
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

  update(id: string, input: ConvencaoInput) {
    return this.prisma.convencaoColetiva.update({ where: { id }, data: input });
  }

  delete(id: string) {
    return this.prisma.convencaoColetiva.delete({ where: { id } });
  }
}
