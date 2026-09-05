import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CareerEvaluationSaveSchema, CareerEvaluationDecidirSchema } from '@ponto-dcit/shared-types';
import { CareerEvaluationsService } from './evaluations.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('carreira/evaluations')
export class CareerEvaluationsController {
  constructor(private readonly evaluations: CareerEvaluationsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  async getOpen(@Query('userId') userId: string | undefined, @Res() res: Response) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    const evaluation = await this.evaluations.getOpen(userId);
    // Nest's default response handling treats a bare `null` return value as
    // "no body" (isNil short-circuit in RouterResponseController), sending a
    // genuinely empty HTTP body instead of the JSON literal "null" — which
    // breaks any client calling `res.json()` on it ("Unexpected end of JSON
    // input"). @Res() bypasses that so a real "null" body is always sent.
    res.status(200).json(evaluation);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  async save(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = CareerEvaluationSaveSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.evaluations.save(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post(':id/decidir')
  async decidir(@Param('id') id: string, @Body() body: unknown) {
    const result = CareerEvaluationDecidirSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.evaluations.decidir(id, result.data.confirmarPromocao);
  }
}
