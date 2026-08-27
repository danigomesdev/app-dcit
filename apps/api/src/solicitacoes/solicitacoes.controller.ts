import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AdjustmentRequestInputSchema,
  AdjustmentStatusUpdateSchema,
  CompensationRequestInputSchema,
  CompensationStatusUpdateSchema,
  VacationRequestInputSchema,
  VacationStatusUpdateSchema,
} from '@ponto-dcit/shared-types';
import { SolicitacoesService } from './solicitacoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('solicitacoes')
export class SolicitacoesController {
  constructor(private readonly solicitacoes: SolicitacoesService) {}

  @UseGuards(AuthGuard)
  @Post('ajustes')
  @HttpCode(201)
  async createAdjustment(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = AdjustmentRequestInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.solicitacoes.createAdjustment(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard)
  @Get('ajustes')
  listAdjustments(@Req() req: AuthenticatedRequest) {
    return this.solicitacoes.listAdjustments(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch('ajustes/:id/status')
  async updateAdjustmentStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = AdjustmentStatusUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.solicitacoes.updateAdjustmentStatus(id, result.data.status);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('ajustes/pendentes')
  listPendingAdjustments() {
    return this.solicitacoes.listPendingAdjustments();
  }

  @UseGuards(AuthGuard)
  @Post('compensacoes')
  @HttpCode(201)
  async createCompensation(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = CompensationRequestInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.solicitacoes.createCompensation(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard)
  @Get('compensacoes')
  listCompensations(@Req() req: AuthenticatedRequest) {
    return this.solicitacoes.listCompensations(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch('compensacoes/:id/status')
  async updateCompensationStatus(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const result = CompensationStatusUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.solicitacoes.updateCompensationStatus(id, result.data.status);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('compensacoes/pendentes')
  listPendingCompensations() {
    return this.solicitacoes.listPendingCompensations();
  }

  @UseGuards(AuthGuard)
  @Post('ferias')
  @HttpCode(201)
  async createVacation(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = VacationRequestInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.solicitacoes.createVacation(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard)
  @Get('ferias')
  async getFerias(@Req() req: AuthenticatedRequest) {
    const [requests, profile] = await Promise.all([
      this.solicitacoes.listVacations(req.user.sub),
      this.solicitacoes.getVacationProfile(req.user.sub),
    ]);
    return { requests, ...profile };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch('ferias/:id/status')
  async updateVacationStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = VacationStatusUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.solicitacoes.updateVacationStatus(id, result.data.status);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('ferias/pendentes')
  listPendingVacations() {
    return this.solicitacoes.listPendingVacations();
  }
}
