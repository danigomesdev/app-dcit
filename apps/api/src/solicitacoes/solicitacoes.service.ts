import { Injectable } from '@nestjs/common';
import type {
  AdjustmentRequestInput,
  CompensationRequestInput,
  VacationRequestInput,
} from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';

@Injectable()
export class SolicitacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: ExpoPushService,
  ) {}

  createAdjustment(userId: string, input: AdjustmentRequestInput) {
    return this.prisma.adjustmentRequest.create({
      data: { userId, reason: input.reason },
    });
  }

  listAdjustments(userId: string) {
    return this.prisma.adjustmentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createCompensation(userId: string, input: CompensationRequestInput) {
    return this.prisma.compensationRequest.create({
      data: { userId, reason: input.reason },
    });
  }

  listCompensations(userId: string) {
    return this.prisma.compensationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createVacation(userId: string, input: VacationRequestInput) {
    return this.prisma.vacationRequest.create({
      data: {
        userId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        days: input.days,
      },
    });
  }

  listVacations(userId: string) {
    return this.prisma.vacationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPendingVacations() {
    const requests = await this.prisma.vacationRequest.findMany({
      where: { status: 'pendente' },
      orderBy: { createdAt: 'asc' },
    });
    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: requests.map((request) => request.userId) } },
    });
    const nameByUserId = new Map(
      employees.map((employee) => [employee.userId, employee.name]),
    );
    return requests.map((request) => ({
      ...request,
      userName: nameByUserId.get(request.userId) ?? request.userId,
    }));
  }

  async updateVacationStatus(id: string, status: 'aprovado' | 'recusado') {
    const updated = await this.prisma.vacationRequest.update({
      where: { id },
      data: { status },
    });
    void this.push.sendToUser(updated.userId, {
      title: 'Solicitação de férias',
      body:
        status === 'aprovado'
          ? 'Sua solicitação de férias foi aprovada.'
          : 'Sua solicitação de férias foi recusada.',
    });
    return updated;
  }

  async getVacationProfile(userId: string) {
    const [employee, history] = await Promise.all([
      this.prisma.employee.findUnique({ where: { userId } }),
      this.prisma.vacationHistoryEntry.findMany({
        where: { userId },
        orderBy: { year: 'desc' },
      }),
    ]);
    return { hireDate: employee?.hireDate ?? null, history };
  }
}
