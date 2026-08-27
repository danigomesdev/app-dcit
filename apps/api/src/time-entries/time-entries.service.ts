import { Injectable } from '@nestjs/common';
import { TimeEntryInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: TimeEntryInput) {
    return this.prisma.timeEntry.create({
      data: {
        userId: input.userId,
        clockedAt: new Date(input.clockedAt),
      },
    });
  }

  listForUser(userId: string) {
    return this.prisma.timeEntry.findMany({
      where: { userId },
      orderBy: { clockedAt: 'asc' },
    });
  }

  // Same pairing rule as the mobile app's summarizeDay (ponto-context.tsx):
  // sequential punches alternate clock-in/clock-out, so an odd count means
  // the day is still open (no clock-out yet). Reimplemented here rather
  // than shared — it's ~10 lines, not worth a shared package for.
  async listTeamToday() {
    const employees = await this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
    });
    const todayKey = new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(`${todayKey}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayKey}T23:59:59.999Z`);

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId: { in: employees.map((employee) => employee.userId) },
        clockedAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { clockedAt: 'asc' },
    });

    return employees.map((employee) => {
      const dayEntries = entries.filter(
        (entry) => entry.userId === employee.userId,
      );

      let workedMinutes = 0;
      for (let i = 0; i + 1 < dayEntries.length; i += 2) {
        workedMinutes +=
          (dayEntries[i + 1].clockedAt.getTime() -
            dayEntries[i].clockedAt.getTime()) /
          60000;
      }

      return {
        userId: employee.userId,
        name: employee.name,
        entries: dayEntries.map((entry) => ({
          id: entry.id,
          clockedAt: entry.clockedAt,
        })),
        workedMinutes: Math.round(workedMinutes),
        isOpen: dayEntries.length % 2 === 1,
      };
    });
  }
}
