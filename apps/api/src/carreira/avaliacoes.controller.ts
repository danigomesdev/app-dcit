import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PerformanceEvaluationCreateSchema } from '@ponto-dcit/shared-types';
import { PerformanceEvaluationsService } from './avaliacoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('carreira/avaliacoes')
export class PerformanceEvaluationsController {
  constructor(private readonly evaluations: PerformanceEvaluationsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  async list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.evaluations.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = PerformanceEvaluationCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.evaluations.create(req.user.sub, result.data);
  }
}
