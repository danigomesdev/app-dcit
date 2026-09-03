import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OneOnOneCreateSchema, OneOnOneAcaoUpdateSchema } from '@ponto-dcit/shared-types';
import { OneOnOnesService } from './one-on-ones.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('carreira/one-on-ones')
export class OneOnOnesController {
  constructor(private readonly oneOnOnes: OneOnOnesService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  async list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.oneOnOnes.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = OneOnOneCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.oneOnOnes.create(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Patch('acoes/:id')
  async updateAcaoStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = OneOnOneAcaoUpdateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.oneOnOnes.updateAcaoStatus(id, result.data.status);
  }
}
