import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
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
      orderBy: { name: 'asc' },
    });
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
        throw new ConflictException(
          'Já existe um colaborador cadastrado com esse CPF.',
        );
      }
      throw error;
    }
  }
}
