import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dateOnlyInSaoPaulo, isWeekend } from '../common/sao-paulo-time';

@Injectable()
export class PontoPerdidoService {
  private readonly logger = new Logger(PontoPerdidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // 06:00 América/São_Paulo, todo dia — bem depois da virada de dia, dando
  // tempo de qualquer ajuste retroativo same-day (ex: /ajustar aprovado
  // ainda ontem à noite) já estar refletido antes de este job rodar.
  @Cron('0 6 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleCron(): Promise<void> {
    await this.run(new Date());
  }

  // Separado de handleCron pra ser chamável direto nos testes, com uma data
  // fixa, sem depender de mockar o relógio do sistema.
  async run(now: Date): Promise<void> {
    // Best-effort: uma falha aqui (ex: push fora do ar) nunca pode travar o
    // agendador nem impedir a próxima execução diária.
    try {
      // "Ontem" precisa vir de um instante real (now menos 24h), não de
      // remontar uma meia-noite UTC a partir da string todaySP e reprocessá-la
      // de novo por dateOnlyInSaoPaulo: meia-noite UTC de qualquer dia D já
      // cai em D-1 no horário de SP (UTC-3), então rodar dateOnlyInSaoPaulo
      // duas vezes (uma implícita ao montar a meia-noite UTC, outra explícita
      // na chamada) subtrai um dia a mais do que deveria — targetDateSP saía
      // dois dias antes de "now" em vez de um. Comprovado por teste: com
      // NOW=2026-09-02T09:00Z (targetDate correto = 2026-09-01), a versão
      // antiga calculava 2026-08-31 e a janela de busca de TimeEntry não
      // batia com os horários de ponto de teste, gerando falsos "ausência".
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const targetDateSP = dateOnlyInSaoPaulo(yesterday);

      if (isWeekend(targetDateSP)) return;

      const startOfTarget = new Date(`${targetDateSP}T03:00:00.000Z`); // meia-noite SP = UTC 03:00
      const endOfTarget = new Date(startOfTarget);
      endOfTarget.setUTCDate(endOfTarget.getUTCDate() + 1);
      const targetDateMidnightUTC = new Date(`${targetDateSP}T00:00:00.000Z`);

      // hireDate não filtra na query: é armazenado como meia-noite UTC do dia
      // de contratação (mesma convenção de "new Date('YYYY-MM-DD')" usada em
      // EmployeesService) — um marcador simbólico do dia, não um instante
      // real. Por isso o lado do hireDate usa extração direta da data UTC
      // (toISOString().slice(0,10)), igual à convenção documentada em
      // sao-paulo-time.ts para "valores date-only já conhecidos" (ex:
      // VacationRequest.startDate): eles ficam em UTC-midnight o tempo todo,
      // sem passar por dateOnlyInSaoPaulo (essa função é só pra converter um
      // instante real de relógio, tipo "now", pro calendário de SP). Usar
      // dateOnlyInSaoPaulo(hireDate) aqui pareceria simétrico com
      // targetDateSP, mas na prática aplicaria o mesmo desvio de -1 dia do
      // bug acima: um funcionário contratado exatamente no dia seguinte ao
      // alvo (ex: hireDate 2026-09-02 com alvo 2026-09-01) teria seu hireDate
      // "empurrado" de volta pra 2026-09-01 e passaria a comparação
      // indevidamente — comprovado pelo teste "excludes an employee hired
      // after the target day".
      const allActiveEmployees = await this.prisma.employee.findMany({
        where: { deletedAt: null },
      });
      const employees = allActiveEmployees.filter(
        (e) => e.hireDate.toISOString().slice(0, 10) <= targetDateSP,
      );
      const userIds = employees.map((e) => e.userId);

      const entries = await this.prisma.timeEntry.findMany({
        where: {
          userId: { in: userIds },
          clockedAt: { gte: startOfTarget, lt: endOfTarget },
        },
      });
      const countByUserId = new Map<string, number>();
      for (const entry of entries) {
        countByUserId.set(
          entry.userId,
          (countByUserId.get(entry.userId) ?? 0) + 1,
        );
      }

      const vacations = await this.prisma.vacationRequest.findMany({
        where: {
          userId: { in: userIds },
          status: 'aprovado',
          startDate: { lte: targetDateMidnightUTC },
          endDate: { gte: targetDateMidnightUTC },
        },
      });
      const onVacation = new Set(vacations.map((v) => v.userId));

      // Mesma lógica de cobertura de período que TimeEntriesService.listTeamToday
      // já usa (periodStart/periodEnd calculados a partir de createdAt + dias),
      // só que checando o dia alvo em vez de hoje.
      const atestados = await this.prisma.atestado.findMany({
        where: {
          userId: { in: userIds },
          status: 'aprovado',
          dias: { not: null },
        },
      });
      const onAtestado = new Set<string>();
      for (const atestado of atestados) {
        const periodStart = new Date(
          `${dateOnlyInSaoPaulo(atestado.createdAt)}T00:00:00.000Z`,
        );
        const periodEnd = new Date(periodStart);
        periodEnd.setUTCDate(periodEnd.getUTCDate() + (atestado.dias ?? 0));
        if (
          periodStart <= targetDateMidnightUTC &&
          targetDateMidnightUTC < periodEnd
        ) {
          onAtestado.add(atestado.userId);
        }
      }

      for (const employee of employees) {
        const count = countByUserId.get(employee.userId) ?? 0;

        if (count === 0) {
          if (
            onVacation.has(employee.userId) ||
            onAtestado.has(employee.userId)
          )
            continue;
          await this.notifications.sendPontoPerdido(
            'ausencia',
            employee.userId,
            employee.name,
            targetDateSP,
          );
        } else if (count % 2 === 1) {
          await this.notifications.sendPontoPerdido(
            'saida_esquecida',
            employee.userId,
            employee.name,
            targetDateSP,
          );
        }
        // count par e >= 2: dia fechado corretamente, nada a fazer.
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao rodar detecção de ponto perdido: ${String(error)}`,
      );
    }
  }
}
