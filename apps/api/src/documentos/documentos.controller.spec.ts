import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = [
  'listPayslips',
  'createAdmissionDocument',
  'listAdmissionDocuments',
  'createCertification',
  'listCertifications',
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
});

describe('DocumentosController', () => {
  let controller: DocumentosController;
  const serviceMock = {
    listPayslips: jest.fn(),
    createAdmissionDocument: jest.fn(),
    listAdmissionDocuments: jest.fn(),
    createCertification: jest.fn(),
    listCertifications: jest.fn(),
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
});
