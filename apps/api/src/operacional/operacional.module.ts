import { Module } from '@nestjs/common';
import { OperacionalController } from './operacional.controller';
import { OperacionalService } from './operacional.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OperacionalController],
  providers: [OperacionalService],
})
export class OperacionalModule {}
