import { Injectable } from '@nestjs/common';
import type {
  AdmissionDocumentInput,
  CertificationInput,
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
