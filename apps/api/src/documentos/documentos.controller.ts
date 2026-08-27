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
import {
  AdmissionDocumentInputSchema,
  CertificationInputSchema,
} from '@ponto-dcit/shared-types';
import { DocumentosService } from './documentos.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @UseGuards(AuthGuard)
  @Get('holerites')
  listPayslips(@Req() req: AuthenticatedRequest) {
    return this.documentos.listPayslips(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('admissionais')
  @HttpCode(201)
  async createAdmissionDocument(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = AdmissionDocumentInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.createAdmissionDocument(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard)
  @Get('admissionais')
  listAdmissionDocuments(@Req() req: AuthenticatedRequest) {
    return this.documentos.listAdmissionDocuments(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('admissionais/equipe')
  listAllAdmissionDocuments() {
    return this.documentos.listAllAdmissionDocuments();
  }

  @UseGuards(AuthGuard)
  @Post('certificacoes')
  @HttpCode(201)
  async createCertification(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = CertificationInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.createCertification(req.user.sub, result.data);
  }

  @UseGuards(AuthGuard)
  @Get('certificacoes')
  listCertifications(@Req() req: AuthenticatedRequest) {
    return this.documentos.listCertifications(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get('certificacoes/equipe')
  listAllCertifications() {
    return this.documentos.listAllCertifications();
  }
}
