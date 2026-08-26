import { Module } from '@nestjs/common';
import { SolicitacoesController } from './solicitacoes.controller';
import { SolicitacoesService } from './solicitacoes.service';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [AuthModule, PushModule],
  controllers: [SolicitacoesController],
  providers: [SolicitacoesService],
})
export class SolicitacoesModule {}
