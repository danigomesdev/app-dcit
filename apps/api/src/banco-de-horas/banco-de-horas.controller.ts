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

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

const PeriodQuerySchema = z.object({
  start: z.string().date().optional(),
  end: z.string().date().optional(),
});

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
    const { startDateOnly, endDateOnly } = resolveDefaultPeriod(
      result.data.start,
      result.data.end,
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
    const { startDateOnly, endDateOnly } = resolveDefaultPeriod(
      result.data.start,
      result.data.end,
    );
    return this.bancoDeHoras.getTeamSummary(startDateOnly, endDateOnly);
  }
}
