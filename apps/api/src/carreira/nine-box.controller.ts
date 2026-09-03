import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { NineBoxPlacementCreateSchema } from '@ponto-dcit/shared-types';
import { NineBoxService } from './nine-box.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('carreira/nine-box')
export class NineBoxController {
  constructor(private readonly nineBox: NineBoxService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  async list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.nineBox.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = NineBoxPlacementCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.nineBox.create(req.user.sub, result.data);
  }
}
