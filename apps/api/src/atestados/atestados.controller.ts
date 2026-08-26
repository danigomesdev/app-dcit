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
  AtestadoInputSchema,
  AtestadoOcrRequestSchema,
  AtestadoStatusUpdateSchema,
} from '@ponto-dcit/shared-types';
import { AtestadosService } from './atestados.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('atestados')
export class AtestadosController {
  constructor(private readonly atestados: AtestadosService) {}

  @UseGuards(AuthGuard)
  @Post('ocr')
  @HttpCode(200)
  async ocr(@Body() body: unknown) {
    const result = AtestadoOcrRequestSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.atestados.extract(result.data);
  }

  @UseGuards(AuthGuard)
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = AtestadoInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.atestados.create(req.user.sub, req.user.name, result.data);
  }

  @UseGuards(AuthGuard)
  @Get('mine')
  listMine(@Req() req: AuthenticatedRequest) {
    return this.atestados.listMine(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('team')
  listTeam(@Req() req: AuthenticatedRequest) {
    return this.atestados.listTeam(req.user.role);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = AtestadoStatusUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.atestados.updateStatus(id, result.data.status);
  }
}
