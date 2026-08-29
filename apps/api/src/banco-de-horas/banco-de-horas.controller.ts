import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  BancoDeHorasService,
  resolveDefaultPeriod,
} from './banco-de-horas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { todaySaoPauloDateOnly } from '../common/sao-paulo-time';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

const PeriodQuerySchema = z.object({
  start: z.string().date().optional(),
  end: z.string().date().optional(),
});

const MAX_PERIOD_SPAN_DAYS = 366;

// Shared by getMinhas and getEquipe, after resolveDefaultPeriod has already
// filled in any missing bounds. `end` in the future is clamped to "today"
// (São Paulo) rather than rejected — this feature's existing rule is "never
// a future date", not "reject a future date" — but `start` after `end` and
// spans wider than MAX_PERIOD_SPAN_DAYS have no sane silent correction, so
// those are rejected outright.
function validatePeriod(
  startDateOnly: string,
  endDateOnly: string,
): { startDateOnly: string; endDateOnly: string } {
  const today = todaySaoPauloDateOnly();
  const clampedEnd = endDateOnly > today ? today : endDateOnly;
  if (startDateOnly > clampedEnd) {
    throw new BadRequestException(
      'O parâmetro start não pode ser posterior a end.',
    );
  }
  const spanDays = Math.round(
    (new Date(`${clampedEnd}T00:00:00.000Z`).getTime() -
      new Date(`${startDateOnly}T00:00:00.000Z`).getTime()) /
      86_400_000,
  );
  if (spanDays > MAX_PERIOD_SPAN_DAYS) {
    throw new BadRequestException(
      `O período não pode ultrapassar ${MAX_PERIOD_SPAN_DAYS} dias.`,
    );
  }
  return { startDateOnly, endDateOnly: clampedEnd };
}

@Controller('banco-de-horas')
export class BancoDeHorasController {
  constructor(private readonly bancoDeHoras: BancoDeHorasService) {}

  @UseGuards(AuthGuard)
  @Get('minhas')
  async getMinhas(@Query() query: unknown, @Req() req: AuthenticatedRequest) {
    const result = PeriodQuerySchema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    const resolved = resolveDefaultPeriod(result.data.start, result.data.end);
    const { startDateOnly, endDateOnly } = validatePeriod(
      resolved.startDateOnly,
      resolved.endDateOnly,
    );
    return this.bancoDeHoras.getSummary(
      req.user.sub,
      startDateOnly,
      endDateOnly,
    );
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('equipe')
  async getEquipe(@Query() query: unknown) {
    const result = PeriodQuerySchema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    const resolved = resolveDefaultPeriod(result.data.start, result.data.end);
    const { startDateOnly, endDateOnly } = validatePeriod(
      resolved.startDateOnly,
      resolved.endDateOnly,
    );
    return this.bancoDeHoras.getTeamSummary(startDateOnly, endDateOnly);
  }
}
