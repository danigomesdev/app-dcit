process.env.DATABASE_URL = 'file:./test.db';

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeesService, PrismaService],
    }).compile();

    service = module.get(EmployeesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.employee.deleteMany({
      where: { userId: { in: ['emp-b', 'emp-a', 'emp-schedule'] } },
    });
    await prisma.employee.deleteMany({
      where: { cpf: { in: ['11111111111', '22222222222'] } },
    });
    await prisma.onModuleDestroy();
  });

  it('lists employees sorted by name', async () => {
    await prisma.employee.create({
      data: {
        userId: 'emp-b',
        name: 'Beto',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'emp-a',
        name: 'Ana',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });

    const results = await service.list();

    const names = results
      .filter((e) => ['emp-a', 'emp-b'].includes(e.userId))
      .map((e) => e.name);
    expect(names).toEqual(['Ana', 'Beto']);
  });

  describe('updateSchedule', () => {
    it('sets expectedStartTime and returns the updated employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-schedule',
          name: 'Duda Horário',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      const updated = await service.updateSchedule('emp-schedule', {
        expectedStartTime: '09:00',
      });

      expect(updated.expectedStartTime).toBe('09:00');
      const found = await prisma.employee.findUnique({
        where: { userId: 'emp-schedule' },
      });
      expect(found?.expectedStartTime).toBe('09:00');
    });

    it('clears expectedStartTime when given null', async () => {
      await service.updateSchedule('emp-schedule', { expectedStartTime: null });

      const found = await prisma.employee.findUnique({
        where: { userId: 'emp-schedule' },
      });
      expect(found?.expectedStartTime).toBeNull();
    });
  });

  it('list() includes expectedStartTime for each employee', async () => {
    await prisma.employee.update({
      where: { userId: 'emp-a' },
      data: { expectedStartTime: '08:00' },
    });

    const results = await service.list();

    expect(results.find((e) => e.userId === 'emp-a')?.expectedStartTime).toBe(
      '08:00',
    );
  });

  describe('create', () => {
    it('persists a new employee with a generated userId and all personal fields populated', async () => {
      const created = await service.create({
        name: 'Carlos Novo',
        role: 'colaborador',
        hireDate: '2026-01-15',
        cpf: '11111111111',
        rg: '1234567',
        dataNascimento: '1990-05-20',
        estadoCivil: 'casado',
        enderecoRua: 'Rua das Flores',
        enderecoNumero: '100',
        enderecoBairro: 'Centro',
        enderecoCidade: 'São Paulo',
        enderecoEstado: 'SP',
        enderecoCep: '01310100',
      });

      expect(created.userId).toHaveLength(36); // uuid
      expect(created.name).toBe('Carlos Novo');
      expect(created.cpf).toBe('11111111111');
      expect(created.dataNascimento?.toISOString()).toBe(
        '1990-05-20T00:00:00.000Z',
      );
      expect(created.estadoCivil).toBe('casado');
      expect(created.enderecoEstado).toBe('SP');

      const found = await prisma.employee.findUnique({
        where: { userId: created.userId },
      });
      expect(found?.cpf).toBe('11111111111');
    });

    it('persists a new employee with every personal field null', async () => {
      const created = await service.create({
        name: 'Debora Sem Dados',
        role: 'colaborador',
        hireDate: '2026-02-01',
        cpf: null,
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      });

      expect(created.cpf).toBeNull();
      expect(created.dataNascimento).toBeNull();

      await prisma.employee.delete({ where: { userId: created.userId } });
    });

    it('throws ConflictException when a second employee reuses an existing CPF', async () => {
      await service.create({
        name: 'Primeiro',
        role: 'colaborador',
        hireDate: '2026-01-01',
        cpf: '22222222222',
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      });

      await expect(
        service.create({
          name: 'Segundo',
          role: 'colaborador',
          hireDate: '2026-01-02',
          cpf: '22222222222',
          rg: null,
          dataNascimento: null,
          estadoCivil: null,
          enderecoRua: null,
          enderecoNumero: null,
          enderecoBairro: null,
          enderecoCidade: null,
          enderecoEstado: null,
          enderecoCep: null,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listTrash / softDelete / restore / permanentlyDelete', () => {
    it('excludes a soft-deleted employee from list() and includes it in listTrash()', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-trash-a',
          name: 'Trash Ana',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      await service.softDelete('emp-trash-a');

      const active = await service.list();
      expect(active.find((e) => e.userId === 'emp-trash-a')).toBeUndefined();

      const trashed = await service.listTrash();
      const found = trashed.find((e) => e.userId === 'emp-trash-a');
      expect(found).toBeDefined();
      expect(found?.deletedAt).not.toBeNull();
    });

    it('restores a soft-deleted employee back into list() and out of listTrash()', async () => {
      await service.restore('emp-trash-a');

      const active = await service.list();
      expect(active.find((e) => e.userId === 'emp-trash-a')).toBeDefined();

      const trashed = await service.listTrash();
      expect(trashed.find((e) => e.userId === 'emp-trash-a')).toBeUndefined();
    });

    it('permanently deletes an employee that is already in the trash', async () => {
      await service.softDelete('emp-trash-a');

      await service.permanentlyDelete('emp-trash-a');

      const found = await prisma.employee.findUnique({
        where: { userId: 'emp-trash-a' },
      });
      expect(found).toBeNull();
    });

    it('throws BadRequestException when permanently deleting an active (non-trashed) employee', async () => {
      await prisma.employee.create({
        data: {
          userId: 'emp-trash-b',
          name: 'Trash Beto',
          role: 'colaborador',
          hireDate: new Date('2024-01-01'),
        },
      });

      await expect(service.permanentlyDelete('emp-trash-b')).rejects.toThrow(
        BadRequestException,
      );

      await prisma.employee.delete({ where: { userId: 'emp-trash-b' } });
    });

    it('throws BadRequestException when permanently deleting a userId that does not exist', async () => {
      await expect(
        service.permanentlyDelete('emp-does-not-exist'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
