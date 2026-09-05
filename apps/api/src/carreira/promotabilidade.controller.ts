import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PromotabilidadeService } from './promotabilidade.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('carreira/promotabilidade')
export class PromotabilidadeController {
  constructor(private readonly promotabilidade: PromotabilidadeService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get(':userId')
  async getOne(@Param('userId') userId: string) {
    return this.promotabilidade.getOne(userId);
  }
}
