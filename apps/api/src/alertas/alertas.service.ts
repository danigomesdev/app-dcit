import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';
import { dateOnlyInSaoPaulo } from '../common/sao-paulo-time';

const INTERJORNADA_MIN_MINUTES = 11 * 60; // CLT Art. 66
const INTRAJORNADA_MIN_MINUTES = 60; // CLT Art. 71

type AlertType = 'interjornada' | 'intrajornada';

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: ExpoPushService,
  ) {}

  async checkAfterPunch(
    userId: string,
    newEntry: { id: string; clockedAt: Date },
  ): Promise<void> {
    // Alert detection must never fail the punch it is attached to, so all
    // errors here are swallowed and logged, not thrown.
    try {
      const todaySP = dateOnlyInSaoPaulo(newEntry.clockedAt);
      const startOfDay = new Date(`${todaySP}T03:00:00.000Z`); // São Paulo midnight = UTC 03:00
      const dateOnly = new Date(`${todaySP}T00:00:00.000Z`);

      const priorToday = await this.prisma.timeEntry.count({
        where: {
          userId,
          clockedAt: { gte: startOfDay, lt: newEntry.clockedAt },
        },
      });

      if (priorToday === 0) {
        await this.checkInterjornada(userId, dateOnly, newEntry.clockedAt);
      } else if (priorToday === 2) {
        await this.checkIntrajornada(
          userId,
          dateOnly,
          startOfDay,
          newEntry.clockedAt,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to check jornada alerts for user ${userId}: ${String(error)}`,
      );
    }
  }

  private async checkInterjornada(
    userId: string,
    dateOnly: Date,
    punchedAt: Date,
  ): Promise<void> {
    const previous = await this.prisma.timeEntry.findFirst({
      where: { userId, clockedAt: { lt: punchedAt } },
      orderBy: { clockedAt: 'desc' },
    });
    if (!previous) return;

    const gapMinutes = Math.round(
      (punchedAt.getTime() - previous.clockedAt.getTime()) / 60000,
    );
    if (gapMinutes < INTERJORNADA_MIN_MINUTES) {
      await this.recordViolation(
        userId,
        'interjornada',
        dateOnly,
        INTERJORNADA_MIN_MINUTES - gapMinutes,
      );
    }
  }

  private async checkIntrajornada(
    userId: string,
    dateOnly: Date,
    startOfDay: Date,
    punchedAt: Date,
  ): Promise<void> {
    const lunchDeparture = await this.prisma.timeEntry.findFirst({
      where: { userId, clockedAt: { gte: startOfDay, lt: punchedAt } },
      orderBy: { clockedAt: 'desc' },
    });
    if (!lunchDeparture) return;

    const gapMinutes = Math.round(
      (punchedAt.getTime() - lunchDeparture.clockedAt.getTime()) / 60000,
    );
    if (gapMinutes < INTRAJORNADA_MIN_MINUTES) {
      await this.recordViolation(
        userId,
        'intrajornada',
        dateOnly,
        INTRAJORNADA_MIN_MINUTES - gapMinutes,
      );
    }
  }

  private async recordViolation(
    userId: string,
    type: AlertType,
    date: Date,
    minutesShort: number,
  ): Promise<void> {
    await this.prisma.jornadaAlert.create({
      data: { userId, type, date, minutesShort },
    });
    void this.push.sendToUser(userId, {
      title:
        type === 'interjornada'
          ? 'Intervalo entre turnos'
          : 'Intervalo de almoço',
      body:
        type === 'interjornada'
          ? `Você iniciou este turno com menos de 11h de descanso desde o anterior (faltaram ${minutesShort} min).`
          : `Seu intervalo de almoço foi menor que 1h (faltaram ${minutesShort} min).`,
    });
  }

  listForUser(userId: string) {
    return this.prisma.jornadaAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll() {
    const alerts = await this.prisma.jornadaAlert.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: alerts.map((a) => a.userId) } },
    });
    const nameByUserId = new Map(employees.map((e) => [e.userId, e.name]));
    return alerts.map((alert) => ({
      ...alert,
      userName: nameByUserId.get(alert.userId) ?? alert.userId,
    }));
  }
}
