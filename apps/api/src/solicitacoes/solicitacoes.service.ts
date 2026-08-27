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

  async listPendingAdjustments() {
    const requests = await this.prisma.adjustmentRequest.findMany({
      where: { status: 'pendente' },
      orderBy: { createdAt: 'asc' },
    });
    return this.withRequesterNames(requests);
  }

  async listAllAdjustments() {
    const requests = await this.prisma.adjustmentRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return this.withRequesterNames(requests);
  }

  async updateAdjustmentStatus(
    id: string,
    status: 'aprovado' | 'recusado',
    reviewNote?: string,
  ) {
    const updated = await this.prisma.adjustmentRequest.update({
      where: { id },
      data: { status, reviewNote: status === 'recusado' ? reviewNote : null },
    });
    void this.push.sendToUser(updated.userId, {
      title: 'Ajuste de ponto',
      body:
        status === 'aprovado'
          ? 'Sua solicitação de ajuste de ponto foi aprovada.'
          : 'Sua solicitação de ajuste de ponto foi recusada.',
    });
    return updated;
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

  async listPendingCompensations() {
    const requests = await this.prisma.compensationRequest.findMany({
      where: { status: 'pendente' },
      orderBy: { createdAt: 'asc' },
    });
    return this.withRequesterNames(requests);
  }

  async listAllCompensations() {
    const requests = await this.prisma.compensationRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return this.withRequesterNames(requests);
  }

  async updateCompensationStatus(
    id: string,
    status: 'aprovado' | 'recusado',
    reviewNote?: string,
  ) {
    const updated = await this.prisma.compensationRequest.update({
      where: { id },
      data: { status, reviewNote: status === 'recusado' ? reviewNote : null },
    });
    void this.push.sendToUser(updated.userId, {
      title: 'Banco de horas',
      body:
        status === 'aprovado'
          ? 'Sua solicitação de compensação foi aprovada.'
          : 'Sua solicitação de compensação foi recusada.',
    });
    return updated;
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
    return this.withRequesterNames(requests);
  }

  async listAllVacations() {
    const requests = await this.prisma.vacationRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return this.withRequesterNames(requests);
  }

  // Shared by every listPending* method: joins each request against
  // Employee for a display name, falling back to the bare userId when no
  // Employee row exists (e.g. a user created outside the seed data).
  private async withRequesterNames<T extends { userId: string }>(
    requests: T[],
  ): Promise<(T & { userName: string })[]> {
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

  async updateVacationStatus(
    id: string,
    status: 'aprovado' | 'recusado',
    reviewNote?: string,
  ) {
    const updated = await this.prisma.vacationRequest.update({
      where: { id },
      data: { status, reviewNote: status === 'recusado' ? reviewNote : null },
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
