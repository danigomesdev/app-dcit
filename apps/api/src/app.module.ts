import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { AuthModule } from './auth/auth.module';
import { AtestadosModule } from './atestados/atestados.module';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module';
import { DocumentosModule } from './documentos/documentos.module';
import { MuralModule } from './mural/mural.module';
import { BeneficiosModule } from './beneficios/beneficios.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OperacionalModule } from './operacional/operacional.module';
import { EmployeesModule } from './employees/employees.module';
import { PushModule } from './push/push.module';
import { AlertasModule } from './alertas/alertas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TimeEntriesModule,
    AtestadosModule,
    SolicitacoesModule,
    DocumentosModule,
    MuralModule,
    BeneficiosModule,
    OnboardingModule,
    OperacionalModule,
    EmployeesModule,
    PushModule,
    AlertasModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
