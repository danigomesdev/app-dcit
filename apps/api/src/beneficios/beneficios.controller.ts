import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BeneficiosService } from './beneficios.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('beneficios')
export class BeneficiosController {
  constructor(private readonly beneficios: BeneficiosService) {}

  @UseGuards(AuthGuard)
  @Get('saldos')
  listBalances(@Req() req: AuthenticatedRequest) {
    return this.beneficios.listBalances(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('saldos/equipe')
  listAllBalances() {
    return this.beneficios.listAllBalances();
  }

  @UseGuards(AuthGuard)
  @Get('parceiros')
  listPartners() {
    return this.beneficios.listPartners();
  }
}
