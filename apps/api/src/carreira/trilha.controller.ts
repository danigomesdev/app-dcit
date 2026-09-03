import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TrackRequirementCreateSchema, TrackRequirementUpdateSchema } from '@ponto-dcit/shared-types';
import { TrackRequirementsService } from './trilha.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('carreira/trilha')
export class TrackRequirementsController {
  constructor(private readonly requirements: TrackRequirementsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  async list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.requirements.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const result = TrackRequirementCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.requirements.create(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = TrackRequirementUpdateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.requirements.updateStatus(id, result.data.status);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    return this.requirements.remove(id);
  }
}
