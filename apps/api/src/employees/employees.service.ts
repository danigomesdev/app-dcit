import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EmployeeCreateInput,
  EmployeeScheduleUpdate,
} from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async updatePersonalData(userId: string, input: EmployeeCreateInput) {
    try {
      return await this.prisma.employee.update({
        where: { userId },
        data: {
          name: input.name,
          role: input.role,
          cargo: input.cargo,
          nivel: input.nivel,
          hireDate: new Date(input.hireDate),
          cpf: input.cpf,
          rg: input.rg,
          dataNascimento: input.dataNascimento
            ? new Date(input.dataNascimento)
            : null,
          estadoCivil: input.estadoCivil,
          enderecoRua: input.enderecoRua,
          enderecoNumero: input.enderecoNumero,
          enderecoBairro: input.enderecoBairro,
          enderecoCidade: input.enderecoCidade,
          enderecoEstado: input.enderecoEstado,
          enderecoCep: input.enderecoCep,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(await this.cpfConflictMessage(input.cpf));
      }
      throw error;
    }
  }

  /**
   * cpf is globally @unique and soft-deleting an employee does not clear it,
   * so a P2002 on cpf may point at an employee sitting in the lixeira rather
   * than an active one. Look that up so the error message tells RH where the
   * CPF actually is instead of implying it's stuck on the active roster.
   */
  private async cpfConflictMessage(cpf: string | null): Promise<string> {
    if (cpf) {
      const conflicting = await this.prisma.employee.findUnique({
        where: { cpf },
      });
      if (conflicting?.deletedAt) {
        return 'Já existe um colaborador com esse CPF na lixeira — restaure-o ou exclua-o permanentemente antes de reutilizar o CPF.';
      }
    }
    return 'Já existe um colaborador cadastrado com esse CPF.';
  }

  listTrash() {
    return this.prisma.employee.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  softDelete(userId: string) {
    return this.prisma.employee.update({
      where: { userId },
      data: { deletedAt: new Date() },
    });
  }

  restore(userId: string) {
    return this.prisma.employee.update({
      where: { userId },
      data: { deletedAt: null },
    });
  }

  async permanentlyDelete(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee || employee.deletedAt === null) {
      throw new BadRequestException(
        'Só é possível excluir permanentemente um colaborador que já está na lixeira.',
      );
    }
    await this.prisma.employee.delete({ where: { userId } });
  }

  updateSchedule(userId: string, input: EmployeeScheduleUpdate) {
    return this.prisma.employee.update({
      where: { userId },
      data: { expectedStartTime: input.expectedStartTime },
    });
  }

  async create(input: EmployeeCreateInput) {
    try {
      return await this.prisma.employee.create({
        data: {
          userId: randomUUID(),
          name: input.name,
          role: input.role,
          cargo: input.cargo,
          nivel: input.nivel,
          hireDate: new Date(input.hireDate),
          cpf: input.cpf,
          rg: input.rg,
          dataNascimento: input.dataNascimento
            ? new Date(input.dataNascimento)
            : null,
          estadoCivil: input.estadoCivil,
          enderecoRua: input.enderecoRua,
          enderecoNumero: input.enderecoNumero,
          enderecoBairro: input.enderecoBairro,
          enderecoCidade: input.enderecoCidade,
          enderecoEstado: input.enderecoEstado,
          enderecoCep: input.enderecoCep,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(await this.cpfConflictMessage(input.cpf));
      }
      throw error;
    }
  }
}
