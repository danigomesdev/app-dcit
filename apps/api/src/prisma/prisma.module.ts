import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global so every feature module (time-entries, atestados, solicitações,
// documentos, mural, benefícios, operacional, push-tokens, ...) can inject
// PrismaService without each one separately importing this module — a
// single PrismaClient instance/connection pool shared app-wide.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
