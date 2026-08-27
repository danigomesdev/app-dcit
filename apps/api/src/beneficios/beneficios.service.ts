import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BeneficiosService {
  constructor(private readonly prisma: PrismaService) {}

  listBalances(userId: string) {
    return this.prisma.benefitBalance.findMany({ where: { userId } });
  }

  async listAllBalances() {
    const balances = await this.prisma.benefitBalance.findMany({
      orderBy: { userId: 'asc' },
    });
    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: balances.map((balance) => balance.userId) } },
    });
    const nameByUserId = new Map(
      employees.map((employee) => [employee.userId, employee.name]),
    );
    return balances.map((balance) => ({
      ...balance,
      userName: nameByUserId.get(balance.userId) ?? balance.userId,
    }));
  }

  listPartners() {
    return this.prisma.partner.findMany();
  }
}
