import { Module } from '@nestjs/common';
import { ConvencoesController } from './convencoes.controller';
import { ConvencoesService } from './convencoes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConvencoesController],
  providers: [ConvencoesService],
})
export class ConvencoesModule {}
