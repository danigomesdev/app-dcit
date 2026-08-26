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
}
