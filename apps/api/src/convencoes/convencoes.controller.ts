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
  UseGuards,
} from '@nestjs/common';
import { ConvencaoInputSchema } from '@ponto-dcit/shared-types';
import { ConvencoesService } from './convencoes.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('convencoes')
export class ConvencoesController {
  constructor(private readonly convencoes: ConvencoesService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get()
  list() {
    return this.convencoes.list();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const result = ConvencaoInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.convencoes.create(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const result = ConvencaoInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.convencoes.update(id, result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.convencoes.delete(id);
  }
}
