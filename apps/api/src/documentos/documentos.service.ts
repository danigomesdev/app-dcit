import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdmissionDocumentInput,
  CertificationInput,
  PayslipInput,
  PayslipUpdate,
} from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

function parseDateBR(value: string): Date {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class DocumentosService {
  constructor(private readonly prisma: PrismaService) {}

  listPayslips(userId: string) {
    return this.prisma.payslip.findMany({ where: { userId } });
  }

  createPayslip(input: PayslipInput) {
    return this.prisma.payslip.create({ data: input });
  }

  async updatePayslip(id: string, input: PayslipUpdate) {
    const existing = await this.prisma.payslip.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Holerite não encontrado.');
    }
    return this.prisma.payslip.update({ where: { id }, data: input });
  }

  // Idempotent — calling this twice, or on an id that never existed, must
  // not throw. Same pattern as ConvencoesService.delete.
  deletePayslip(id: string) {
    return this.prisma.payslip.deleteMany({ where: { id } });
  }

  async listAllPayslips() {
    const payslips = await this.prisma.payslip.findMany();
    return this.withRequesterNames(payslips);
  }

  createAdmissionDocument(userId: string, input: AdmissionDocumentInput) {
    return this.prisma.admissionDocument.create({
      data: { userId, title: input.title, photoUri: input.photoUri },
    });
  }

  listAdmissionDocuments(userId: string) {
    return this.prisma.admissionDocument.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async listAllAdmissionDocuments() {
    const documents = await this.prisma.admissionDocument.findMany({
      orderBy: { submittedAt: 'desc' },
    });
    return this.withRequesterNames(documents);
  }

  createCertification(userId: string, input: CertificationInput) {
    return this.prisma.certification.create({
      data: {
        userId,
        name: input.name,
        institution: input.institution,
        validUntil: parseDateBR(input.validUntil),
      },
    });
  }

  listCertifications(userId: string) {
    return this.prisma.certification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllCertifications() {
    const certifications = await this.prisma.certification.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return this.withRequesterNames(certifications);
  }

  // Shared by every listAll* method: joins each record against Employee for
  // a display name, falling back to the bare userId when no Employee row
  // exists — same pattern as SolicitacoesService.withRequesterNames.
  private async withRequesterNames<T extends { userId: string }>(
    records: T[],
  ): Promise<(T & { userName: string })[]> {
    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: records.map((record) => record.userId) } },
    });
    const nameByUserId = new Map(
      employees.map((employee) => [employee.userId, employee.name]),
    );
    return records.map((record) => ({
      ...record,
      userName: nameByUserId.get(record.userId) ?? record.userId,
    }));
  }
}
