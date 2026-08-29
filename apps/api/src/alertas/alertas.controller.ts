import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AlertasService } from './alertas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertas: AlertasService) {}

  @UseGuards(AuthGuard)
  @Get('minhas')
  getMine(@Req() req: AuthenticatedRequest) {
    return this.alertas.listForUser(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get()
  listAll() {
    return this.alertas.listAll();
  }
}
