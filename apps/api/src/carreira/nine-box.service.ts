import { Injectable } from '@nestjs/common';
import type { NineBoxPlacementCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NineBoxService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.nineBoxPlacement.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  create(gestorId: string, input: NineBoxPlacementCreateInput) {
    return this.prisma.nineBoxPlacement.create({
      data: {
        userId: input.userId,
        gestorId,
        desempenho: input.desempenho,
        potencial: input.potencial,
      },
    });
  }
}
