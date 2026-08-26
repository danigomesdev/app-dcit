import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { DeslocamentoInputSchema } from '@ponto-dcit/shared-types';
import { OperacionalService } from './operacional.service';
import { AuthGuard } from '../auth/auth-guard';
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
}
