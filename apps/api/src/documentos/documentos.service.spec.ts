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
    await prisma.employee.deleteMany({
      where: { userId: { in: ['user-e', 'user-f'] } },
    });
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

  it('creates, updates, and lists a payslip across the whole team', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-g',
        name: 'Gabriela Holerite',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });

    const created = await service.createPayslip({
      userId: 'user-g',
      label: 'Agosto/2026',
      gross: 6200,
      inss: 682,
      irrf: 410,
      benefits: 380,
    });

    expect(created.label).toBe('Agosto/2026');
    expect(created.gross).toBe(6200);

    const listed = await service.listAllPayslips();
    expect(listed.find((p) => p.id === created.id)?.userName).toBe(
      'Gabriela Holerite',
    );

    const updated = await service.updatePayslip(created.id, {
      label: 'Agosto/2026 (corrigido)',
      gross: 6500,
      inss: 700,
      irrf: 420,
      benefits: 380,
    });
    expect(updated.label).toBe('Agosto/2026 (corrigido)');
    expect(updated.gross).toBe(6500);

    await prisma.employee.delete({ where: { userId: 'user-g' } });
  });

  it('throws NotFoundException when updating a payslip that does not exist', async () => {
    await expect(
      service.updatePayslip('never-existed', {
        label: 'X',
        gross: 100,
        inss: 10,
        irrf: 10,
        benefits: 10,
      }),
    ).rejects.toThrow('Holerite não encontrado.');
  });

  it('deletes a payslip idempotently', async () => {
    const created = await service.createPayslip({
      userId: 'user-h',
      label: 'Setembro/2026',
      gross: 5000,
      inss: 500,
      irrf: 300,
      benefits: 200,
    });

    await service.deletePayslip(created.id);
    // Calling it a second time, or on an id that never existed, must not throw.
    await service.deletePayslip(created.id);
    await service.deletePayslip('never-existed');

    const listed = await service.listAllPayslips();
    expect(listed.find((p) => p.id === created.id)).toBeUndefined();
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

  it('lists admission documents across every user, joined with the employee name', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-e',
        name: 'Ester Admissional',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await service.createAdmissionDocument('user-e', { title: 'RG' });

    const results = await service.listAllAdmissionDocuments();

    expect(results.find((r) => r.userId === 'user-e')?.userName).toBe(
      'Ester Admissional',
    );
  });

  it('lists certifications across every user, joined with the employee name', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-f',
        name: 'Fábio Certificado',
        role: 'colaborador',
        hireDate: new Date('2024-03-15'),
      },
    });
    await service.createCertification('user-f', {
      name: 'Scrum Master',
      institution: 'Scrum.org',
      validUntil: '05/05/2029',
    });

    const results = await service.listAllCertifications();

    expect(results.find((r) => r.userId === 'user-f')?.userName).toBe(
      'Fábio Certificado',
    );
  });
});
