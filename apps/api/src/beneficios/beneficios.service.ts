import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BeneficiosService {
  constructor(private readonly prisma: PrismaService) {}

  listBalances(userId: string) {
    return this.prisma.benefitBalance.findMany({ where: { userId } });
  }

  listPartners() {
    return this.prisma.partner.findMany();
  }
}
