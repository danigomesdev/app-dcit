import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AtestadoOcrRequestSchema } from '@ponto-dcit/shared-types';
import { AtestadosService } from './atestados.service';
import { AuthGuard } from '../auth/auth-guard';

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
}
