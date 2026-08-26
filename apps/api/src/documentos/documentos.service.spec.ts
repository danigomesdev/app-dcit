process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { DocumentosService } from './documentos.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DocumentosService', () => {
  let service: DocumentosService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentosService, PrismaService],
    }).compile();

    service = module.get(DocumentosService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.payslip.deleteMany();
    await prisma.admissionDocument.deleteMany();
    await prisma.certification.deleteMany();
    await prisma.onModuleDestroy();
  });

  it("lists only the given user's payslips", async () => {
    await prisma.payslip.createMany({
      data: [
        {
          userId: 'user-a',
          label: 'Julho 2026',
          gross: 6200,
          inss: 682,
          irrf: 410,
          benefits: 380,
        },
        {
          userId: 'user-b',
          label: 'Julho 2026',
          gross: 5000,
          inss: 500,
          irrf: 300,
          benefits: 200,
        },
      ],
    });

    const results = await service.listPayslips('user-a');

    expect(results).toHaveLength(1);
    expect(results[0].gross).toBe(6200);
  });

  it('creates and lists admission documents scoped to the user', async () => {
    await service.createAdmissionDocument('user-c', {
      title: 'Comprovante de residência',
    });

    const results = await service.listAdmissionDocuments('user-c');

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Comprovante de residência');
    expect(results[0].status).toBe('enviado');
  });

  it('creates and lists certifications scoped to the user, parsing the DD/MM/AAAA date', async () => {
    await service.createCertification('user-d', {
      name: 'AWS Certified',
      institution: 'Amazon',
      validUntil: '10/10/2028',
    });

    const results = await service.listCertifications('user-d');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('AWS Certified');
    expect(results[0].validUntil.toISOString().slice(0, 10)).toBe('2028-10-10');
  });
});
