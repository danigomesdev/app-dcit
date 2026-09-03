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
import { CareerGoalCreateSchema, CareerGoalUpdateSchema } from '@ponto-dcit/shared-types';
import { CareerGoalsService } from './metas.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('carreira/metas')
export class CareerGoalsController {
  constructor(private readonly goals: CareerGoalsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get()
  async list(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId é obrigatório');
    return this.goals.list(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const result = CareerGoalCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.goals.create(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = CareerGoalUpdateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.goals.updateStatus(id, result.data.status);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    return this.goals.remove(id);
  }
}
