import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  DeslocamentoInput,
  EscalaShiftInput,
} from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';

// Monday (UTC) of the current week through the following Sunday, unless
// explicit start/end query params are given. Kept UTC-only throughout (no
// local-timezone conversion) so a "day" always means the same calendar day
// regardless of the server's or a client's timezone — same reasoning as
// VacationRequest.startDate elsewhere in this codebase.
export function resolveWeekRange(
  start?: string,
  end?: string,
): { start: Date; end: Date } {
  const startDate = start
    ? new Date(`${start}T00:00:00.000Z`)
    : mondayOfCurrentWeekUTC();

  const endDate = end ? new Date(`${end}T23:59:59.999Z`) : new Date(startDate);
  if (!end) {
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);
  }

  return { start: startDate, end: endDate };
}

function mondayOfCurrentWeekUTC(): Date {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = date.getUTCDay(); // 0=Sunday..6=Saturday
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

@Injectable()
export class OperacionalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: ExpoPushService,
  ) {}

  async getSobreavisoStatus(userId: string) {
    const open = await this.prisma.sobreavisoRecord.findFirst({
      where: { userId, endedAt: null },
    });
    return open
      ? { active: true, startedAt: open.startedAt }
      : { active: false, startedAt: null };
  }

  async toggleSobreaviso(userId: string) {
    const open = await this.prisma.sobreavisoRecord.findFirst({
      where: { userId, endedAt: null },
    });
    if (open) {
      await this.prisma.sobreavisoRecord.update({
        where: { id: open.id },
        data: { endedAt: new Date() },
      });
      return { active: false, startedAt: null };
    }
    const created = await this.prisma.sobreavisoRecord.create({
      data: { userId, startedAt: new Date() },
    });
    return { active: true, startedAt: created.startedAt };
  }

  async listActiveSobreaviso() {
    const open = await this.prisma.sobreavisoRecord.findMany({
      where: { endedAt: null },
      orderBy: { startedAt: 'asc' },
    });
    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: open.map((record) => record.userId) } },
    });
    const nameByUserId = new Map(
      employees.map((employee) => [employee.userId, employee.name]),
    );
    return open.map((record) => ({
      ...record,
      userName: nameByUserId.get(record.userId) ?? record.userId,
    }));
  }

  createDeslocamento(userId: string, input: DeslocamentoInput) {
    return this.prisma.deslocamentoRecord.create({
      data: {
        userId,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
      },
    });
  }

  listDeslocamentos(userId: string) {
    return this.prisma.deslocamentoRecord.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async listAllDeslocamentos() {
    const records = await this.prisma.deslocamentoRecord.findMany({
      orderBy: { startedAt: 'desc' },
    });
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

  async listShifts(start: Date, end: Date) {
    const shifts = await this.prisma.plantaoShift.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: [{ date: 'asc' }, { label: 'asc' }],
    });
    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: shifts.map((shift) => shift.userId) } },
    });
    const nameByUserId = new Map(
      employees.map((employee) => [employee.userId, employee.name]),
    );
    return shifts.map((shift) => ({
      ...shift,
      userName: nameByUserId.get(shift.userId) ?? shift.userId,
    }));
  }

  async createShift(input: EscalaShiftInput) {
    try {
      const created = await this.prisma.plantaoShift.create({
        data: {
          date: new Date(input.date),
          label: input.label,
          userId: input.userId,
        },
      });
      const formattedDate = new Date(`${input.date}T00:00:00.000Z`).toLocaleDateString(
        'pt-BR',
        { timeZone: 'UTC' },
      );
      void this.push.sendToUser(input.userId, {
        title: 'Plantão',
        body: `Você foi escalado para o plantão "${input.label}" em ${formattedDate}.`,
      });
      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe um turno com essa data, rótulo e pessoa.',
        );
      }
      throw error;
    }
  }

  // deleteMany (not delete): idempotent on a missing id — a double-click
  // on "Remover" or two gestores editing the same week concurrently must
  // not 500 on the second call, matching the push-tokens precedent
  // elsewhere in this codebase.
  deleteShift(id: string) {
    return this.prisma.plantaoShift.deleteMany({ where: { id } });
  }
}
