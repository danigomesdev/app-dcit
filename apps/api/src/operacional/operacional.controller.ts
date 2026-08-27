import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  DeslocamentoInputSchema,
  EscalaShiftInputSchema,
} from '@ponto-dcit/shared-types';
import { OperacionalService, resolveWeekRange } from './operacional.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('operacional')
export class OperacionalController {
  constructor(private readonly operacional: OperacionalService) {}

  @UseGuards(AuthGuard)
  @Get('sobreaviso')
  getSobreavisoStatus(@Req() req: AuthenticatedRequest) {
    return this.operacional.getSobreavisoStatus(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('sobreaviso/toggle')
  toggleSobreaviso(@Req() req: AuthenticatedRequest) {
    return this.operacional.toggleSobreaviso(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('deslocamentos')
  @HttpCode(201)
  async createDeslocamento(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = DeslocamentoInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.operacional.createDeslocamento(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard)
  @Get('deslocamentos')
  listDeslocamentos(@Req() req: AuthenticatedRequest) {
    return this.operacional.listDeslocamentos(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Get('escala')
  listShifts(@Query('start') start?: string, @Query('end') end?: string) {
    const range = resolveWeekRange(start, end);
    return this.operacional.listShifts(range.start, range.end);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Post('escala')
  @HttpCode(201)
  async createShift(@Body() body: unknown) {
    const result = EscalaShiftInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.operacional.createShift(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Delete('escala/:id')
  @HttpCode(204)
  async deleteShift(@Param('id') id: string) {
    await this.operacional.deleteShift(id);
  }
}
