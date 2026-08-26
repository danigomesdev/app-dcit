import { Module } from '@nestjs/common';
import { BeneficiosController } from './beneficios.controller';
import { BeneficiosService } from './beneficios.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BeneficiosController],
  providers: [BeneficiosService],
})
export class BeneficiosModule {}
