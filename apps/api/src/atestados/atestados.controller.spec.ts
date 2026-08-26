import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AtestadosController } from './atestados.controller';
import { AtestadosService } from './atestados.service';
import { AuthGuard } from '../auth/auth-guard';

describe('AtestadosController guard metadata', () => {
  it('applies AuthGuard to the ocr (POST) handler', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AtestadosController.prototype.ocr,
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });
});

describe('AtestadosController', () => {
  let controller: AtestadosController;
  const serviceMock = { extract: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AtestadosController],
      providers: [{ provide: AtestadosService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AtestadosController);
  });

  it('delegates a valid payload to the service', async () => {
    serviceMock.extract.mockResolvedValue({
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });

    const result = await controller.ocr({
      imageBase64: 'aGVsbG8=',
      mediaType: 'image/jpeg',
    });

    expect(serviceMock.extract).toHaveBeenCalledWith({
      imageBase64: 'aGVsbG8=',
      mediaType: 'image/jpeg',
    });
    expect(result).toEqual({
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });
  });

  it('rejects an invalid payload before calling the service', async () => {
    await expect(
      controller.ocr({ imageBase64: '', mediaType: 'image/jpeg' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.extract).not.toHaveBeenCalled();
  });
});
