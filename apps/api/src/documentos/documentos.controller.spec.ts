import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = [
  'listPayslips',
  'createAdmissionDocument',
  'listAdmissionDocuments',
  'createCertification',
  'listCertifications',
  'listAllAdmissionDocuments',
  'listAllCertifications',
  'createPayslip',
  'updatePayslip',
  'removePayslip',
  'listAllPayslips',
] as const;

describe('DocumentosController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      DocumentosController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });

  it.each([
    'listAllAdmissionDocuments',
    'listAllCertifications',
    'createPayslip',
    'updatePayslip',
    'removePayslip',
    'listAllPayslips',
  ] as const)('applies RolesGuard(gestor, rh) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      DocumentosController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      DocumentosController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor', 'rh']);
  });
});

describe('DocumentosController', () => {
  let controller: DocumentosController;
  const serviceMock = {
    listPayslips: jest.fn(),
    createAdmissionDocument: jest.fn(),
    listAdmissionDocuments: jest.fn(),
    createCertification: jest.fn(),
    listCertifications: jest.fn(),
    listAllAdmissionDocuments: jest.fn(),
    listAllCertifications: jest.fn(),
    createPayslip: jest.fn(),
    updatePayslip: jest.fn(),
    deletePayslip: jest.fn(),
    listAllPayslips: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentosController],
      providers: [{ provide: DocumentosService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DocumentosController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('creates an admission document for the authenticated user', async () => {
    serviceMock.createAdmissionDocument.mockResolvedValue({ id: '1' });

    await controller.createAdmissionDocument(
      { title: 'Comprovante' },
      requestAs('user-1'),
    );

    expect(serviceMock.createAdmissionDocument).toHaveBeenCalledWith('user-1', {
      title: 'Comprovante',
    });
  });

  it('rejects an empty admission document title', async () => {
    await expect(
      controller.createAdmissionDocument({ title: '' }, requestAs('user-1')),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createAdmissionDocument).not.toHaveBeenCalled();
  });

  it('creates a certification for the authenticated user', async () => {
    serviceMock.createCertification.mockResolvedValue({ id: '1' });

    await controller.createCertification(
      {
        name: 'AWS Certified',
        institution: 'Amazon',
        validUntil: '10/10/2028',
      },
      requestAs('user-1'),
    );

    expect(serviceMock.createCertification).toHaveBeenCalledWith('user-1', {
      name: 'AWS Certified',
      institution: 'Amazon',
      validUntil: '10/10/2028',
    });
  });

  it('rejects a certification with a malformed date', async () => {
    await expect(
      controller.createCertification(
        {
          name: 'AWS Certified',
          institution: 'Amazon',
          validUntil: '2028-10-10',
        },
        requestAs('user-1'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createCertification).not.toHaveBeenCalled();
  });

  it('lists admission documents across the whole team', async () => {
    serviceMock.listAllAdmissionDocuments.mockResolvedValue([
      { id: '1', userId: 'user-1', userName: 'Ana' },
    ]);

    const result = await controller.listAllAdmissionDocuments();

    expect(result).toEqual([{ id: '1', userId: 'user-1', userName: 'Ana' }]);
    expect(serviceMock.listAllAdmissionDocuments).toHaveBeenCalledWith();
  });

  it('lists certifications across the whole team', async () => {
    serviceMock.listAllCertifications.mockResolvedValue([
      { id: '1', userId: 'user-1', userName: 'Ana' },
    ]);

    const result = await controller.listAllCertifications();

    expect(result).toEqual([{ id: '1', userId: 'user-1', userName: 'Ana' }]);
    expect(serviceMock.listAllCertifications).toHaveBeenCalledWith();
  });

  it('creates a payslip with a valid payload', async () => {
    serviceMock.createPayslip.mockResolvedValue({ id: '1' });

    await controller.createPayslip({
      userId: 'user-1',
      label: 'Agosto/2026',
      gross: 6200,
      inss: 682,
      irrf: 410,
      benefits: 380,
    });

    expect(serviceMock.createPayslip).toHaveBeenCalledWith({
      userId: 'user-1',
      label: 'Agosto/2026',
      gross: 6200,
      inss: 682,
      irrf: 410,
      benefits: 380,
    });
  });

  it('rejects a payslip payload missing userId', async () => {
    await expect(
      controller.createPayslip({
        label: 'Agosto/2026',
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createPayslip).not.toHaveBeenCalled();
  });

  it('rejects a payslip payload with a negative value', async () => {
    await expect(
      controller.createPayslip({
        userId: 'user-1',
        label: 'Agosto/2026',
        gross: -1,
        inss: 682,
        irrf: 410,
        benefits: 380,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createPayslip).not.toHaveBeenCalled();
  });

  it('updates a payslip with a valid payload, without a userId field', async () => {
    serviceMock.updatePayslip.mockResolvedValue({ id: 'p1' });

    await controller.updatePayslip('p1', {
      label: 'Agosto/2026 (corrigido)',
      gross: 6500,
      inss: 700,
      irrf: 420,
      benefits: 380,
    });

    expect(serviceMock.updatePayslip).toHaveBeenCalledWith('p1', {
      label: 'Agosto/2026 (corrigido)',
      gross: 6500,
      inss: 700,
      irrf: 420,
      benefits: 380,
    });
  });

  it('deletes a payslip', async () => {
    serviceMock.deletePayslip.mockResolvedValue(undefined);

    await controller.removePayslip('p1');

    expect(serviceMock.deletePayslip).toHaveBeenCalledWith('p1');
  });

  it('lists payslips across the whole team', async () => {
    serviceMock.listAllPayslips.mockResolvedValue([
      { id: '1', userId: 'user-1', userName: 'Ana' },
    ]);

    const result = await controller.listAllPayslips();

    expect(result).toEqual([{ id: '1', userId: 'user-1', userName: 'Ana' }]);
  });
});
