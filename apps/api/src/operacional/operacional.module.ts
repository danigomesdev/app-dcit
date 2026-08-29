import { Module } from '@nestjs/common';
import { OperacionalController } from './operacional.controller';
import { OperacionalService } from './operacional.service';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [AuthModule, PushModule],
  controllers: [OperacionalController],
  providers: [OperacionalService],
})
export class OperacionalModule {}
