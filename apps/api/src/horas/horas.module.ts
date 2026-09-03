import { Module } from '@nestjs/common';
import { HorasController } from './horas.controller';
import { HorasService } from './horas.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HorasController],
  providers: [HorasService],
})
export class HorasModule {}
